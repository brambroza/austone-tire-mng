-- ทดสอบสิทธิ์แอดมินร้าน (shop) vs ช่างร้าน (shop_technician) หลังรัน 026/027 — ใช้กับ DB ทดสอบที่ลง schema.sql + seed.sql แล้ว
-- ทั้งไฟล์อยู่ในทรานแซกชันเดียวและ rollback ตอนจบ จึงไม่ทิ้งข้อมูล · ถ้ามี ERROR/TEST FAILED แปลว่าสิทธิ์ผิด
-- รัน: psql "$DB_URL" -At -f supabase/scripts/test_027_shop_roles.sql
-- หมายเหตุ: auth.uid() บางรุ่นอ่าน request.jwt.claim.sub (เก่า) บางรุ่นอ่าน request.jwt.claims (ใหม่) จึงตั้งทั้งคู่
\set ON_ERROR_STOP on
begin;
-- auth users
insert into auth.users (id, instance_id, email, aud, role, encrypted_password, confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-000000000000','shopadmin@test.local','authenticated','authenticated','x',now(),'{}','{}',now(),now()),
 ('22222222-2222-2222-2222-222222222222','00000000-0000-0000-0000-000000000000','shoptech@test.local','authenticated','authenticated','x',now(),'{}','{}',now(),now()),
 ('33333333-3333-3333-3333-333333333333','00000000-0000-0000-0000-000000000000','othertech@test.local','authenticated','authenticated','x',now(),'{}','{}',now(),now());
insert into public.shops (id, code, name) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','S9001','ร้านทดสอบ RBAC');
insert into public.shops (id, code, name) values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','S9002','ร้านอื่น');
insert into public.profiles (id, role, shop_id, full_name) values
 ('11111111-1111-1111-1111-111111111111','shop','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','แอดมินร้าน'),
 ('22222222-2222-2222-2222-222222222222','shop_technician','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','ช่างร้าน'),
 ('33333333-3333-3333-3333-333333333333','shop_technician','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','ช่างร้านอื่น');
insert into public.companies (id, code, name, shop_id) values ('cccccccc-cccc-cccc-cccc-cccccccccccc','C9001','ลูกค้าของร้าน','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');

-- constraint: technician must belong to a shop, not a company
\echo '--- constraint: shop_technician with company_id must FAIL'
do $$ begin
  begin
    insert into public.profiles (id, role, company_id, full_name) values ('33333333-3333-3333-3333-333333333333','shop_technician','cccccccc-cccc-cccc-cccc-cccccccccccc','bad');
    raise exception 'TEST FAILED: constraint accepted shop_technician with company_id';
  exception when check_violation then raise notice 'ok: check_violation'; end;
end $$;

-- ===== technician session =====
savepoint tech;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
\echo '--- tech: helper flags (expect is_shop_user=t, is_shop_admin=f)'
select public.is_shop_user(), public.is_shop_admin();
\echo '--- tech: sees shop customer (expect 1)'
select count(*) from public.companies;
\echo '--- tech: reads axle types + tire models (expect > 0 each)'
select (select count(*) from public.axle_types) as axle_types, (select count(*) from public.tire_models) as tire_models;
\echo '--- tech: update company must affect 0 rows'
with u as (update public.companies set name = 'hacked' where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc' returning 1) select count(*) as updated from u;
\echo '--- tech: insert vehicle for shop customer must SUCCEED'
insert into public.vehicles (company_id, plate_no, province, axle_type, current_mileage, mileage_updated_at)
  select 'cccccccc-cccc-cccc-cccc-cccccccccccc', '70-9999', 'กรุงเทพมหานคร', code, 0, now() from public.axle_types where is_active limit 1
  returning plate_no;
\echo '--- tech: shop_create_company must FAIL (42501)'
do $$ begin
  begin
    perform public.shop_create_company('ลูกค้าใหม่โดยช่าง');
    raise exception 'TEST FAILED: technician could create company';
  exception when insufficient_privilege then raise notice 'ok: insufficient_privilege'; end;
end $$;
rollback to savepoint tech;

-- ===== admin session =====
savepoint adm;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
\echo '--- admin: helper flags (expect t, t)'
select public.is_shop_user(), public.is_shop_admin();
\echo '--- admin: update company must affect 1 row'
with u as (update public.companies set name = 'แก้โดยแอดมิน' where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc' returning 1) select count(*) as updated from u;
\echo '--- admin: shop_create_company must SUCCEED'
select public.shop_create_company('ลูกค้าใหม่โดยแอดมิน') is not null as created;
\echo '--- admin: sees coworker technician in profiles (expect 2 = self + tech)'
select count(*) from public.profiles where shop_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
rollback to savepoint adm;

-- ===== other shop's technician =====
savepoint other;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', true);
\echo '--- other-shop tech: must NOT see customer of shop A (expect 0)'
select count(*) from public.companies where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
rollback to savepoint other;
rollback;
\echo '=== SCENARIO DONE (rolled back) ==='
