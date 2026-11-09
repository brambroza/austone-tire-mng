# แผนเพิ่ม layer "ร้านค้า" (shop) — ร้านเปลี่ยนยางให้บริษัทลูกค้าหลายราย

สถานะ: **apply บน Supabase ของจริงแล้ว 2026-11-09** — project ใหม่ `xvneqxvlapowtnqlkkhk` (ว่างเปล่า) ลง `schema.sql` ทั้งไฟล์ (รวม 020–022) + `seed.sql`
ผ่าน `verify_021.sql` / `verify_022.sql`, bucket `tire-images` / `vehicle-images` ถูกสร้าง, anon เรียก RPC `public_company_history` ผ่าน PostgREST ได้ (token ปลอม → null)
ข้อมูลทดสอบบน project จริง (สร้างผ่าน UI ทั้งหมด 2026-11-09, flow E2E ผ่าน 28/30 — 2 ข้อที่ไม่ผ่านเป็นของ test harness): super admin `por@dreammakerthai.com` ·
ร้าน `S0001 ร้านยางทดสอบ (Demo)` + บัญชีร้าน `shop.demo@dreammakerthai.com` · กำหนดรุ่น AUSTONE OH-110 + AT-118 ให้ร้าน · บริษัท `C0001 บริษัท ขนส่งทดสอบ จำกัด` มีลิงก์ลูกค้าเปิดอยู่ ·
รถ 70-1234 (10W) มีประวัติ ถอด MICHELIN X-MULTI (ซีรีย์ UNK-) / ใส่ AUSTONE AT-118 `AU123456` · รุ่นทดสอบ MICHELIN X-MULTI ถูกเพิ่มในแคตตาล็อกกลางด้วย — ลบ/ปิดได้ที่เมนู "ข้อมูลยาง" เมื่อขึ้นใช้งานจริง
หมายเหตุ: project เดิมใน `.env.example` (`artdlrouxwvwpyfexjkw`) ไม่ได้ใช้แล้ว · รหัส DB ถูกส่งผ่านแชตตอนรัน — ควร Reset database password หลังจากนี้
ผ่าน `npx tsc --noEmit`, `npm run lint` (ไฟล์ที่แก้), `node --test scripts/*.test.mjs`, `next build` แล้ว

ทดสอบ UI แบบ end-to-end แล้ว (2026-11-09) บน Supabase local stack ชั่วคราวของโปรเจคนี้ (`supabase start` port 55321/55322 แยกจาก stack อื่น,
schema.sql + seed, บัญชี super/shop ทดสอบ) + `next dev` + headless Chrome (puppeteer-core) — ผ่าน 19/19:
Austone login → `/superadmin/shops/[id]/tires` เห็นเฉพาะยี่ห้อ AUSTONE → ติ๊ก 2 รุ่น → บันทึก (`setShopTireModels`) → หน้าร้านโชว์ "2 รุ่น" ·
ร้าน login → เพิ่มบริษัทจาก modal (`shop_create_company`) → ตารางโชว์ "ลิงก์ลูกค้า: ยังไม่สร้าง" → หน้าบริษัทกด "สร้างลิงก์" (`rotateCompanyPublicLink`) ได้ `/p/<32 ตัว>` ·
`/shop/service?company=` โชว์ "(2 รุ่น)" ไม่มีแถบเตือน · เปิดลิงก์ใน browser context ใหม่ไม่มี cookie → 200 เห็นชื่อบริษัท/ร้าน ไม่มีชื่อพนักงาน มี noindex ·
token ผิด → "ลิงก์นี้ใช้ไม่ได้" · ร้านกด "ปิดลิงก์" (`revokeCompanyPublicLink`) → ลิงก์เดิมใช้ไม่ได้ · หน้า public ที่มีประวัติจริง (ใส่/ถอด, ซีรีย์ UNK-, สาเหตุ, กรองรายคัน) render ถูกต้องบนจอมือถือ
Wizard ของร้านทดสอบผ่าน UI แล้วเช่นกัน (headless Chrome, 9 ขั้น): ทะเบียนใหม่ 70-1234 → หมวด "หัว" → "รถ 10 ล้อ" (`ensureServiceVehicleAction` สร้างรถ) → เลขไมล์ 120,000 →
เลือกล้อ "เพลา 1 ซ้าย" → ถอด: เลือก MICHELIN X-MULTI จากแคตตาล็อกกลาง + ติ๊ก "ไม่ทราบ/อ่านซีรีย์ไม่ได้" (ช่องซีรีย์หาย) + ดอก 4 มม. + สาเหตุหมดดอกยาง →
ใส่: "ยางใหม่" → dropdown มีเฉพาะ AUSTONE OH-110 / AT-118 (ไม่มี MICHELIN) → เลือก AT-118 + ซีรีย์ AU123456 → "บันทึก" → modal โชว์ "ไม่ทราบ (ระบบตั้งให้)" → "ยืนยันบันทึก" → toast "บันทึกเรียบร้อย 1 ล้อ"
ผลใน DB (`applyServiceBatchAction` → `apply_tire_ops`): vehicles 70-1234/10W/120000 · tires `UNK-261109-XT9BG` MICHELIN X-MULTI scrapped 4 มม. + `AU123456` AUSTONE AT-118 mounted A1L ·
tire_events 3 แถว (pre-mount ย้อนหลังของยางไม่ทราบซีรีย์, unmount หมดดอกยาง, mount) ผู้บันทึก = พนักงานร้าน · หน้า `/p/<token>` แสดงประวัติชุดนี้ครบ ไม่มีชื่อพนักงาน
ยังไม่ได้ทดสอบ runtime: เส้นทาง server ปฏิเสธรุ่นที่ไม่ได้รับ (`shopGrantViolation`) — UI กรองก่อนจึงยิงไม่ถึง มี unit test `tireMatchesGrant` ครอบ

