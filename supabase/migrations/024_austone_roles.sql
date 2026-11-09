-- Apply alone (outside any transaction) before 025_austone_roles_rls.sql —
-- Postgres refuses to use a new enum value in the same transaction that adds it.
--
-- ทีม Austone มี 3 ระดับ:
--   super_admin   : ทุกอย่าง + จัดการบัญชีทีม Austone
--   austone_admin : ทุกอย่างเหมือน super_admin ยกเว้นจัดการบัญชีทีม Austone
--   sales         : ดูได้ทุกหน้าของ Austone + จัดการร้านค้า/ดีลเลอร์ (สร้าง/แก้ร้าน กำหนดรุ่นยาง สร้างบัญชีร้าน)
alter type public.user_role add value if not exists 'austone_admin';
alter type public.user_role add value if not exists 'sales';
