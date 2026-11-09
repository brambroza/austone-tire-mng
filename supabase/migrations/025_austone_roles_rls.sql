-- Apply after 024_austone_roles.sql (enum values 'austone_admin' and 'sales' must exist).
--
-- สิทธิ์ทีม Austone (ดู 024):
--   is_super_admin()    → true สำหรับ super_admin และ austone_admin (ใช้กับ policy "เขียน" เดิมทั้งหมด)
--   is_austone_staff()  → true สำหรับ super_admin / austone_admin / sales (ใช้กับ policy "อ่าน" + งานดีลเลอร์)
--   is_true_super_admin() → เฉพาะ super_admin (จัดการบัญชีทีม Austone)
-- การเปิดสิทธิ์รุ่นยางให้บริษัทลูกค้าของร้านย้ายไปอยู่ใน trigger ของ shop_tire_models
-- เพื่อให้ sales (ซึ่งเขียน company_tire_models ไม่ได้) กำหนดรุ่นให้ร้านได้
begin;

-- ------------------------------------------------------------
-- helper functions
-- ------------------------------------------------------------
create or replace function public.is_true_super_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'super_admin' from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role in ('super_admin', 'austone_admin') from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.is_austone_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role in ('super_admin', 'austone_admin', 'sales') from public.profiles where id = auth.uid()), false);
$$;

-- ------------------------------------------------------------
-- profiles: ทีม Austone ไม่สังกัดบริษัท/ร้าน
-- ------------------------------------------------------------
alter table public.profiles drop constraint if exists profiles_tenant_check;
alter table public.profiles add constraint profiles_tenant_check check (
  (role in ('super_admin', 'austone_admin', 'sales') and company_id is null and shop_id is null)
  or (role = 'shop' and shop_id is not null and company_id is null)
  or (role in ('admin', 'technician') and company_id is not null and shop_id is null)
);

-- ------------------------------------------------------------
-- RLS: อ่าน = ทีม Austone ทุกคน · เขียน = super/austone_admin · ดีลเลอร์ = รวม sales
-- ------------------------------------------------------------
drop policy if exists shops_select on public.shops;
create policy shops_select on public.shops for select to authenticated
  using (is_austone_staff() or id = current_shop_id());
drop policy if exists shops_super_write on public.shops;
create policy shops_super_write on public.shops for all to authenticated
  using (is_austone_staff()) with check (is_austone_staff());

drop policy if exists companies_select on public.companies;
create policy companies_select on public.companies for select to authenticated
  using (is_austone_staff() or id = current_company_id() or shop_id = current_shop_id());

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (
    is_austone_staff()
    or id = auth.uid()
    or company_id = current_company_id()
    or (shop_id is not null and shop_id = current_shop_id())
    or company_in_my_shop(company_id)
  );

-- austone_admin จัดการได้เฉพาะบัญชีของลูกค้า/ร้าน · บัญชีทีม Austone เป็นของ super_admin เท่านั้น
drop policy if exists profiles_super_write on public.profiles;
create policy profiles_super_write on public.profiles for all to authenticated
  using (
    is_true_super_admin()
    or (is_super_admin() and role in ('admin', 'technician', 'shop'))
  )
  with check (
    is_true_super_admin()
    or (is_super_admin() and role in ('admin', 'technician', 'shop'))
  );

do $$
declare tbl text;
begin
  foreach tbl in array array['vehicles','tires','tire_events','tire_imports'] loop
    execute format('drop policy if exists %1$s_tenant_select on public.%1$I', tbl);
    execute format($f$create policy %1$s_tenant_select on public.%1$I
      for select to authenticated
      using (is_austone_staff() or company_id = current_company_id() or company_in_my_shop(company_id))$f$, tbl);
  end loop;
end $$;

drop policy if exists axle_types_select on public.axle_types;
create policy axle_types_select on public.axle_types for select to authenticated
  using (
    is_austone_staff()
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

drop policy if exists cat_select on public.company_axle_types;
create policy cat_select on public.company_axle_types for select to authenticated
  using (is_austone_staff() or company_id = current_company_id() or company_in_my_shop(company_id));

drop policy if exists models_select on public.tire_models;
create policy models_select on public.tire_models for select to authenticated
  using (
    is_austone_staff()
    or (is_shop_user() and created_by_company is null)
    or created_by_company = current_company_id()
    or exists (
      select 1 from public.company_tire_models m
      where m.tire_model_id = tire_models.id
        and m.company_id = current_company_id()
    )
  );

drop policy if exists ctm_select on public.company_tire_models;
create policy ctm_select on public.company_tire_models for select to authenticated
  using (is_austone_staff() or company_id = current_company_id() or company_in_my_shop(company_id));

drop policy if exists stm_select on public.shop_tire_models;
create policy stm_select on public.shop_tire_models for select to authenticated
  using (is_austone_staff() or shop_id = current_shop_id());
drop policy if exists stm_super_write on public.shop_tire_models;
create policy stm_super_write on public.shop_tire_models for all to authenticated
  using (is_austone_staff()) with check (is_austone_staff());

-- ------------------------------------------------------------
-- trigger: รุ่นที่กำหนดให้ร้าน → เปิดสิทธิ์ให้บริษัทลูกค้าทุกรายของร้านอัตโนมัติ
-- (security definer เพราะ sales เขียน company_tire_models เองไม่ได้)
-- ------------------------------------------------------------
create or replace function public.propagate_shop_tire_model()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.company_tire_models (company_id, tire_model_id)
  select c.id, new.tire_model_id from public.companies c where c.shop_id = new.shop_id
  on conflict do nothing;
  return new;
end $$;

drop trigger if exists trg_propagate_shop_tire_model on public.shop_tire_models;
create trigger trg_propagate_shop_tire_model after insert on public.shop_tire_models
  for each row execute function public.propagate_shop_tire_model();

commit;