ทดสอบระดับฐานข้อมูลแล้วบน Postgres ทดสอบแยก (stub auth/storage): schema ที่ git HEAD → 020 → 021 → 022 รันผ่าน, `verify_021/022.sql` ผ่าน,
scenario RLS/RPC ผ่านทั้งหมด (Austone กำหนดรุ่น · ร้านเห็นเฉพาะของตัวเอง/เขียนไม่ได้ · `shop_create_company` ให้สิทธิ์ตามร้าน ·
ร้านบันทึกรถ/ยาง/event · ร้านอื่นแก้ token ไม่ได้ · anon เปิดลิงก์ได้เฉพาะบริษัทนั้น ไม่มีชื่อพนักงาน · token ผิด/ปิดลิงก์/บริษัทปิด → null ·
anon อ่านตารางตรงได้ 0 แถว) และ `schema.sql` ติดตั้งใหม่ได้ object ชุดเดียวกับเส้นทาง migration (diff ว่าง)

**รอบ 2 (goal ที่ลูกค้าตั้งเพิ่ม 2026-11-09):** "Austone admin กำหนดข้อมูลยางให้แต่ละร้านค้า (dealer) · ร้านเก็บข้อมูลการเปลี่ยนยางให้ลูกค้า
และส่ง private link ให้ลูกค้าดูประวัติถอด-ใส่ยางของตัวเองแบบไม่ต้อง login" → ดูหัวข้อ "รอบ 2 — migration 022" ด้านล่าง

คำถาม 6 ข้อท้ายเอกสารยังไม่ได้รับคำตอบจากลูกค้า โค้ดจึงทำตามตัวเลือกที่แนะนำทุกข้อ ถ้าลูกค้าเลือกต่างออกไปให้ปรับตามหมายเหตุในแต่ละข้อ

หมายเหตุด้านสัญญา: เป็น requirement ใหม่ทั้งก้อน (บทบาทใหม่ ตารางใหม่ หน้าจอใหม่ 4 หน้า + หน้า Austone Thailand 2 หน้า) ควรออกเป็น Change Request ไม่ใช่ bug

## สิ่งที่ลูกค้าขอ (จากโน้ต)

ร้านค้าเปลี่ยนยางให้ลูกค้า (บริษัท) ใส่ทะเบียนรถ/บริษัท แล้วบริษัทเห็นข้อมูลรถตัวเอง โดยมีข้อจำกัด

