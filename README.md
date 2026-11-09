# Austone Tire — ระบบจัดการยางรถบรรทุก

ระบบบันทึกการถอด-ใส่ยางรายเส้น ติดตามระยะใช้งาน และแจ้งเตือนเมื่อถึงเกณฑ์
UI แบบ modern minimal โทนฟ้าอ่อน เน้นการใช้งานบน **iPad** สำหรับช่างหน้างาน
ส่วน **Super Admin (Austone Thailand)** ออกแบบสำหรับเดสก์ท็อป

## Tech stack

| ส่วน | เทคโนโลยี |
| --- | --- |
| Frontend / Backend | Next.js 16 (App Router) + TypeScript |
| UI | Tailwind CSS v4, lucide-react, recharts |
| Database / Auth | Supabase (PostgreSQL + Row Level Security) |
| Validation | zod |

## โครงสร้าง role

ทีม Austone มี 3 ระดับ (migration 024/025): `super_admin` ทุกอย่าง + จัดการบัญชีทีมที่เมนู **ผู้ใช้งาน** · `austone_admin` ทุกอย่างยกเว้นจัดการทีม ·
`sales` ดูได้ทุกหน้า + จัดการร้านค้า/ดีลเลอร์ (สร้าง/แก้ร้าน กำหนดรุ่นยาง บัญชีร้าน) ปุ่มแก้ข้อมูลกลางถูกซ่อน และ RLS/server action ปฏิเสธ
กฎอยู่ใน [`src/lib/roles.ts`](src/lib/roles.ts) · ฝั่ง DB: `is_super_admin()` = super + austone_admin, `is_austone_staff()` = รวม sales, `is_true_super_admin()` = super เท่านั้น

| Role | ใช้ที่ | สิทธิ์ |
| --- | --- | --- |
| `super_admin` (Austone Thailand) | Desktop | CRUD ลูกค้า, ข้อมูลยางกลาง, ประเภทเพลา, สาเหตุการถอด, กำหนดว่าลูกค้าแต่ละรายเห็นยางรุ่นใด, ดูการใช้งานยางของลูกค้าทุกราย |
| `admin` (แอดมินลูกค้า) | iPad / Desktop | CRUD รถ, คลังยาง, จัดการช่างในบริษัท, แก้ข้อมูลบริษัทและเกณฑ์แจ้งเตือน, dashboard |
| `technician` (ช่าง) | iPad | บันทึกถอด / ใส่ / สลับตำแหน่งยาง, ค้นหารถและยาง |
| `shop` (พนักงานร้านค้า) | iPad / Desktop | เพิ่มลูกค้าภายใต้ร้าน, บันทึกถอด-ใส่ยางให้รถของบริษัทเหล่านั้น (ใส่ได้เฉพาะ AUSTONE), รายงานการเปลี่ยนยางต่อบริษัท, สร้างบัญชีให้บริษัทเมื่อพร้อม |

## ติดตั้ง

```bash
npm install
cp .env.example .env.local   # ใส่ค่าจริงจาก Supabase Dashboard > Project Settings > API
npm run dev
```

