-- Apply alone (outside any transaction) AFTER 025_austone_roles_rls.sql and BEFORE 027_shop_technician_rls.sql.
-- Postgres refuses to use a new enum value in the same transaction that adds it.
--
-- บัญชีร้านค้าแยกเป็น 2 ระดับ:
--   shop            : แอดมินร้าน — จัดการลูกค้าของร้าน ลิงก์ลูกค้า บัญชีช่าง และเรียกดูรายงาน (บัญชีร้านเดิมทุกบัญชีเป็นระดับนี้)
--   shop_technician : ช่างร้าน — บันทึกถอด-ใส่ยางให้ลูกค้าของร้านเท่านั้น
alter type public.user_role add value if not exists 'shop_technician';