| ข้อจำกัดที่ลูกค้าแจ้ง | วิธีที่ทำ |
| --- | --- |
| ไม่รู้ประเภทรถของบริษัทล่วงหน้า | บัญชีร้านค้าเห็นประเภทเพลาทุกแบบที่เปิดใช้งาน (RLS `axle_types_select` เพิ่ม `is_shop_user()`) และบริษัทที่ร้านสร้างจะได้สิทธิ์เพลาทุกแบบอัตโนมัติ ช่างร้านเลือกประเภทรถตอนบันทึกเหมือนเดิม |
| ยางที่ถอดอาจไม่ทราบซีรีย์ | ขั้น "ถอดยาง" ของร้านมีติ๊ก **ไม่ทราบ / อ่านซีรีย์ไม่ได้** → server ตั้งซีรีย์แทน `UNK-YYMMDD-XXXXX` (ไม่ซ้ำในบริษัท) ยังบังคับเลือกขนาด/รุ่น ดอกยาง และสาเหตุ รายงานแสดงป้าย "ไม่ทราบซีรีย์" |
| ยางที่ใส่ตั้งค่าล่วงหน้าไม่ได้ แต่ต้องเป็น AUSTONE เท่านั้น | (ปรับในรอบ 2) ขั้น "ใส่ยาง" ใช้ได้เฉพาะรุ่นที่ Austone กำหนดให้ร้าน (`shop_tire_models`) — รุ่นที่กำหนดให้ได้ต้องเป็นยี่ห้อ AUSTONE (`isShopMountBrand` ตรวจตอน Austone บันทึกสิทธิ์) กรองทั้ง client และ server (`tireMatchesGrant`) ยางเส้นเดิมในระบบที่ไม่ตรงรุ่นที่ได้รับใส่กลับไม่ได้ ส่วนยางที่ **ถอด** เป็นยี่ห้อใดก็ได้ (รวม "อื่นๆ") |
| เพิ่มบริษัทภายใต้ร้าน ตั้งชื่อก่อน บัญชีค่อยทำภายหลัง | ร้านเพิ่มบริษัทด้วยชื่ออย่างเดียวผ่าน RPC `shop_create_company` (ตั้ง `companies.shop_id` = ร้าน) หน้ารายละเอียดบริษัทมีปุ่ม "สร้างบัญชี" ให้ร้านสร้างแอดมิน/ช่างของบริษัทเมื่อพร้อม บริษัทล็อกอินแล้วเห็นรถ ยาง ประวัติของตัวเองในหน้าเดิมทุกอย่าง |
| ร้านมีหน้าที่แค่กรอกถอด-ใส่ + รายงานต่อบริษัท | เมนูร้านมี 3 หน้า: บริษัทลูกค้า / บันทึกถอด-ใส่ยาง / รายงานการเปลี่ยนยาง (กรองบริษัท + ช่วงวันที่, ส่งออก Excel) ไม่มีคลังยาง ไม่มีแดชบอร์ด |
| database ต้องแยกแต่ละบริษัท | ไม่เปลี่ยนโมเดลข้อมูล: รถ ยาง ประวัติ ยังผูก `company_id` ของแต่ละบริษัทเหมือนเดิม ร้านเข้าถึงได้เฉพาะแถวของบริษัทที่ `shop_id` ตรงกับร้าน (`company_in_my_shop()`) บริษัทไม่เห็นข้อมูลกันเอง และไม่เห็นว่าร้านมีลูกค้ารายอื่น |

## สิ่งที่พบในโปรเจค (ก่อนแก้)

- บทบาทมี 3 แบบ: `super_admin` (Austone Thailand), `admin`, `technician` — profile ผูกบริษัทเดียว (`profiles_company_required`)
- ทุกตาราง tenant ใช้ RLS `company_id = current_company_id()` จึงต้องเพิ่มเงื่อนไขร้านค้าเข้าไปทุก policy แทนการสร้างตารางใหม่
- หน้าช่าง (`service-wizard.tsx` 2,244 บรรทัด) ผูกกับบริษัทของ session ผ่าน `profile.company_id!` ใน `applyServiceBatchAction` / `ensureServiceVehicleAction` และค้นซีรีย์ซ้ำโดยอาศัย RLS คัดบริษัทให้ — พอร้านเห็นหลายบริษัท ต้องกรอง `company_id` เองทุกจุด
- `seed.sql` อ้างยี่ห้อ AUSTONE ในรุ่นตัวอย่างแต่ไม่มียี่ห้อนี้ในตาราง `tire_brands` และมี comma เกินทำให้ไฟล์รันไม่ผ่าน — แก้ให้แล้ว

## การออกแบบ

### ฐานข้อมูล (migration 020 + 021)

```
shops ──┬── profiles (role = 'shop', shop_id)      พนักงานร้าน
        └── companies.shop_id (null = ลูกค้าตรง)   บริษัทที่ร้านดูแล
companies ── vehicles / tires / tire_events / ...  ไม่เปลี่ยน
```

