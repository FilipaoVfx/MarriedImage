// Pure, framework-agnostic validation + helpers. Unit-tested in src/lib/validation.test.ts

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isValidUUID(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value)
}

export function slugify(base: string): string {
  return base
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30)
}

export function randomSuffix(length = 6): string {
  let out = ''
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * chars.length)]
  }
  return out
}

export function generateSlug(base: string): string {
  const root = slugify(base) || 'boda'
  return `${root}-${randomSuffix()}`
}

export interface WeddingInput {
  name: string
  coupleNames: string
  date: string | null
}

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string }

export function validateWeddingInput(raw: {
  name?: unknown
  couple_names?: unknown
  date?: unknown
}): ValidationResult<WeddingInput> {
  const name = typeof raw.name === 'string' ? raw.name.trim() : ''
  const coupleNames =
    typeof raw.couple_names === 'string' ? raw.couple_names.trim() : ''
  const dateRaw = typeof raw.date === 'string' ? raw.date.trim() : ''

  if (name.length < 2) {
    return { ok: false, error: 'El nombre del evento es obligatorio.' }
  }
  if (name.length > 120) {
    return { ok: false, error: 'El nombre del evento es demasiado largo.' }
  }
  if (coupleNames.length < 2) {
    return { ok: false, error: 'Los nombres de los novios son obligatorios.' }
  }
  if (coupleNames.length > 120) {
    return { ok: false, error: 'Los nombres de los novios son demasiado largos.' }
  }

  let date: string | null = null
  if (dateRaw) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateRaw) || Number.isNaN(Date.parse(dateRaw))) {
      return { ok: false, error: 'La fecha no es válida.' }
    }
    date = dateRaw
  }

  return { ok: true, value: { name, coupleNames, date } }
}

export interface UploadInput {
  uploaderName: string
  message: string | null
}

export function validateUploadInput(raw: {
  uploaderName?: unknown
  message?: unknown
}): ValidationResult<UploadInput> {
  const uploaderName =
    typeof raw.uploaderName === 'string' ? raw.uploaderName.trim() : ''
  const messageRaw = typeof raw.message === 'string' ? raw.message.trim() : ''

  if (uploaderName.length < 1) {
    return { ok: false, error: 'Por favor escribe tu nombre.' }
  }
  if (uploaderName.length > 80) {
    return { ok: false, error: 'El nombre es demasiado largo (máx. 80).' }
  }
  if (messageRaw.length > 500) {
    return { ok: false, error: 'El mensaje es demasiado largo (máx. 500).' }
  }

  return {
    ok: true,
    value: { uploaderName, message: messageRaw || null },
  }
}

export const MAX_FILE_BYTES = 15 * 1024 * 1024 // 15 MB
export const MAX_FILES_PER_UPLOAD = 30
export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/gif',
]

export function isAcceptableImage(file: { type: string; size: number }): boolean {
  if (file.size <= 0 || file.size > MAX_FILE_BYTES) return false
  // Some browsers report empty type for HEIC; accept anything starting with image/
  return file.type === '' || file.type.startsWith('image/')
}

export function safeExtension(filename: string): string {
  const m = /\.([a-z0-9]{1,5})$/i.exec(filename)
  const ext = m ? m[1].toLowerCase() : 'jpg'
  return /^[a-z0-9]+$/.test(ext) ? ext : 'jpg'
}
