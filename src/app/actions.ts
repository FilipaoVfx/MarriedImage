'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { generateSlug, validateWeddingInput, isValidUUID } from '@/lib/validation'

type ActionState = { error?: string; success?: boolean } | null

function readCredentials(formData: FormData) {
  const email = (formData.get('email') as string | null)?.trim() ?? ''
  const password = (formData.get('password') as string | null) ?? ''
  return { email, password }
}

async function requireUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { user: null, supabase }
  return { user, supabase }
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function signIn(_: unknown, formData: FormData): Promise<ActionState> {
  const { email, password } = readCredentials(formData)
  if (!email || !password) return { error: 'Introduce tu email y contraseña.' }

  try {
    const supabase = await createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error: 'Email o contraseña incorrectos.' }
  } catch {
    return { error: 'No se pudo conectar. Inténtalo de nuevo.' }
  }

  redirect('/dashboard')
}

export async function signUp(_: unknown, formData: FormData): Promise<ActionState> {
  const { email, password } = readCredentials(formData)
  if (!email || !password) return { error: 'Introduce tu email y contraseña.' }
  if (password.length < 6) return { error: 'La contraseña debe tener al menos 6 caracteres.' }

  try {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) return { error: error.message }
    if (!data.session) return { success: true }
  } catch {
    return { error: 'No se pudo conectar. Inténtalo de nuevo.' }
  }

  redirect('/dashboard')
}

export async function signOut(): Promise<void> {
  try {
    const supabase = await createClient()
    await supabase.auth.signOut()
  } catch {}
  redirect('/')
}

// ─── Weddings ─────────────────────────────────────────────────────────────────

export async function createWedding(_: unknown, formData: FormData): Promise<ActionState> {
  const validation = validateWeddingInput({
    name: formData.get('name'),
    couple_names: formData.get('couple_names'),
    date: formData.get('date'),
  })
  if (!validation.ok) return { error: validation.error }
  const { name, coupleNames, date } = validation.value

  try {
    const { user, supabase } = await requireUser()
    if (!user) return { error: 'Tu sesión expiró. Vuelve a iniciar sesión.' }

    let lastError: string | null = null
    for (let attempt = 0; attempt < 5; attempt++) {
      const slug = generateSlug(coupleNames)
      const { error } = await supabase
        .from('weddings')
        .insert({ name, couple_names: coupleNames, date, slug, owner_id: user.id })

      if (!error) {
        revalidatePath('/dashboard')
        return { success: true }
      }
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

export async function updateWedding(_: unknown, formData: FormData): Promise<ActionState> {
  const id = formData.get('id') as string | null
  if (!isValidUUID(id)) return { error: 'ID inválido.' }

  const validation = validateWeddingInput({
    name: formData.get('name'),
    couple_names: formData.get('couple_names'),
    date: formData.get('date'),
  })
  if (!validation.ok) return { error: validation.error }
  const { name, coupleNames, date } = validation.value

  try {
    const { user, supabase } = await requireUser()
    if (!user) return { error: 'Tu sesión expiró.' }

    const { error } = await supabase
      .from('weddings')
      .update({ name, couple_names: coupleNames, date })
      .eq('id', id)
      .eq('owner_id', user.id) // RLS extra check

    if (error) return { error: 'No se pudo actualizar la boda.' }

    revalidatePath('/dashboard')
    revalidatePath(`/dashboard/${id}`)
    return { success: true }
  } catch {
    return { error: 'No se pudo conectar. Inténtalo de nuevo.' }
  }
}

export async function deleteWedding(id: string): Promise<ActionState> {
  if (!isValidUUID(id)) return { error: 'ID inválido.' }

  try {
    const { user, supabase } = await requireUser()
    if (!user) return { error: 'Tu sesión expiró.' }

    // Fetch all photo paths before deleting so we can clean up Storage.
    const { data: photos } = await supabase
      .from('photos')
      .select('storage_path')
      .eq('wedding_id', id)

    if (photos && photos.length > 0) {
      const paths = photos.map((p) => p.storage_path)
      // Remove in batches of 100 (Supabase limit).
      for (let i = 0; i < paths.length; i += 100) {
        await supabase.storage.from('wedding-photos').remove(paths.slice(i, i + 100))
      }
    }

    // DB cascade handles photos rows.
    const { error } = await supabase
      .from('weddings')
      .delete()
      .eq('id', id)
      .eq('owner_id', user.id)

    if (error) return { error: 'No se pudo eliminar la boda.' }

    revalidatePath('/dashboard')
    return { success: true }
  } catch {
    return { error: 'No se pudo conectar. Inténtalo de nuevo.' }
  }
}

// ─── Photos ───────────────────────────────────────────────────────────────────

export async function deletePhoto(
  photoId: string,
  storagePath: string,
  weddingId: string
): Promise<ActionState> {
  if (!isValidUUID(photoId) || !isValidUUID(weddingId)) return { error: 'ID inválido.' }

  try {
    const { user, supabase } = await requireUser()
    if (!user) return { error: 'Tu sesión expiró.' }

    // Verify ownership via the wedding.
    const { data: wedding } = await supabase
      .from('weddings')
      .select('id')
      .eq('id', weddingId)
      .eq('owner_id', user.id)
      .maybeSingle()

    if (!wedding) return { error: 'No tienes permiso para eliminar esta foto.' }

    await supabase.storage.from('wedding-photos').remove([storagePath])

    const { error } = await supabase.from('photos').delete().eq('id', photoId)
    if (error) return { error: 'No se pudo eliminar la foto.' }

    revalidatePath(`/dashboard/${weddingId}`)
    return { success: true }
  } catch {
    return { error: 'No se pudo conectar. Inténtalo de nuevo.' }
  }
}

export async function updatePhotoMeta(
  photoId: string,
  weddingId: string,
  uploaderName: string,
  message: string
): Promise<ActionState> {
  if (!isValidUUID(photoId) || !isValidUUID(weddingId)) return { error: 'ID inválido.' }

  const name = uploaderName.trim()
  const msg = message.trim()

  if (!name || name.length > 80) return { error: 'El nombre es inválido.' }
  if (msg.length > 500) return { error: 'El mensaje es demasiado largo.' }

  try {
    const { user, supabase } = await requireUser()
    if (!user) return { error: 'Tu sesión expiró.' }

    const { data: wedding } = await supabase
      .from('weddings')
      .select('id')
      .eq('id', weddingId)
      .eq('owner_id', user.id)
      .maybeSingle()

    if (!wedding) return { error: 'No tienes permiso para editar esta foto.' }

    const { error } = await supabase
      .from('photos')
      .update({ uploader_name: name, message: msg || null })
      .eq('id', photoId)

    if (error) return { error: 'No se pudo actualizar la foto.' }

    revalidatePath(`/dashboard/${weddingId}`)
    return { success: true }
  } catch {
    return { error: 'No se pudo conectar. Inténtalo de nuevo.' }
  }
}
