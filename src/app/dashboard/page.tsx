import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import DashboardClient from '@/components/DashboardClient'

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/')

  const { data: weddings, error } = await supabase
    .from('weddings')
    .select('*')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })

  if (error) throw new Error('No se pudieron cargar tus bodas.')

  return <DashboardClient user={user} weddings={weddings ?? []} />
}
