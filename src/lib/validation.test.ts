import { describe, it, expect } from 'vitest'
import {
  isValidUUID,
  slugify,
  randomSuffix,
  generateSlug,
  validateWeddingInput,
  validateUploadInput,
  isAcceptableImage,
  isAcceptableVideo,
  detectMediaKind,
  mediaCounts,
  mediaLabel,
  safeExtension,
  MAX_FILE_BYTES,
  MAX_VIDEO_BYTES,
  MAX_FILES_PER_UPLOAD,
} from './validation'

describe('isValidUUID', () => {
  it('accepts a valid v4 UUID', () => {
    expect(isValidUUID('68cb1936-92a6-4124-912d-96c3e415e47e')).toBe(true)
  })

  it('rejects arbitrary strings (prevents Postgres 500 on route)', () => {
    expect(isValidUUID('not-a-uuid')).toBe(false)
    expect(isValidUUID('123')).toBe(false)
    expect(isValidUUID('')).toBe(false)
    expect(isValidUUID('../../etc/passwd')).toBe(false)
  })

  it('rejects non-string values', () => {
    expect(isValidUUID(null)).toBe(false)
    expect(isValidUUID(undefined)).toBe(false)
    expect(isValidUUID(123)).toBe(false)
  })
})

describe('slugify', () => {
  it('lowercases and replaces spaces with hyphens', () => {
    expect(slugify('Ana y Carlos')).toBe('ana-y-carlos')
  })

  it('strips accents and special characters', () => {
    expect(slugify('Diosa & Ricardo')).toBe('diosa-ricardo')
    expect(slugify('José María')).toBe('jose-maria')
  })

  it('trims leading/trailing hyphens', () => {
    expect(slugify('  !!hola!!  ')).toBe('hola')
  })

  it('caps length at 30 characters', () => {
    expect(slugify('a'.repeat(100)).length).toBe(30)
  })

  it('returns empty string for input with no valid characters', () => {
    expect(slugify('@#$%')).toBe('')
  })
})

describe('randomSuffix', () => {
  it('returns a string of the requested length', () => {
    expect(randomSuffix(6)).toHaveLength(6)
    expect(randomSuffix(10)).toHaveLength(10)
  })

  it('only contains lowercase alphanumerics', () => {
    expect(randomSuffix(50)).toMatch(/^[a-z0-9]+$/)
  })

  it('is reasonably unique across calls', () => {
    const set = new Set(Array.from({ length: 200 }, () => randomSuffix(6)))
    expect(set.size).toBeGreaterThan(190)
  })
})

describe('generateSlug', () => {
  it('combines a slugified root with a random suffix', () => {
    expect(generateSlug('Ana y Carlos')).toMatch(/^ana-y-carlos-[a-z0-9]{6}$/)
  })

  it('falls back to "boda" when the base has no valid characters', () => {
    expect(generateSlug('@#$%')).toMatch(/^boda-[a-z0-9]{6}$/)
  })

  it('produces different slugs for the same input', () => {
    expect(generateSlug('Boda')).not.toBe(generateSlug('Boda'))
  })
})

describe('validateWeddingInput', () => {
  it('accepts valid input and trims whitespace', () => {
    const r = validateWeddingInput({
      name: '  Boda de Ana  ',
      couple_names: '  Ana & Carlos  ',
      date: '2026-08-15',
    })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.name).toBe('Boda de Ana')
      expect(r.value.coupleNames).toBe('Ana & Carlos')
      expect(r.value.date).toBe('2026-08-15')
    }
  })

  it('treats empty date as null', () => {
    const r = validateWeddingInput({ name: 'Boda', couple_names: 'A & B', date: '' })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.date).toBeNull()
  })

  it('rejects a missing event name', () => {
    const r = validateWeddingInput({ name: '', couple_names: 'A & B', date: '' })
    expect(r.ok).toBe(false)
  })

  it('rejects missing couple names', () => {
    const r = validateWeddingInput({ name: 'Boda', couple_names: ' ', date: '' })
    expect(r.ok).toBe(false)
  })

  it('rejects an invalid date format', () => {
    const r = validateWeddingInput({ name: 'Boda', couple_names: 'A & B', date: '15/08/2026' })
    expect(r.ok).toBe(false)
  })

  it('rejects overly long names', () => {
    const r = validateWeddingInput({
      name: 'x'.repeat(200),
      couple_names: 'A & B',
      date: '',
    })
    expect(r.ok).toBe(false)
  })

  it('handles non-string inputs gracefully', () => {
    const r = validateWeddingInput({ name: null, couple_names: undefined, date: 42 })
    expect(r.ok).toBe(false)
  })
})

describe('validateUploadInput', () => {
  it('accepts a name and trims it', () => {
    const r = validateUploadInput({ uploaderName: '  Lucía  ', message: '' })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.uploaderName).toBe('Lucía')
      expect(r.value.message).toBeNull()
    }
  })

  it('keeps a trimmed message', () => {
    const r = validateUploadInput({ uploaderName: 'Lucía', message: '  ¡Felicidades!  ' })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.message).toBe('¡Felicidades!')
  })

  it('rejects an empty name', () => {
    expect(validateUploadInput({ uploaderName: '   ', message: '' }).ok).toBe(false)
  })

  it('rejects an over-long name', () => {
    expect(validateUploadInput({ uploaderName: 'x'.repeat(100), message: '' }).ok).toBe(false)
  })

  it('rejects an over-long message', () => {
    expect(
      validateUploadInput({ uploaderName: 'Lucía', message: 'x'.repeat(600) }).ok
    ).toBe(false)
  })
})