ตัวแปรที่ต้องตั้ง:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=     # ใช้เฉพาะฝั่ง server ตอนสร้างบัญชีผู้ใช้ให้ลูกค้า/ช่าง
```

> ⚠️ `SUPABASE_SERVICE_ROLE_KEY` ห้าม commit และห้ามใช้ฝั่ง client เด็ดขาด

## ตั้งค่าฐานข้อมูล

1. เปิด Supabase Dashboard → SQL Editor
2. รัน [`supabase/schema.sql`](supabase/schema.sql) — สร้างตาราง, view, RPC, RLS policy และ storage bucket ทั้งหมด
3. รัน [`supabase/seed.sql`](supabase/seed.sql) — ใส่สาเหตุการถอดยางและข้อมูลยางตัวอย่าง

> **โปรเจกต์ที่ติดตั้งไปก่อนหน้านี้** ให้รันไฟล์ใน [`supabase/migrations/`](supabase/migrations) ตามลำดับแทน:
> `001_apply_tire_ops.sql` (บันทึกงานยางหลายรายการพร้อมกัน), `002_tire_images.sql` (รูปยางในแคตตาล็อก)
> `003_tire_model_new_tread.sql` (ดอกยางตอนใหม่ของแต่ละรุ่น) และ
> `004_axle_types.sql` (ประเภทเพลาแบบ CRUD), `005_company_code_auto_run.sql` (เลขรันรหัสบริษัท)
> — ถ้ายังไม่รัน ปุ่ม “บันทึกทั้งหมด” ในหน้าช่างและการอัปโหลดรูปจะยังใช้ไม่ได้
>
> ไฟล์ถัดมา `006`–`011` ดูหัวไฟล์แต่ละตัว และ `012_plans_import_branch.sql` (แพ็กเกจ Standard/Premium,
> สาขาของรถ) — ถ้ายังไม่รัน 012 หน้านำเข้าซีรีย์ยาง รายงานรถ และช่องสาขาจะใช้ไม่ได้
> ตรวจผลหลังรันด้วย `supabase/scripts/verify_012.sql`
>
> **ร้านค้า (shop)** ใช้ `020_shop_role.sql` (รันเดี่ยว ๆ ก่อน เพราะเพิ่มค่า enum) แล้วตามด้วย `021_shops.sql` และ `022_shop_catalog_public_links.sql`
> **ทีม Austone (เซล/แอดมิน)** ใช้ `024_austone_roles.sql` (รันเดี่ยว ๆ — enum) แล้วตามด้วย `025_austone_roles_rls.sql`
> ตรวจผลด้วย `supabase/scripts/verify_021.sql` / `verify_022.sql` — รายละเอียดการออกแบบอยู่ใน [`docs/shop-layer-plan.md`](docs/shop-layer-plan.md)
4. สร้าง user แรกที่ Authentication → Add user แล้วผูก profile:

```sql
insert into public.profiles (id, company_id, role, full_name)
values ('<UUID จาก auth.users>', null, 'super_admin', 'Austone Thailand Admin');
```

จากนั้น login แล้วสร้างลูกค้าและบัญชีแอดมิน/ช่างจากหน้า Super Admin ได้เลย

## โมเดลข้อมูลหลัก

```
shops ──────┬── profiles (role = shop) (พนักงานร้านค้า)
            └── companies.shop_id     (บริษัทที่ร้านดูแล — null = ลูกค้าตรง)

companies ──┬── profiles            (ผู้ใช้ + role)
            ├── vehicles            (รถ: ทะเบียน จังหวัด ยี่ห้อ/รุ่น ประเภทเพลา เลขไมล์)
            ├── tires               (ยางรายเส้น: เลขยาง สถานะ ตำแหน่ง ระยะสะสม ดอกยาง)
            ├── tire_events         (ledger การถอด-ใส่ พร้อมระยะวิ่งต่อรอบ)
            └── company_tire_models (รุ่นยางที่ super admin อนุญาตให้เห็น)

