'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

export async function signIn(_: unknown, formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { error: error.message }

  redirect('/dashboard')
}

export async function signUp(_: unknown, formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const supabase = await createClient()

  const { error } = await supabase.auth.signUp({ email, password })
  if (error) return { error: error.message }

  redirect('/dashboard')
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/')
}

export async function createWedding(_: unknown, formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/')

  const name = formData.get('name') as string
  const coupleNames = formData.get('couple_names') as string
  const date = formData.get('date') as string
  const slug = formData.get('slug') as string

  const { error } = await supabase.from('weddings').insert({
    name,
    couple_names: coupleNames,
    date: date || null,
    slug,
    owner_id: user.id,
  })

  if (error) return { error: error.message }

  revalidatePath('/dashboard')
  return { success: true }
}
