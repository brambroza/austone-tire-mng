-- Apply after 020_shop_role.sql (the enum value 'shop' must already exist).
--
-- ร้านค้า (shop) layer: a tyre shop changes tyres for many customer companies.
--   shops                 : 1 row = 1 shop (Dreammaker creates it)
--   companies.shop_id     : the shop that looks after this company (null = direct customer)
--   profiles.shop_id      : shop staff accounts (role = 'shop', company_id = null)
--   shop_create_company() : shop adds a customer by name only; logins come later
--
-- Data stays separated per company (company_id on every tenant table is unchanged).
-- A shop account can read/write only the rows of companies whose shop_id is its own.
begin;

-- ------------------------------------------------------------
-- shops
-- ------------------------------------------------------------
create sequence if not exists public.shop_code_seq;

create table if not exists public.shops (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique default (
    'S' || lpad(nextval('public.shop_code_seq')::text, 4, '0')
  ),
  name          text not null,
  tax_id        text,
  phone         text,
  email         text,
  address       text,
  contact_name  text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
comment on table public.shops is 'ร้านค้าที่เปลี่ยนยางให้บริษัทลูกค้าหลายราย — Dreammaker เป็นผู้สร้าง';

drop trigger if exists trg_touch_shops on public.shops;
create trigger trg_touch_shops before update on public.shops
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------
-- companies.shop_id / profiles.shop_id
-- ------------------------------------------------------------
alter table public.companies
  add column if not exists shop_id uuid references public.shops(id) on delete set null;
create index if not exists companies_shop_idx on public.companies(shop_id) where shop_id is not null;
comment on column public.companies.shop_id is 'ร้านค้าที่ดูแลบริษัทนี้ — null = ลูกค้าตรงของ Dreammaker';

alter table public.profiles
  add column if not exists shop_id uuid references public.shops(id) on delete cascade;
create index if not exists profiles_shop_idx on public.profiles(shop_id) where shop_id is not null;

-- super_admin: no company, no shop · shop: shop only · admin/technician: company only
alter table public.profiles drop constraint if exists profiles_company_required;
alter table public.profiles drop constraint if exists profiles_tenant_check;
alter table public.profiles add constraint profiles_tenant_check check (
  (role = 'super_admin' and company_id is null and shop_id is null)
  or (role = 'shop' and shop_id is not null and company_id is null)
  or (role in ('admin', 'technician') and company_id is not null and shop_id is null)
);

-- ------------------------------------------------------------
-- helper functions for RLS
-- ------------------------------------------------------------
create or replace function public.current_shop_id()
returns uuid language sql stable security definer set search_path = public as $$
  select shop_id from public.profiles where id = auth.uid();
$$;

create or replace function public.is_shop_user()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'shop' from public.profiles where id = auth.uid()), false);
$$;

-- true when the company belongs to the caller's shop
create or replace function public.company_in_my_shop(p_company uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select c.shop_id is not null
       and c.shop_id = (select p.shop_id from public.profiles p where p.id = auth.uid())
    from public.companies c
    where c.id = p_company
  ), false);
$$;

-- ------------------------------------------------------------
-- RLS: shops
-- ------------------------------------------------------------
alter table public.shops enable row level security;

drop policy if exists shops_select on public.shops;
create policy shops_select on public.shops for select to authenticated
  using (is_super_admin() or id = current_shop_id());

drop policy if exists shops_super_write on public.shops;
create policy shops_super_write on public.shops for all to authenticated
  using (is_super_admin()) with check (is_super_admin());

-- ------------------------------------------------------------
-- RLS: companies — shop sees/edits its own customers, cannot move them to another shop
-- ------------------------------------------------------------
drop policy if exists companies_select on public.companies;
create policy companies_select on public.companies for select to authenticated
  using (is_super_admin() or id = current_company_id() or shop_id = current_shop_id());

drop policy if exists companies_shop_update on public.companies;
create policy companies_shop_update on public.companies for update to authenticated
  using (is_shop_user() and shop_id = current_shop_id())
  with check (is_shop_user() and shop_id = current_shop_id());

-- ------------------------------------------------------------
-- RLS: profiles — shop sees its colleagues and the accounts of its customers
-- ------------------------------------------------------------
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (
    is_super_admin()
    or id = auth.uid()
    or company_id = current_company_id()
    or (shop_id is not null and shop_id = current_shop_id())
    or company_in_my_shop(company_id)
  );