- `020_shop_role.sql`: `alter type user_role add value 'shop'` — ต้องรันแยกไฟล์ก่อน เพราะ Postgres ไม่ให้ใช้ค่า enum ใหม่ในทรานแซกชันเดียวกัน
- `021_shops.sql`: ตาราง `shops` (รหัส S0001.. จาก `shop_code_seq`), คอลัมน์ `companies.shop_id`, `profiles.shop_id`, constraint `profiles_tenant_check` แทน `profiles_company_required`, helper `current_shop_id()` / `is_shop_user()` / `company_in_my_shop(uuid)`, RLS ทุกตารางที่เกี่ยว, insert ยี่ห้อ AUSTONE, RPC `shop_create_company`
- RPC `mount_tire` / `unmount_tire` / `apply_tire_ops` ไม่ต้องแก้: เป็น security invoker ใช้ `company_id` ของยาง ซึ่ง RLS ใหม่ยอมให้ร้านเขียนอยู่แล้ว
- ตรวจผลด้วย `supabase/scripts/verify_021.sql`

### สิทธิ์ของบัญชีร้านค้า

| ตาราง | อ่าน | เขียน |
| --- | --- | --- |
| shops | ร้านตัวเอง | ไม่ได้ (Austone Thailand) |
| companies | บริษัทที่ `shop_id` = ร้าน | insert ผ่าน RPC, update ข้อมูลติดต่อได้ แต่ย้ายร้านไม่ได้ |
| profiles | เพื่อนร่วมร้าน + บัญชีของบริษัทภายใต้ร้าน | สร้างบัญชีบริษัทผ่าน service role (`createTeamMember` ตรวจ `resolveCompanyScope`) |
| vehicles / tires / tire_events / tire_imports | เฉพาะบริษัทภายใต้ร้าน | เหมือนอ่าน |
| axle_types | ทุกแบบ | ไม่ได้ |
| tire_models / tire_brands | แคตตาล็อกกลางทั้งหมด | ไม่ได้ (ร้านเพิ่มรุ่นเองไม่ได้ — กันข้อมูลยี่ห้อปนเปื้อน) |

### โค้ดฝั่งแอป

- `src/lib/company-scope.ts`: `resolveCompanyScope` รองรับ role `shop` (ต้องส่ง `companyId` และบริษัทต้องอยู่ภายใต้ร้าน) + `resolveServiceScope(companyId?)` สำหรับงานหน้าช่าง คืน `isShop` ให้เปิดกฎร้านค้า
- `src/lib/shop-rules.ts`: `SHOP_MOUNT_BRAND`, `isShopMountBrand`, `generateUnknownSerial`, `isUnknownSerial` (มีเทสต์ `scripts/shop-rules.test.mjs`)
- `src/lib/service-data.ts`: `loadServiceWizardData(supabase, companyId, 'granted' | 'central')` ใช้ร่วมกันระหว่าง `/service` และ `/shop/service`
- `service/actions.ts`: รับ `company_id` (ไม่บังคับ), ตรวจรถ/ยางที่อ้างถึงเป็นของบริษัทนั้นจริง, กรองค้นซีรีย์ซ้ำด้วย `company_id`, ตั้งซีรีย์แทนเมื่อ `unknown_serial`, บังคับยี่ห้อ AUSTONE ตอนใส่เมื่อผู้บันทึกเป็นร้าน
- `service-wizard.tsx`: props ใหม่ `companyId`, `mountBrandLock`, `allowUnknownSerial` — หน้าช่างของบริษัทไม่ส่ง จึงทำงานเหมือนเดิมทุกประการ
- หน้าใหม่ฝั่งร้าน `src/app/(shop)/…`: `/shop`, `/shop/companies/[id]`, `/shop/service`, `/shop/reports`
- หน้าใหม่ฝั่ง Austone Thailand: `/superadmin/shops`, `/superadmin/shops/[id]` + ช่อง "ร้านค้าที่ดูแล" ในฟอร์มลูกค้า

## รอบ 2 — migration 022 (Austone กำหนดรุ่นยางให้ร้าน + private link ให้ลูกค้า)

```
shops ── shop_tire_models ── tire_models        Austone ติ๊กรุ่น AUSTONE ที่ร้านใส่ได้
companies.public_token                           ร้านสร้างลิงก์ /p/<token> ให้ลูกค้า (ไม่ต้อง login)
public_company_history(token) [security definer] หน้า public อ่านผ่าน RPC นี้ตัวเดียว (anon)
```

