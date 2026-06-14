import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import WeddingGallery from '@/components/WeddingGallery'

export default async function WeddingPage({ params }: { params: { weddingId: string } }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/')

  const { data: wedding } = await supabase
    .from('weddings')
    .select('*')
    .eq('id', params.weddingId)
    .single()

  if (!wedding) notFound()

  const { data: photos } = await supabase
    .from('photos')
    .select('*')
    .eq('wedding_id', params.weddingId)
    .order('created_at', { ascending: false })

  return <WeddingGallery wedding={wedding} photos={photos || []} />
}
