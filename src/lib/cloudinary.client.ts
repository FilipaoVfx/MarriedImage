// Client-side Cloudinary helpers — no API secret exposed.

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? ''
const UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET ?? ''

export interface CloudinaryResult {
  public_id: string
  secure_url: string
  duration?: number
}

export async function uploadVideoToCloudinary(
  file: File,
  folder: string,
  onProgress?: (pct: number) => void
): Promise<CloudinaryResult> {
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    throw new Error('Cloudinary no está configurado. Agrega las variables de entorno.')
  }

  const form = new FormData()
  form.append('file', file)
  form.append('upload_preset', UPLOAD_PRESET)
  form.append('folder', folder)
  form.append('resource_type', 'video')

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100))
      }
    })

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as CloudinaryResult)
        } catch {
          reject(new Error('Respuesta inválida de Cloudinary.'))
        }
      } else {
        reject(new Error(`Cloudinary error ${xhr.status}: ${xhr.responseText}`))
      }
    })

    xhr.addEventListener('error', () => reject(new Error('Error de red al subir el video.')))
    xhr.addEventListener('abort', () => reject(new Error('Subida cancelada.')))

    xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/video/upload`)
    xhr.send(form)
  })
}

export function cloudinaryVideoUrl(publicId: string): string {
  return `https://res.cloudinary.com/${CLOUD_NAME}/video/upload/q_auto,f_mp4/${publicId}`
}

export function cloudinaryPosterUrl(publicId: string): string {
  return `https://res.cloudinary.com/${CLOUD_NAME}/video/upload/so_0,w_600,h_400,c_fill,q_auto,f_jpg/${publicId}`
}
