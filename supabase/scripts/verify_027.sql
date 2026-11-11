-- ตรวจผลหลังรัน 026_shop_technician_role.sql + 027_shop_technician_rls.sql
-- enum ต้องมี shop_technician
select enumlabel from pg_enum e join pg_type t on t.oid = e.enumtypid
 where t.typname = 'user_role' order by e.enumsortorder;
-- ฟังก์ชันใหม่ต้องมี
select proname, prosecdef from pg_proc where proname in ('is_shop_user', 'is_shop_admin', 'shop_create_company');
-- constraint ต้องรับ shop_technician (ต้องมีคำว่า shop_technician ใน definition)
select pg_get_constraintdef(oid) like '%shop_technician%' as tenant_check_has_technician
  from pg_constraint where conname = 'profiles_tenant_check';
-- policy แก้ลูกค้าของร้านต้องใช้ is_shop_admin
select policyname, qual like '%is_shop_admin%' as uses_shop_admin
  from pg_policies where schemaname = 'public' and tablename = 'companies' and policyname = 'companies_shop_update';
select policyname, qual like '%shop_technician%' as includes_technician
  from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_super_write';
