-- Apply after 026_shop_technician_role.sql (enum value 'shop_technician' must exist) and after 025.
--
-- สิทธิ์บัญชีร้านค้า 2 ระดับ (ดู 026):
--   is_shop_user()  → true สำหรับ shop และ shop_technician (อ่านข้อมูลของร้าน: ลูกค้า รถ ยาง แคตตาล็อก เพลา)
--   is_shop_admin() → เฉพาะ shop (เพิ่ม/แก้ลูกค้าของร้าน)
-- การเขียน vehicles / tires / tire_events ของลูกค้าภายใต้ร้านใช้ company_in_my_shop() ซึ่งไม่ขึ้นกับ role
-- ช่างร้านจึงบันทึกถอด-ใส่ยางได้เหมือนเดิม ส่วนหน้าลูกค้า/รายงาน/ช่างของร้าน แอปจำกัดไว้ที่ role shop
begin;

-- ------------------------------------------------------------
-- helper functions
-- ------------------------------------------------------------
create or replace function public.is_shop_user()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role in ('shop', 'shop_technician') from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.is_shop_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'shop' from public.profiles where id = auth.uid()), false);
$$;

-- ------------------------------------------------------------
-- profiles: ช่างร้านสังกัดร้านเหมือนแอดมินร้าน
-- ------------------------------------------------------------
alter table public.profiles drop constraint if exists profiles_tenant_check;
alter table public.profiles add constraint profiles_tenant_check check (
  (role in ('super_admin', 'austone_admin', 'sales') and company_id is null and shop_id is null)
  or (role in ('shop', 'shop_technician') and shop_id is not null and company_id is null)
  or (role in ('admin', 'technician') and company_id is not null and shop_id is null)
);

drop policy if exists profiles_super_write on public.profiles;
create policy profiles_super_write on public.profiles for all to authenticated
  using (
    is_true_super_admin()
    or (is_super_admin() and role in ('admin', 'technician', 'shop', 'shop_technician'))
  )
  with check (
    is_true_super_admin()
    or (is_super_admin() and role in ('admin', 'technician', 'shop', 'shop_technician'))
  );

-- ------------------------------------------------------------
-- companies: แก้ข้อมูลลูกค้าของร้านได้เฉพาะแอดมินร้าน
-- ------------------------------------------------------------
drop policy if exists companies_shop_update on public.companies;
create policy companies_shop_update on public.companies for update to authenticated
  using (is_shop_admin() and shop_id = current_shop_id())
  with check (is_shop_admin() and shop_id = current_shop_id());

-- ------------------------------------------------------------
-- shop_create_company: เพิ่มลูกค้าของร้านได้เฉพาะแอดมินร้าน (เนื้อหาเดิมจาก 022)
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
  if not public.is_shop_admin() then
    raise exception 'เฉพาะแอดมินร้านเท่านั้นที่เพิ่มลูกค้าของร้านได้' using errcode = '42501';
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

  -- ร้านไม่รู้ประเภทรถของลูกค้าล่วงหน้า → เปิดเพลาทุกแบบที่ใช้งานอยู่
  insert into public.company_axle_types (company_id, axle_type_id)
  select v_company, id from public.axle_types where is_active
  on conflict do nothing;

  -- ลูกค้าเห็นรุ่นที่ Austone กำหนดให้ร้านนี้ (migration 022)
  insert into public.company_tire_models (company_id, tire_model_id)
  select v_company, stm.tire_model_id
  from public.shop_tire_models stm
  join public.tire_models m on m.id = stm.tire_model_id
  where stm.shop_id = v_shop and m.is_active
  on conflict do nothing;

  return v_company;
end $$;

commit;
