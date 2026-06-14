import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import UploadFunnel from '@/components/UploadFunnel'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const supabase = await createClient()
  const { data: wedding } = await supabase
    .from('weddings')
    .select('couple_names, date')
    .eq('slug', slug)
    .maybeSingle()

  if (!wedding) return { title: 'Álbum de boda' }

  const dateStr = wedding.date
    ? new Date(wedding.date + 'T12:00:00').toLocaleDateString('es-ES', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null

  const title = `💍 Boda de ${wedding.couple_names}`
  const description = dateStr
    ? `${dateStr} · Comparte tus fotos y videos del gran día. ¡Es muy fácil, sin registros ni aplicaciones!`
    : `Comparte tus fotos y videos de la boda. ¡Es muy fácil, sin registros ni aplicaciones!`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      locale: 'es_ES',
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
  }
}

export default async function BodaPage({ params }: Props) {
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
