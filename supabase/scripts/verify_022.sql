-- ตรวจผลหลังรัน 022_shop_catalog_public_links.sql
select table_name from information_schema.tables where table_schema = 'public' and table_name = 'shop_tire_models';
select column_name from information_schema.columns
 where table_schema = 'public' and table_name = 'companies' and column_name in ('public_token', 'public_token_created_at');
select proname, prosecdef from pg_proc where proname in ('public_company_history', 'shop_create_company');
select policyname from pg_policies where schemaname = 'public' and tablename = 'shop_tire_models' order by policyname;
-- anon ต้องเรียก RPC ได้ (ต้องคืน true)
select has_function_privilege('anon', 'public.public_company_history(text)', 'execute');
-- token ปลอมต้องได้ null
select public.public_company_history('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA') is null as unknown_token_is_null;
