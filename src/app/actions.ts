'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { generateSlug, validateWeddingInput } from '@/lib/validation'

type ActionState = { error?: string; success?: boolean } | null

function readCredentials(formData: FormData) {
  const email = (formData.get('email') as string | null)?.trim() ?? ''
  const password = (formData.get('password') as string | null) ?? ''
  return { email, password }
}

export async function signIn(_: unknown, formData: FormData): Promise<ActionState> {
  const { email, password } = readCredentials(formData)
  if (!email || !password) {
    return { error: 'Introduce tu email y contraseña.' }
  }

  try {
    const supabase = await createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      return { error: 'Email o contraseña incorrectos.' }
    }
  } catch {
    return { error: 'No se pudo conectar. Inténtalo de nuevo.' }
  }

  redirect('/dashboard')
}

export async function signUp(_: unknown, formData: FormData): Promise<ActionState> {
  const { email, password } = readCredentials(formData)
  if (!email || !password) {
    return { error: 'Introduce tu email y contraseña.' }
  }
  if (password.length < 6) {
    return { error: 'La contraseña debe tener al menos 6 caracteres.' }
  }

  try {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) {
      return { error: error.message }
    }
    // Email-confirmation flows return a user without a session.
    if (!data.session) {
      return { success: true, error: undefined }
    }
  } catch {
    return { error: 'No se pudo conectar. Inténtalo de nuevo.' }
  }

  redirect('/dashboard')
}

export async function signOut(): Promise<void> {
  try {
    const supabase = await createClient()
    await supabase.auth.signOut()
  } catch {
    // Ignore — we redirect home regardless.
  }
  redirect('/')
}

export async function createWedding(
  _: unknown,
  formData: FormData
): Promise<ActionState> {
  const validation = validateWeddingInput({
    name: formData.get('name'),
    couple_names: formData.get('couple_names'),
    date: formData.get('date'),
  })
  if (!validation.ok) {
    return { error: validation.error }
  }
  const { name, coupleNames, date } = validation.value

  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { error: 'Tu sesión expiró. Vuelve a iniciar sesión.' }
    }

    // Retry a few times to dodge the rare unique-slug collision.
    let lastError: string | null = null
    for (let attempt = 0; attempt < 5; attempt++) {
      const slug = generateSlug(coupleNames)
      const { error } = await supabase.from('weddings').insert({
        name,
        couple_names: coupleNames,
        date,
        slug,
        owner_id: user.id,
      })

      if (!error) {
        revalidatePath('/dashboard')
        return { success: true }
      }

      // 23505 = unique_violation → regenerate slug and retry.
      if (error.code === '23505') {
        lastError = 'No se pudo generar un enlace único. Inténtalo otra vez.'
        continue
      }

      return { error: 'No se pudo crear la boda. Inténtalo de nuevo.' }
    }

    return { error: lastError ?? 'No se pudo crear la boda.' }
  } catch {
    return { error: 'No se pudo conectar. Inténtalo de nuevo.' }
  }
}