tire_brands ── tire_models          (แคตตาล็อกกลาง: ยี่ห้อ รุ่น ขนาด รหัสดอกยาง ดอกยางตอนใหม่)
removal_reasons                     (สาเหตุการถอด — super admin config ได้)
axle_types ── vehicles              (ประเภทเพลา + รูปแบบล้อ — super admin config ได้)
```

### การคำนวณระยะใช้งานยาง

- ตอน **ใส่ยาง** ระบบเก็บ `mounted_odometer` = เลขไมล์รถ ณ ตอนนั้น
- ระหว่างใช้งาน: `ระยะรอบนี้ = เลขไมล์รถปัจจุบัน − mounted_odometer`
- ตอน **ถอดยาง** ระบบบวกระยะรอบนี้เข้า `total_distance_km` ของยางเส้นนั้น
- view `tire_overview` รวมสองส่วนเป็น `lifetime_km` ให้พร้อมใช้

ทั้งหมดทำผ่าน RPC `mount_tire()` / `unmount_tire()` ซึ่ง lock แถวยางระหว่างทำรายการ
กันกรณีช่างสองคนบันทึกพร้อมกัน และมี unique index กันไม่ให้ตำแหน่งล้อเดียวมียางซ้อนกัน

### เกณฑ์แจ้งเตือน

ตั้งค่าได้รายบริษัทที่หน้า "ข้อมูลบริษัท" (`companies.alert_km` ค่าเริ่มต้น 10,000 กม.
และ `companies.alert_tread_mm` ค่าเริ่มต้น 3.0 มม.) ยางที่ถึงเกณฑ์จะขึ้นสีเหลืองทั้งในตาราง
และบนแผนผังล้อ

## แพ็กเกจการใช้งาน (Standard / Premium)

`companies.plan` กำหนดโดย **super admin เท่านั้น** (หน้า ลูกค้า → แก้ไข → แพ็กเกจการใช้งาน)
มี trigger `trg_guard_company_plan` กันแอดมินบริษัทแก้เอง และ `plan_expires_at` ทำให้ Premium หมดอายุกลับเป็น Standard อัตโนมัติ
ฟีเจอร์ที่ล็อกด้วยแพ็กเกจอยู่ใน [`src/lib/plan.ts`](src/lib/plan.ts) (`hasFeature(company, 'tire_import')`)
ตอนนี้มี 3 รายการ: **นำเข้าซีรีย์ยางจากไฟล์** (`/tires/import`), **คีย์ซีรีย์ยางเข้าคลังทีละเส้น**
(ปุ่ม "เพิ่มยาง" ในหน้าคลังยาง) และ **เพิ่มยี่ห้อ/รุ่นยางของบริษัทเอง** (โหมด "พิมพ์ยี่ห้อ/รุ่นเอง" ในฟอร์มเพิ่มยาง
และแถวในไฟล์นำเข้าที่ยี่ห้อ/รุ่นยังไม่มีในแคตตาล็อก — ระบบสร้างให้เป็นรายการของบริษัทนั้น `created_by_company`
ลูกค้ารายอื่นมองไม่เห็น logic รวมอยู่ใน `ensureBrandModelFor` ของ `src/lib/tire-stock.ts`) — super admin ทำแทนลูกค้าได้ทุกแพ็กเกจ
ที่ `/superadmin/companies/<id>/tires` และ `/superadmin/companies/<id>/tires/import`
ยางที่ช่างคีย์หน้างานตอนถอด-ใส่ยังสร้างได้ทุกแพ็กเกจ (ผ่าน `insertStockTire` ใน [`src/lib/tire-stock.ts`](src/lib/tire-stock.ts))

## ร้านค้า (shop) — เปลี่ยนยางให้ลูกค้าหลายราย

Austone Thailand สร้างร้านที่เมนู **ร้านค้า/ดีลเลอร์** (`/superadmin/shops` — เมนูเดียวแทน "ข้อมูลลูกค้า" เดิม; ลูกค้าปลายทางทั้งหมดดูได้จากปุ่มในหน้านี้) และสร้างบัญชีพนักงานร้าน (role `shop`)
จากนั้น **กำหนดรุ่นยาง** ที่ร้านใส่ให้ลูกค้าได้ที่ `/superadmin/shops/[id]/tires` (เลือกได้เฉพาะรุ่นกลางยี่ห้อ AUSTONE — ตาราง `shop_tire_models`)
ร้านเข้าระบบแล้วเห็น 4 เมนู: **ลูกค้า** (เพิ่มด้วยชื่ออย่างเดียว ระบบเปิดสิทธิ์เพลาทุกแบบ + รุ่นที่ร้านได้รับให้),
**บันทึกถอด-ใส่ยาง** (เลือกบริษัท → wizard เดียวกับช่าง แต่ใส่ได้เฉพาะรุ่นที่ Austone กำหนดให้ร้าน และติ๊ก "ไม่ทราบซีรีย์" ตอนถอดได้
ระบบตั้งซีรีย์แทนเป็น `UNK-YYMMDD-XXXXX`), **รายงานการเปลี่ยนยาง** (กรองลูกค้า/ช่วงวันที่ ส่งออก Excel)
และ **ช่างของร้าน** (ร้านเพิ่ม/แก้ไข/ตั้งรหัสผ่าน/ปิดใช้งาน/ลบบัญชีช่างของร้านเองได้ ทุกบัญชีร้านเป็น role `shop` เท่ากัน)

**ลิงก์ส่วนตัวให้ลูกค้า (ไม่ต้อง login):** ที่หน้ารายละเอียดบริษัท ร้านกด "สร้างลิงก์" ได้ `/p/<token>` (token 32 ตัว, migration 022)
ส่งให้ลูกค้าทาง Line แล้วเปิดดูประวัติถอด-ใส่ยางของรถตัวเองได้ทันที — หน้า public อ่านผ่าน RPC `public_company_history(token)` ตัวเดียว
สร้างใหม่ = ลิงก์เดิมใช้ไม่ได้, ปิดลิงก์ได้ · ตั้ง `NEXT_PUBLIC_APP_URL` บน production เพื่อให้ลิงก์ถูก domain

ข้อมูลยังแยกตาม `company_id` ของแต่ละบริษัทเหมือนเดิม — ร้านเข้าถึงได้เฉพาะบริษัทที่ `companies.shop_id` เป็นร้านตัวเอง
(RLS ผ่าน `company_in_my_shop()`) บริษัทเข้าระบบแล้วเห็นรถ/ยาง/ประวัติของตัวเองในหน้าเดิมทุกอย่าง
กฎร้านค้าอยู่ใน [`src/lib/shop-rules.ts`](src/lib/shop-rules.ts) และการตรวจสิทธิ์ใน [`src/lib/company-scope.ts`](src/lib/company-scope.ts)

## สาขา / หน่วยงานของรถ

แอดมินบริษัทตั้งรายชื่อสาขาที่หน้า "ข้อมูลบริษัท" (`companies.branches`) แล้วเลือกให้รถแต่ละคัน (`vehicles.branch`)
ใช้แยกกลุ่มในหน้า **รายงานรถและการตรวจยาง** (`/reports/fleet`) ซึ่งสรุปจำนวนรถตามสาขา/ประเภทรถ,
รถที่ไม่ได้ตรวจยางนาน, แนวโน้ม 12 เดือน และสภาพดอกยาง พร้อมส่งออก Excel/PDF

## รูปยางในแคตตาล็อก

Super admin อัปโหลดรูปให้รุ่นยางได้ที่เมนู **ข้อมูลยาง** (JPG/PNG/WebP/AVIF ไม่เกิน 3 MB)
รูปเก็บใน Supabase Storage bucket `tire-images` (public read) และอัปโหลดผ่าน server action
ที่ใช้ service role จึงไม่ต้องเปิดสิทธิ์เขียน storage ให้ผู้ใช้ทั่วไป

รูปที่ใส่ไว้จะไปแสดงอัตโนมัติในทุกจุดที่อ้างถึงยางรุ่นนั้น: หน้าช่างตอนเลือกยางจากคลังและในตะกร้ารายการ,
ตารางคลังยาง, แดชบอร์ด (ตารางแจ้งเตือนและระยะสะสมสูงสุด) และหน้ารายละเอียดยาง

## ผังตำแหน่งล้อ

รหัสตำแหน่งอยู่ในรูป `A{เพลา}{ด้าน}{นอก/ใน}` เช่น `A1L` = เพลา 1 ซ้าย, `A3RO` = เพลา 3 ขวานอก
ประเภทเพลาและลำดับเพลาเดี่ยว/คู่เก็บในตาราง `axle_types` และจัดการได้จากเมนู
**ประเภทเพลา** ของ Super Admin ส่วน [`src/lib/axle-layouts.ts`](src/lib/axle-layouts.ts)
ทำหน้าที่แปลงข้อมูลนั้นเป็นตำแหน่งล้อสำหรับฟอร์มรถและแผนผังหน้างาน

## โครงสร้างโค้ด

```
src/
├── app/
│   ├── login/                 หน้าเข้าสู่ระบบ
│   ├── (app)/                 ฝั่งลูกค้า (admin + ช่าง)
│   │   ├── dashboard/         ภาพรวม + แจ้งเตือน + ยางที่ถอดออก
│   │   ├── reports/fleet/     รายงานรถและการตรวจยาง (สาขา/ประเภทรถ, ขาดตรวจ, ดอกยาง)
│   │   ├── vehicles/          CRUD รถ + หน้ารายละเอียดพร้อมผังล้อ
│   │   ├── tires/             คลังยาง + ประวัติรายเส้น + นำเข้าซีรีย์จากไฟล์ (Premium)
│   │   ├── service/           ขั้นตอนบันทึกถอด-ใส่ยาง (หน้าหลักของช่าง)
│   │   ├── technicians/       จัดการบัญชีช่างในบริษัท
│   │   └── company/           แก้ข้อมูลบริษัท + เกณฑ์แจ้งเตือน
│   ├── (shop)/shop/           ฝั่งร้านค้า: ลูกค้า (+ลิงก์ลูกค้า) / บันทึกถอด-ใส่ยาง / รายงาน
│   ├── (public)/p/[token]/    หน้าลูกค้าดูประวัติผ่านลิงก์ส่วนตัว ไม่ต้อง login
│   └── (super)/superadmin/    ฝั่ง Austone Thailand (รวมเมนูร้านค้า)
├── components/                UI primitives, AppShell, ผังล้อ, กราฟ
└── lib/                       supabase clients, auth, types, utils
```

## คำสั่งที่ใช้บ่อย

> สคริปต์ใน `scripts/` ต้องใช้ Node 22 ขึ้นไป (supabase-js ต้องการ native WebSocket)

```bash
npm run dev      # dev server
npm run build    # production build
npm run lint     # eslint
npx tsc --noEmit # typecheck
```

## หมายเหตุด้านความปลอดภัย

- ทุกตารางเปิด RLS และแยกข้อมูลตาม `company_id` — ลูกค้าเห็นเฉพาะข้อมูลตัวเอง
- ทุก server action ตรวจ role ซ้ำด้วย `requireSession([...])` ไม่พึ่ง UI อย่างเดียว
- input ทุกช่องผ่าน zod ก่อนลง DB และใช้ query builder ของ Supabase (parameterized) ตลอด
