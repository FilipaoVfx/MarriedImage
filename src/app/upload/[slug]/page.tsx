import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import UploadFunnel from '@/components/UploadFunnel'

export default async function UploadPage({ params }: { params: { slug: string } }) {
  const supabase = await createClient()

  const { data: wedding } = await supabase
    .from('weddings')
    .select('id, name, couple_names, date')
    .eq('slug', params.slug)
    .single()

  if (!wedding) notFound()

  return <UploadFunnel wedding={wedding} />
}