- **Austone กำหนดรุ่นยางให้ร้าน** — `/superadmin/shops/[id]/tires` (ใช้ `TireAccessClient` ตัวเดิม ส่ง `save` เป็น `setShopTireModels`)
  รับเฉพาะรุ่นกลางยี่ห้อ AUSTONE ที่เปิดใช้งาน · รุ่นที่เพิ่มจะ upsert เข้า `company_tire_models` ของบริษัททุกรายใต้ร้าน (บริษัทที่มีบัญชีจะเห็นรุ่นที่ร้านใส่ให้)
  รุ่นที่ถอดออกจากร้าน **ไม่** ถอนจากบริษัท เพราะอาจมียางรุ่นนั้นติดรถอยู่ · `shop_create_company` เปลี่ยนจาก "AUSTONE ทุกรุ่น" เป็น "รุ่นที่ร้านได้รับ"
- **ร้านใส่ยาง** — `/shop/service` โหลด `loadShopGrantModels` ส่ง `mountModelIds` ให้ wizard (แทน prop `mountBrandLock` เดิม) · ร้านที่ยังไม่ได้รับรุ่นเลยจะเห็นแถบเตือน ถอดได้ ใส่ไม่ได้
  server: `applyServiceBatchAction` ตรวจ `tireMatchesGrant` ทั้ง manual_mount (รหัสรุ่น), ยางเดิมตามซีรีย์ และยางที่อ้างด้วย id (ยางเก่าไม่มี `tire_model_id` → เทียบชื่อยี่ห้อ+รุ่น)
- **Private link** — ร้านกด "สร้างลิงก์" ที่หน้า `/shop/companies/[id]` (การ์ดบนสุด) → `rotateCompanyPublicLink` สุ่ม token 32 ตัว base64url (24 ไบต์ Web Crypto, `src/lib/public-link.ts`)
  คัดลอก/เปิดดู/สร้างใหม่ (ลิงก์เดิมตาย)/ปิดลิงก์ · ตาราง `/shop` มีคอลัมน์ "ลิงก์ลูกค้า" · origin ของลิงก์มาจาก `NEXT_PUBLIC_APP_URL` หรือ header ของ request (`src/lib/app-url.ts`)
- **หน้า public `/p/[token]`** (`src/app/(public)/`) — ไม่มี AppShell, `robots: noindex`, middleware ปล่อย path `/p/` ไม่ต้อง login
  แสดง: ชื่อบริษัท + ร้านที่เปลี่ยนให้ (ชื่อ/โทร), tile สรุป, chip เลือกรถ (`?v=`), รายการถอด-ใส่แบบการ์ด (ซีรีย์ UNK- แสดงเป็น "ไม่ทราบซีรีย์")
  RPC คืน null เมื่อ token ไม่ตรง/บริษัทปิดใช้งาน/token สั้นกว่า 20 → หน้า "ลิงก์นี้ใช้ไม่ได้" ข้อความเดียวทุกกรณี · **ไม่เปิดเผยชื่อพนักงานร้าน** (ใช้ชื่อร้านแทน) · จำกัด 1,000 รายการล่าสุด
- ความปลอดภัย: anon ไม่มี policy ใดเลย token จึงเป็นกุญแจเดียว (≈192 บิต) · `revoke all … from public` แล้ว grant เฉพาะ anon/authenticated · ยังไม่มี rate limit ที่ชั้นแอป (Supabase มีของตัวเอง) ถ้ากังวลเพิ่ม middleware นับครั้งต่อ IP ภายหลัง
- ทดสอบ: `scripts/public-link.test.mjs` (4) + grant helpers ใน `scripts/shop-rules.test.mjs` (1) · ตรวจ DB ด้วย `supabase/scripts/verify_022.sql`

## รอบ 3 (2026-11-09) — คำศัพท์ + ร้านจัดการช่างเอง + แก้ลูป redirect

- ฝั่งร้านเปลี่ยนคำ "บริษัท/บริษัทลูกค้า" → "ลูกค้า" ทั้งหมด (ลูกค้าของร้านอาจเป็นบุคคลธรรมดา) · ตาราง `companies` ชื่อเดิม
- หน้าใหม่ `/shop/staff` "ช่างของร้าน" (`src/app/(shop)/shop/staff/`): เพิ่ม/แก้ไข/ตั้งรหัสผ่าน/เปิด-ปิด/ลบ บัญชีพนักงานร้าน
  ทำผ่าน service role + ตรวจ `assertSameShop` ทุก action (RLS ไม่เปิดให้ร้านเขียน profiles) · ทุกบัญชีร้านเป็น role `shop` เท่ากัน จึงจัดการกันเองได้ทุกคน
  → คำถามข้อ 11: ต้องแยก "หัวหน้าร้าน" กับ "ช่าง" ไหม (ถ้าต้อง เพิ่ม role `shop_admin` + enum migration + จำกัด action ชุดนี้)
