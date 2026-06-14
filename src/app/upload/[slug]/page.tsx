import { redirect } from 'next/navigation'

// Legacy route — redirects to the friendlier /boda/[slug] URL.
export default async function UploadRedirect({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  redirect(`/boda/${slug}`)
}
