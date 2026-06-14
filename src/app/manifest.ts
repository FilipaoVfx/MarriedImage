import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'MarriedImage',
    short_name: 'MarriedImage',
    description: 'Comparte las fotos de tu boda en un solo lugar',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#fff1f2',
    theme_color: '#f43f5e',
    categories: ['photo', 'social'],
    icons: [
      {
        src: '/icon.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icon.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  }
}
