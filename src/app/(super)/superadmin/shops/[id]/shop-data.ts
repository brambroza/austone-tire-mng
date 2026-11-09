/**
 * ตัวช่วยโหลดข้อมูลของร้านค้า/ดีลเลอร์ 1 ราย — ใช้ร่วมกันทุกแท็บใน /superadmin/shops/[id]
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Company, Database } from '@/lib/database.types'

type Supabase = SupabaseClient<Database>

/**
 * ลูกค้าปลายทางทุกรายของร้าน (เรียงตามชื่อ)
 * @param supabase client ของทีม Austone
 * @param shopId ร้านค้า
 */
export async function loadShopCustomers(supabase: Supabase, shopId: string): Promise<Company[]> {
  const { data } = await supabase.from('companies').select('*').eq('shop_id', shopId).order('name')
  return (data ?? []) as Company[]
}

/**
 * แผนที่ company_id → ชื่อลูกค้า สำหรับใส่คอลัมน์ "ลูกค้า" ในตารางรวมของร้าน
 * @param companies ลูกค้าของร้าน
 */
export function companyNameMap(companies: Pick<Company, 'id' | 'name'>[]): Map<string, string> {
  return new Map(companies.map((c) => [c.id, c.name]))
}
