import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import WeddingGallery from '@/components/WeddingGallery'
import { isValidUUID } from '@/lib/validation'

export default async function WeddingPage({
  params,
}: {
  params: Promise<{ weddingId: string }>
}) {
  const { weddingId } = await params

  // Guard against non-UUID values so Postgres never throws a 500.
  if (!isValidUUID(weddingId)) notFound()

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/')

  const { data: wedding, error: weddingError } = await supabase
    .from('weddings')
    .select('*')
    .eq('id', weddingId)
    .maybeSingle()

  if (weddingError) throw new Error('No se pudo cargar la boda.')
  if (!wedding) notFound()

  const { data: photos } = await supabase
    .from('photos')
    .select('*')
    .eq('wedding_id', weddingId)
    .order('created_at', { ascending: false })

  return <WeddingGallery wedding={wedding} photos={photos ?? []} />
}