describe('isAcceptableImage', () => {
  it('accepts a normal jpeg under the size limit', () => {
    expect(isAcceptableImage({ type: 'image/jpeg', size: 1_000_000 })).toBe(true)
  })

  it('accepts empty type (HEIC on some browsers)', () => {
    expect(isAcceptableImage({ type: '', size: 1_000_000 })).toBe(true)
  })

  it('rejects zero-byte files', () => {
    expect(isAcceptableImage({ type: 'image/jpeg', size: 0 })).toBe(false)
  })

  it('rejects files over the size limit', () => {
    expect(isAcceptableImage({ type: 'image/jpeg', size: MAX_FILE_BYTES + 1 })).toBe(false)
  })

  it('rejects non-image mime types', () => {
    expect(isAcceptableImage({ type: 'application/pdf', size: 1000 })).toBe(false)
  })
})

describe('safeExtension', () => {
  it('extracts a lowercase extension', () => {
    expect(safeExtension('PHOTO.JPG')).toBe('jpg')
    expect(safeExtension('img.png')).toBe('png')
  })

  it('defaults to jpg when there is no extension', () => {
    expect(safeExtension('photo')).toBe('jpg')
  })

  it('defaults to jpg for suspicious extensions', () => {
    expect(safeExtension('evil.php.')).toBe('jpg')
    expect(safeExtension('x.<script>')).toBe('jpg')
  })
})

describe('upload limits constants', () => {
  it('exposes sane defaults', () => {
    expect(MAX_FILES_PER_UPLOAD).toBeGreaterThan(0)
    expect(MAX_FILE_BYTES).toBeGreaterThan(1024 * 1024)
    expect(MAX_VIDEO_BYTES).toBeGreaterThan(MAX_FILE_BYTES)
  })
})

describe('isAcceptableVideo', () => {
  it('accepts a normal mp4 under the size limit', () => {
    expect(isAcceptableVideo({ type: 'video/mp4', size: 10_000_000 })).toBe(true)
  })

  it('accepts mov and webm', () => {
    expect(isAcceptableVideo({ type: 'video/quicktime', size: 50_000_000 })).toBe(true)
    expect(isAcceptableVideo({ type: 'video/webm', size: 5_000_000 })).toBe(true)
  })

  it('rejects zero-byte videos', () => {
    expect(isAcceptableVideo({ type: 'video/mp4', size: 0 })).toBe(false)
  })

  it('rejects videos over the 200 MB limit', () => {
    expect(isAcceptableVideo({ type: 'video/mp4', size: MAX_VIDEO_BYTES + 1 })).toBe(false)
  })

  it('accepts a video right at the size limit', () => {
    expect(isAcceptableVideo({ type: 'video/mp4', size: MAX_VIDEO_BYTES })).toBe(true)
  })

  it('rejects image mime types', () => {
    expect(isAcceptableVideo({ type: 'image/jpeg', size: 1_000_000 })).toBe(false)
  })

  it('rejects empty mime type (unlike images, empty means unknown for video)', () => {
    expect(isAcceptableVideo({ type: '', size: 1_000_000 })).toBe(false)
  })
})

describe('detectMediaKind', () => {
  it('identifies mp4 as video', () => {
    expect(detectMediaKind({ type: 'video/mp4' })).toBe('video')
  })

  it('identifies quicktime as video', () => {
    expect(detectMediaKind({ type: 'video/quicktime' })).toBe('video')
  })

  it('identifies jpeg as image', () => {
    expect(detectMediaKind({ type: 'image/jpeg' })).toBe('image')
  })

  it('identifies webp as image', () => {
    expect(detectMediaKind({ type: 'image/webp' })).toBe('image')
  })

  it('treats empty type as image (HEIC on iOS)', () => {
    expect(detectMediaKind({ type: '' })).toBe('image')
  })

  it('returns null for unsupported types', () => {
    expect(detectMediaKind({ type: 'application/pdf' })).toBeNull()
    expect(detectMediaKind({ type: 'text/plain' })).toBeNull()
    expect(detectMediaKind({ type: 'audio/mpeg' })).toBeNull()
  })
})

describe('mediaCounts', () => {
  it('counts images and videos separately', () => {
    const items = [
      { mediaType: 'image' as const },
      { mediaType: 'video' as const },
      { mediaType: 'image' as const },
    ]
    expect(mediaCounts(items)).toEqual({ images: 2, videos: 1 })
  })

  it('handles all-image list', () => {
    const items = Array(5).fill({ mediaType: 'image' as const })
    expect(mediaCounts(items)).toEqual({ images: 5, videos: 0 })
  })

  it('handles all-video list', () => {
    const items = Array(3).fill({ mediaType: 'video' as const })
    expect(mediaCounts(items)).toEqual({ images: 0, videos: 3 })
  })

  it('returns zeros for empty list', () => {
    expect(mediaCounts([])).toEqual({ images: 0, videos: 0 })
  })
})

describe('mediaLabel', () => {
  it('shows only photos when no videos', () => {
    const items = [{ mediaType: 'image' as const }, { mediaType: 'image' as const }]
    expect(mediaLabel(items)).toBe('2 fotos')
  })

  it('uses singular for one photo', () => {
    expect(mediaLabel([{ mediaType: 'image' as const }])).toBe('1 foto')
  })

  it('shows only videos when no images', () => {
    const items = [{ mediaType: 'video' as const }]
    expect(mediaLabel(items)).toBe('1 video')
  })

  it('combines fotos and videos with dot separator', () => {
    const items = [
      { mediaType: 'image' as const },
      { mediaType: 'video' as const },
      { mediaType: 'video' as const },
    ]
    expect(mediaLabel(items)).toBe('1 foto · 2 videos')
  })

  it('returns empty string for empty list', () => {
    expect(mediaLabel([])).toBe('')
  })
})
