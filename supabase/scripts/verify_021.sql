-- ตรวจผลหลังรัน 020 + 021
select enumlabel from pg_enum where enumtypid = 'public.user_role'::regtype order by enumsortorder;
select column_name from information_schema.columns
 where table_schema = 'public' and table_name in ('companies', 'profiles') and column_name = 'shop_id';
select proname from pg_proc where proname in ('current_shop_id', 'is_shop_user', 'company_in_my_shop', 'shop_create_company');
select policyname, tablename from pg_policies where schemaname = 'public' and tablename in ('shops', 'companies') order by tablename, policyname;
select name from public.tire_brands where name = 'AUSTONE';
