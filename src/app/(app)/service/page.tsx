import { requireSession } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { loadServiceWizardData } from '@/lib/service-data'
import { PageHeader } from '@/components/app-shell'
import { ServiceWizard } from './service-wizard'

export const metadata = { title: 'บันทึกถอด-ใส่ยาง · Austone Tire' }

export default async function ServicePage({
  searchParams,
}: {
  searchParams: Promise<{ vehicle?: string }>
}) {
  const { company } = await requireSession(['admin', 'technician'])
  const { vehicle } = await searchParams
  const supabase = await createClient()

  // แอดมิน/ช่างผูกกับบริษัทเสมอ (profiles_tenant_check) — ถ้าไม่มีให้แสดงหน้าว่าง
  const data = company
    ? await loadServiceWizardData(supabase, company.id, 'granted')
    : { vehicles: [], tires: [], reasons: [], axleTypes: [], models: [] }

  return (
    <>
      <PageHeader
        title="บันทึกการถอด-ใส่ยาง"
        subtitle=""
      />
      <ServiceWizard
        vehicles={data.vehicles}
        tires={data.tires}
        reasons={data.reasons}
        axleTypes={data.axleTypes}
        models={data.models}
        initialVehicleId={vehicle}
      />
    </>
  )
}