- **บั๊กเดิมที่พบจากการทดสอบ:** บัญชีที่ถูกปิดใช้งาน (profile `is_active=false`) ยัง login ผ่าน Supabase ได้ → `requireSession` เด้ง `/login` → middleware เห็นว่ามี user เด้งกลับ `/` → `ERR_TOO_MANY_REDIRECTS`
  แก้โดย `redirectToLogin()` ใน `src/lib/auth.ts`: ถ้ายังมี auth user ให้ไป `GET /auth/signout?reason=inactive` (sign out แล้วกลับ `/login?reason=inactive` แสดง "บัญชีนี้ถูกปิดใช้งานแล้ว") — กระทบทุก role รวมช่างของบริษัทเดิม
- E2E บน project จริง: staff flow ผ่าน 9/9 (เพิ่ม → แก้ไข → รีเซ็ตรหัส → ช่างใหม่ login ได้ → ปิดใช้งาน → login แล้วถูก sign out พร้อมข้อความ)
- ข้อมูลทดสอบเพิ่ม: บัญชีช่าง `tech.demo@dreammakerthai.com` (เปิดใช้งานกลับแล้ว)

## รอบ 4 (2026-11-09) — สิทธิ์ทีม Austone: เซล + แอดมิน Austone (migration 024/025)

ลูกค้าตอบ: เซล = ดู + จัดการดีลเลอร์ · แอดมิน Austone = ทุกอย่างยกเว้นจัดการบัญชีทีม Austone

- enum เพิ่ม `austone_admin`, `sales` (024 รันเดี่ยว) · 025: `is_super_admin()` ครอบ austone_admin ด้วย (policy เขียนเดิมทั้งหมดจึงใช้ได้), `is_austone_staff()` ใช้กับ policy อ่าน + shops/shop_tire_models,
  `is_true_super_admin()` ใช้กับ profiles ของทีม Austone · constraint `profiles_tenant_check` รับ role ใหม่ · trigger `propagate_shop_tire_model` ย้ายการเปิดสิทธิ์รุ่นให้ลูกค้าของร้านลง DB (เซลเขียน company_tire_models ไม่ได้)
- แอป: `src/lib/roles.ts` (`AUSTONE_ROLES` / `AUSTONE_WRITE_ROLES` / `DEALER_MANAGER_ROLES` / `TEAM_MANAGER_ROLES`) · หน้า `(super)` ทุกหน้าเปิดให้ทีม Austone อ่าน · action เขียนข้อมูลกลาง = super/austone_admin · action ร้านค้า = รวม sales ·
  หน้าใหม่ `/superadmin/team` เมนู "ผู้ใช้งาน" (เฉพาะ super) · client ฝั่ง Austone รับ `readOnly` ซ่อนปุ่มเพิ่ม/แก้/ลบสำหรับเซล (catalog, axle-types, reasons, companies, tire/axle access, users) ·
  action ฝั่ง `(app)` ที่เคยยอม `super_admin` ทำแทนลูกค้า ตอนนี้ยอม `AUSTONE_WRITE_ROLES` (ไม่รวมเซล)
- ยังไม่ซ่อนปุ่มแก้ไขในแท็บ "รถ"/"คลังยาง" ของลูกค้าปลายทางสำหรับเซล (component ใช้ร่วมกับฝั่งบริษัท) — server ปฏิเสธอยู่แล้ว ถ้าเซลกดจะถูกเด้งกลับ
- **ยังไม่ได้รัน 024/025 บน Supabase จริง** — เครื่องมือบล็อกการรันบน production ต้องให้ทีมรันเอง (SQL Editor: 024 ก่อน แล้ว 025)
- คำถามข้อ 12: เซลควรเห็น "ลูกค้าปลายทางทั้งหมด" + แท็บรถ/คลังยาง/ผู้ใช้ของลูกค้าไหม — ทำไว้: เห็น (อ่านอย่างเดียว) ถ้าไม่ควรเห็นให้จำกัดใน `(super)/superadmin/companies/**` ด้วย `canEditCentral`

## รอบ 5 (2026-11-09) — หน้าร้านค้า/ดีลเลอร์แบบแท็บ (เหมือนหน้าลูกค้าปลายทาง)

