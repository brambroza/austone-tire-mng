-- Apply after 021_shops.sql.
--
-- 1. shop_tire_models          : Austone (super admin) กำหนดรุ่นยางที่ร้าน (dealer) แต่ละแห่งใส่ให้ลูกค้าได้
--                                 ร้านใส่ได้เฉพาะรุ่นในตารางนี้ (แทนกฎ "ยี่ห้อ AUSTONE ทั้งหมด" ของ 021)
-- 2. companies.public_token     : ลิงก์ส่วนตัวให้บริษัทลูกค้าดูประวัติถอด-ใส่ยางของตัวเองโดยไม่ต้อง login
--                                 ร้านเป็นผู้สร้าง/ยกเลิก (สุ่มใหม่ = ลิงก์เก่าใช้ไม่ได้ทันที)
-- 3. public_company_history()   : RPC สำหรับหน้า public (anon) — คืนข้อมูลเฉพาะบริษัทเจ้าของ token
-- 4. shop_create_company()      : บริษัทใหม่ได้สิทธิ์เห็นรุ่นตามที่ร้านได้รับ (แทน AUSTONE ทั้งหมด)
begin;

-- ------------------------------------------------------------
-- shop_tire_models
-- ------------------------------------------------------------
create table if not exists public.shop_tire_models (
  shop_id       uuid not null references public.shops(id) on delete cascade,
  tire_model_id uuid not null references public.tire_models(id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (shop_id, tire_model_id)
);
comment on table public.shop_tire_models is 'รุ่นยาง (แคตตาล็อกกลาง) ที่ Austone อนุญาตให้ร้านค้าแต่ละแห่งใส่ให้ลูกค้า';
create index if not exists shop_tire_models_model_idx on public.shop_tire_models(tire_model_id);

alter table public.shop_tire_models enable row level security;

drop policy if exists stm_select on public.shop_tire_models;
create policy stm_select on public.shop_tire_models for select to authenticated
  using (is_super_admin() or shop_id = current_shop_id());

drop policy if exists stm_super_write on public.shop_tire_models;
create policy stm_super_write on public.shop_tire_models for all to authenticated
  using (is_super_admin()) with check (is_super_admin());

-- ------------------------------------------------------------
-- companies.public_token — private link (no login) for the customer company
-- ------------------------------------------------------------
alter table public.companies
  add column if not exists public_token text unique,
  add column if not exists public_token_created_at timestamptz;
comment on column public.companies.public_token is
  'โทเคนของลิงก์ส่วนตัว /p/<token> ให้บริษัทดูประวัติยางตัวเองโดยไม่ต้อง login — null = ยังไม่เปิด/ยกเลิกแล้ว';

-- ------------------------------------------------------------
-- RPC: public (anon) read of one company's tyre-change history by token
-- security definer: anon has no RLS policy on any table, so the token is the
-- only key. Returns null when the token is unknown or the company is inactive.
-- Staff names are NOT exposed — the customer sees the shop name instead.
-- ------------------------------------------------------------
create or replace function public.public_company_history(p_token text)
returns jsonb
language sql stable security definer set search_path = public as $$
  with c as (
    select co.id, co.name, co.code, co.shop_id
    from public.companies co
    where length(coalesce(p_token, '')) >= 20
      and co.public_token = p_token
      and co.is_active
  )
  select case when not exists (select 1 from c) then null else jsonb_build_object(
    'company', (select jsonb_build_object('name', c.name, 'code', c.code) from c),
    'shop', (
      select jsonb_build_object('name', s.name, 'phone', s.phone)
      from public.shops s join c on c.shop_id = s.id
    ),
    'axle_types', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'code', a.code, 'name', a.name, 'axle_kinds', a.axle_kinds
      ) order by a.sort_order, a.name), '[]'::jsonb)
      from public.axle_types a
    ),
    'vehicles', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', v.id, 'plate_no', v.plate_no, 'nickname', v.nickname, 'province', v.province,
        'axle_type', v.axle_type, 'brand', v.brand, 'model', v.model,
        'current_mileage', v.current_mileage
      ) order by v.plate_no nulls last, v.nickname), '[]'::jsonb)
      from public.vehicles v join c on v.company_id = c.id
      where v.is_active
    ),
    'events', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', e.id, 'event_type', e.event_type, 'event_date', e.event_date,
        'position_code', e.position_code, 'odometer', e.odometer, 'tread_mm', e.tread_mm,
        'distance_km', e.distance_km, 'note', e.note, 'vehicle_id', e.vehicle_id,
        'serial_no', t.serial_no, 'brand_name', t.brand_name, 'model_name', t.model_name,
        'size', t.size, 'reason', r.name
      ) order by e.event_date desc, e.created_at desc), '[]'::jsonb)
      from (
        select ev.* from public.tire_events ev join c on ev.company_id = c.id
        order by ev.event_date desc, ev.created_at desc
        limit 1000
      ) e
      join public.tires t on t.id = e.tire_id
      left join public.removal_reasons r on r.id = e.reason_id
    ),
    'generated_at', now()
  ) end
$$;

comment on function public.public_company_history(text) is
  'หน้า public /p/<token>: ประวัติถอด-ใส่ยางของบริษัทเจ้าของ token (ไม่ต้อง login, ไม่เปิดเผยชื่อพนักงาน)';

revoke all on function public.public_company_history(text) from public;
grant execute on function public.public_company_history(text) to anon, authenticated;

-- ------------------------------------------------------------
-- shop_create_company: new customer gets the models Austone granted to the shop
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

  -- the customer later sees the models Austone granted to this shop (migration 022)
  insert into public.company_tire_models (company_id, tire_model_id)
  select v_company, stm.tire_model_id
  from public.shop_tire_models stm
  join public.tire_models m on m.id = stm.tire_model_id
  where stm.shop_id = v_shop and m.is_active
  on conflict do nothing;

  return v_company;
end $$;

comment on function public.shop_create_company(text, text, text, text, text) is
  'ร้านค้าเพิ่มบริษัทลูกค้าภายใต้ร้าน (ยังไม่มีบัญชีผู้ใช้) พร้อมเปิดสิทธิ์เพลาทุกแบบและรุ่นยางที่ร้านได้รับ';

commit;