-- ------------------------------------------------------------
-- RLS: tenant tables — add the shop clause
-- ------------------------------------------------------------
do $$
declare tbl text;
begin
  foreach tbl in array array['vehicles','tires','tire_events','tire_imports'] loop
    execute format('drop policy if exists %1$s_tenant_select on public.%1$I', tbl);
    execute format($f$create policy %1$s_tenant_select on public.%1$I
      for select to authenticated
      using (is_super_admin() or company_id = current_company_id() or company_in_my_shop(company_id))$f$, tbl);

    execute format('drop policy if exists %1$s_tenant_write on public.%1$I', tbl);
    execute format($f$create policy %1$s_tenant_write on public.%1$I
      for all to authenticated
      using (is_super_admin() or company_id = current_company_id() or company_in_my_shop(company_id))
      with check (is_super_admin() or company_id = current_company_id() or company_in_my_shop(company_id))$f$, tbl);
  end loop;
end $$;

-- ------------------------------------------------------------
-- RLS: catalog — a shop cannot know a customer's vehicle types ahead of time,
-- so it may use every active axle type, and reads the central catalogue
-- (the app limits mounting to AUSTONE; removed tyres can be any brand)
-- ------------------------------------------------------------
drop policy if exists axle_types_select on public.axle_types;
create policy axle_types_select on public.axle_types for select to authenticated
  using (
    is_super_admin()
    or is_shop_user()
    or exists (
      select 1 from public.company_axle_types ca
      where ca.axle_type_id = axle_types.id
        and ca.company_id = current_company_id()
    )
    or exists (
      select 1 from public.vehicles v
      where v.company_id = current_company_id()
        and v.axle_type = axle_types.code
    )
  );

drop policy if exists models_select on public.tire_models;
create policy models_select on public.tire_models for select to authenticated
  using (
    is_super_admin()
    or (is_shop_user() and created_by_company is null)
    or created_by_company = current_company_id()
    or exists (
      select 1 from public.company_tire_models m
      where m.tire_model_id = tire_models.id
        and m.company_id = current_company_id()
    )
  );

drop policy if exists cat_select on public.company_axle_types;
create policy cat_select on public.company_axle_types for select to authenticated
  using (is_super_admin() or company_id = current_company_id() or company_in_my_shop(company_id));

drop policy if exists ctm_select on public.company_tire_models;
create policy ctm_select on public.company_tire_models for select to authenticated
  using (is_super_admin() or company_id = current_company_id() or company_in_my_shop(company_id));

-- ------------------------------------------------------------
-- AUSTONE must exist in the central catalogue (the only brand a shop may mount)
-- ------------------------------------------------------------
insert into public.tire_brands (name) values ('AUSTONE') on conflict (name) do nothing;

-- ------------------------------------------------------------
-- RPC: shop adds a customer company (name only; logins registered later)
-- security definer so it can grant axle types + AUSTONE models, which only
-- super admin may write directly
-- ------------------------------------------------------------
create or replace function public.shop_create_company(
  p_name         text,
  p_contact_name text default null,
  p_phone        text default null,
  p_tax_id       text default null,
  p_address      text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_shop    uuid;
  v_company uuid;
begin
  if not public.is_shop_user() then
    raise exception 'เฉพาะบัญชีร้านค้าเท่านั้นที่เพิ่มบริษัทลูกค้าของร้านได้' using errcode = '42501';
  end if;
  v_shop := public.current_shop_id();
  if v_shop is null then
    raise exception 'บัญชีนี้ยังไม่ได้ผูกกับร้านค้า' using errcode = '42501';
  end if;
  if not exists (select 1 from public.shops where id = v_shop and is_active) then
    raise exception 'ร้านค้านี้ถูกปิดใช้งานแล้ว' using errcode = '42501';
  end if;
  if nullif(btrim(coalesce(p_name, '')), '') is null then
    raise exception 'กรุณากรอกชื่อบริษัท' using errcode = '22023';
  end if;

  insert into public.companies (name, contact_name, phone, tax_id, address, shop_id)
  values (
    btrim(p_name),
    nullif(btrim(coalesce(p_contact_name, '')), ''),
    nullif(btrim(coalesce(p_phone, '')), ''),
    nullif(btrim(coalesce(p_tax_id, '')), ''),
    nullif(btrim(coalesce(p_address, '')), ''),
    v_shop
  )
  returning id into v_company;

  -- the shop cannot know the customer's fleet ahead of time → every active axle type
  insert into public.company_axle_types (company_id, axle_type_id)
  select v_company, id from public.axle_types where is_active
  on conflict do nothing;

  -- the customer later sees the AUSTONE models the shop mounted
  insert into public.company_tire_models (company_id, tire_model_id)
  select v_company, m.id
  from public.tire_models m
  join public.tire_brands b on b.id = m.brand_id
  where m.is_active and m.created_by_company is null and b.name = 'AUSTONE'
  on conflict do nothing;

  return v_company;
end $$;

comment on function public.shop_create_company(text, text, text, text, text) is
  'ร้านค้าเพิ่มบริษัทลูกค้าภายใต้ร้าน (ยังไม่มีบัญชีผู้ใช้) พร้อมเปิดสิทธิ์เพลาทุกแบบและรุ่น AUSTONE';

commit;