`/superadmin/shops/[id]` มี layout + แท็บ (`shop-tabs.tsx`): **ภาพรวม** (tile ลูกค้า/รถ/ยางบนรถ/ยางในคลัง/ผู้ใช้ร้าน, รุ่นที่กำหนด, งานล่าสุดรวมทุกลูกค้า) ·
**ลูกค้าของร้าน** (`/customers` ตารางลูกค้า + ทางลัดไปแท็บรถ/คลังยางของลูกค้ารายนั้น) · **คลังยาง** (`/stock` ยางทุกเส้นของทุกลูกค้าของร้าน ดูอย่างเดียว กรองรายลูกค้าได้ ใช้ `TiresClient` ตัวเดิม) ·
**สิทธิ์ยาง** (`/tires` กำหนดรุ่น AUSTONE) · **ผู้ใช้งาน** (`/users` บัญชีร้าน) · ตัวช่วยโหลดอยู่ใน `shop-data.ts`

## รอบ 6 (2026-11-09) — ปลดล็อกยี่ห้อ

Austone กำหนดรุ่นยางให้ร้านได้ **ทุกยี่ห้อ** ในแคตตาล็อกกลาง (เดิมจำกัด AUSTONE) — ตัดการตรวจยี่ห้อใน `setShopTireModels` และตัวกรองในแท็บสิทธิ์ยาง · ร้านยังใส่ได้เฉพาะรุ่นที่ได้รับเหมือนเดิม · `isShopMountBrand` คงไว้ในโค้ด/เทสต์เผื่อเปิดกลับ

## รอบ 7 (2026-11-09) — ยาง "อื่นๆ" เป็นตัวเลือกที่กำหนดให้ร้าน/ลูกค้าได้

- project ใหม่ไม่มียี่ห้อ `อื่นๆ` (migration 010 ไม่ได้รัน) ลูกค้าสร้างเอง "ยางอื่น ๆ" + รุ่น "-" → โค้ดรับการสะกดนี้แล้ว (`isOtherBrand` ย้ายไป `src/lib/other-brand.ts` + เทสต์) · seed.sql เพิ่มยี่ห้อ `อื่นๆ` + รุ่นต่อขนาดสำหรับติดตั้งใหม่
- แท็บสิทธิ์ยางของร้านแสดงทุกยี่ห้อกลาง (ยี่ห้อว่างมีลิงก์ไปเพิ่มรุ่น) และเรียง "อื่นๆ" ไว้ท้าย · ร้าน/ลูกค้าใช้ "อื่นๆ" ได้เมื่อถูกติ๊กให้ — ตอนใส่ wizard บังคับหมายเหตุยี่ห้อ/รุ่นจริง
- **ข้อมูลบน DB จริงที่ต้องแก้เอง** (เครื่องมือบล็อกการแก้ข้อมูลใน project จริง): เมนู "ข้อมูลยาง" → เปิดใช้งานยี่ห้อ "ยางอื่น ๆ" (ตอนนี้ปิดอยู่) → แก้/เพิ่มรุ่นชื่อ "อื่นๆ" ให้ครบขนาดที่ใช้ (295/80R22.5, 11R22.5) แล้วลบรุ่น "-" ขนาด "-" → ไปแท็บสิทธิ์ยางของร้านติ๊กให้

## ลำดับการ deploy

1. รัน `supabase/migrations/020_shop_role.sql` เป็นคำสั่งเดี่ยว ๆ (ห้ามรวมกับไฟล์อื่น)
2. รัน `supabase/migrations/021_shops.sql`
3. รัน `supabase/scripts/verify_021.sql` ตรวจว่า enum มี `shop`, คอลัมน์ `shop_id` ครบ, ฟังก์ชัน 4 ตัว, ยี่ห้อ AUSTONE มีแล้ว
4. รัน `supabase/migrations/022_shop_catalog_public_links.sql` แล้วตรวจด้วย `supabase/scripts/verify_022.sql`
5. Austone Thailand เพิ่มรุ่นยาง AUSTONE ในเมนู "ข้อมูลยาง" (ถ้ายังไม่มี)
6. Austone Thailand สร้างร้านที่ `/superadmin/shops` → **กำหนดรุ่นยาง** ที่ `/superadmin/shops/[id]/tires` → สร้างบัญชีพนักงานร้าน
7. ตั้ง `NEXT_PUBLIC_APP_URL` (เช่น `https://tire.example.com`) ใน environment ของ production เพื่อให้ลิงก์ลูกค้าถูก domain แน่นอน (ไม่ตั้งก็ใช้ host จาก request)
8. deploy แอป

## คำถามที่ต้องยืนยันกับลูกค้า

