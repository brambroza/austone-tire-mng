-- Apply after 022_shop_catalog_public_links.sql.
--
-- เปลี่ยนชื่อผู้ดูแลระบบที่แสดงในข้อความ error จาก "Dreammaker" เป็น "Austone Thailand"
-- (เนื้อหา function เหมือน 012 ทุกอย่าง ต่างแค่ข้อความ)
begin;

create or replace function public.guard_company_plan()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (new.plan is distinct from old.plan or new.plan_expires_at is distinct from old.plan_expires_at)
     and not public.is_super_admin() then
    raise exception 'เฉพาะผู้ดูแลระบบ (Austone Thailand) เท่านั้นที่เปลี่ยนแพ็กเกจได้'
      using errcode = '42501';
  end if;
  return new;
end $$;

comment on table public.shops is 'ร้านค้าที่เปลี่ยนยางให้บริษัทลูกค้าหลายราย — Austone Thailand เป็นผู้สร้าง';
comment on column public.companies.shop_id is 'ร้านค้าที่ดูแลบริษัทนี้ — null = ลูกค้าตรงของ Austone Thailand';

commit;
