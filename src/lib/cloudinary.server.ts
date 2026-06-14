// Server-side only — never import this in client components.
import { v2 as cloudinary } from 'cloudinary'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
})

export async function deleteCloudinaryVideo(publicId: string): Promise<void> {
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: 'video' })
  } catch {
    // Log but don't throw — a failed Cloudinary deletion shouldn't block the DB delete.
    console.error('[Cloudinary] Failed to delete video:', publicId)
  }
}

// Build a streamable video URL with auto quality/format.
export function videoUrl(publicId: string): string {
  return cloudinary.url(publicId, {
    resource_type: 'video',
    format: 'mp4',
    transformation: [{ quality: 'auto', fetch_format: 'mp4' }],
  })
}

// Poster image for the <video> element (first frame).
export function videoPoster(publicId: string): string {
  return cloudinary.url(publicId, {
    resource_type: 'video',
    format: 'jpg',
    transformation: [{ start_offset: 0, width: 600, crop: 'fill', quality: 'auto' }],
  })
}
