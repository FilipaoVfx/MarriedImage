import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import DashboardClient from '@/components/DashboardClient'

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/')

  const { data: weddings } = await supabase
    .from('weddings')
    .select('*')
    .order('created_at', { ascending: false })

  return <DashboardClient user={user} weddings={weddings || []} />
}
