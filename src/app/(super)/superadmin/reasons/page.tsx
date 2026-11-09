import { requireSession } from '@/lib/auth'
import { AUSTONE_ROLES, canEditCentral } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/app-shell'
import { ReasonsClient } from './reasons-client'
import type { RemovalReason } from '@/lib/database.types'

export const metadata = { title: 'สาเหตุการถอดยาง · Austone Tire Admin' }

export default async function ReasonsPage() {
  const { profile } = await requireSession(AUSTONE_ROLES)
  const supabase = await createClient()

  const { data } = await supabase
    .from('removal_reasons')
    .select('*')
    .order('sort_order')

  return (
    <>
      <PageHeader
        title="สาเหตุการถอดยาง"
        subtitle="สาเหตุที่ช่างเลือกได้ตอนถอดยาง"
      />
      <ReasonsClient reasons={(data ?? []) as RemovalReason[]} readOnly={!canEditCentral(profile.role)} />
    </>
  )
}
