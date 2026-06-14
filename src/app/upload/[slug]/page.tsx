import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import UploadFunnel from '@/components/UploadFunnel'

export default async function UploadPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  if (!slug || slug.length > 64) notFound()

  const supabase = await createClient()

  const { data: wedding, error } = await supabase
    .from('weddings')
    .select('id, name, couple_names, date')
    .eq('slug', slug)
    .maybeSingle()

  if (error) throw new Error('No se pudo cargar el evento.')
  if (!wedding) notFound()

  return <UploadFunnel wedding={wedding} />
}