1. **ใครสร้างบัญชีให้บริษัทที่ร้านเพิ่ม** — ทำไว้: ร้านสร้างเองได้จากหน้ารายละเอียดบริษัท (และ Austone Thailand ก็ทำได้) ถ้าลูกค้าต้องการให้ Austone Thailand เท่านั้น ให้ลบ `createShopCompanyUser` และปุ่ม "สร้างบัญชี" ใน `company-detail-client.tsx`
2. **บริษัทภายใต้ร้านควรเห็นว่าร้านไหนเปลี่ยนให้ไหม** — ทำไว้: ยังไม่แสดงชื่อร้านฝั่งบริษัท (ประวัติบันทึก "ผู้บันทึก" เป็นชื่อพนักงานร้าน) ถ้าต้องการ เพิ่มชื่อร้านในหน้า `/company` และตารางประวัติ
3. **บริษัทที่ร้านสร้าง ได้แพ็กเกจอะไร** — ทำไว้: Standard (ค่า default) Austone Thailand เปลี่ยนได้ที่หน้าลูกค้าเหมือนเดิม
4. **ซีรีย์ "ไม่ทราบ" ควรแก้เป็นซีรีย์จริงภายหลังได้ไหม** — ทำไว้: ยังแก้ไม่ได้จาก UI (ซีรีย์เป็นตัวระบุยาง) ถ้าต้องการ ต้องเพิ่มฟอร์มแก้ซีรีย์ที่หน้าคลังยางของแอดมินบริษัท
5. **ร้านควรถอด-ใส่ยางให้บริษัทที่เป็นลูกค้าตรงของ Austone Thailand (ไม่มี shop_id) ได้ไหม** — ทำไว้: ไม่ได้ ต้องให้ Austone Thailand ตั้ง "ร้านค้าที่ดูแล" ให้บริษัทนั้นก่อน (บริษัทหนึ่งอยู่ได้ร้านเดียว)
6. **ร้านเดียวกันต้องมีหลายสาขา/หลายช่างแยกรายงานไหม** — ทำไว้: บัญชีพนักงานร้านทุกคนเห็นเท่ากัน รายงานบอกชื่อผู้บันทึกต่อรายการ ถ้าต้องแยกสาขาให้เพิ่ม `profiles.branch` ภายหลัง
7. **(รอบ 2) ลิงก์ลูกค้าควรหมดอายุเองไหม** — ทำไว้: ไม่หมดอายุ จนกว่าร้านจะสร้างใหม่/ปิด ถ้าต้องการ เพิ่ม `public_token_expires_at` แล้วเช็คใน RPC
8. **(รอบ 2) ลิงก์ลูกค้าควรเป็นระดับบริษัท (ทุกคัน) หรือระดับรถ (คันเดียว)** — ทำไว้: ระดับบริษัท มี chip กรองรายคันในหน้า ถ้าลูกค้าต้องการแจกลิงก์ให้คนขับรายคัน ต้องเพิ่ม `vehicles.public_token`
9. **(รอบ 2) บริษัทลูกค้ายังต้องมีบัญชี login ไหม** — ทำไว้: ยังสร้างได้ (ปุ่ม "สร้างบัญชี" คงอยู่) แต่ไม่บังคับ — ถ้าลูกค้าตัดสินใจใช้ลิงก์อย่างเดียว ให้ซ่อนการ์ด "บัญชีผู้ใช้ของบริษัท" ในหน้า `/shop/companies/[id]`
10. **(รอบ 2) ถอดรุ่นออกจากร้านแล้วควรถอนสิทธิ์จากบริษัทลูกค้าด้วยไหม** — ทำไว้: ไม่ถอน (กันข้อมูลรถที่มียางรุ่นนั้นพัง) ถ้าต้องการให้เพิ่มใน `setShopTireModels`

## สิ่งที่ยังไม่ได้ทำ / ข้อควรระวัง

- ยังไม่ได้ทดสอบ end-to-end บน Supabase จริง (ต้องรัน 020/021 ก่อน) — โดยเฉพาะ RLS ของ `tire_overview` (view ใช้สิทธิ์ของผู้เรียก จึงควรเห็นข้อมูลบริษัทภายใต้ร้านผ่าน policy ใหม่ของ `tires`)
- `scripts/create-company-user.mjs` ยังรับเฉพาะ admin/technician — สร้างบัญชีร้านผ่านหน้า Austone Thailand แทน
- `.env.example` มีค่า `SUPABASE_SERVICE_ROLE_KEY` ที่ดูเป็นคีย์จริงอยู่ในไฟล์ที่ commit — ควร rotate คีย์และแทนด้วย placeholder (ไม่ได้แก้ในรอบนี้เพราะเป็นไฟล์ credential)
