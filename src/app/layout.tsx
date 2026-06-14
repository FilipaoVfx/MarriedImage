import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import ServiceWorker from '@/components/ServiceWorker'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'MarriedImage – Comparte tus fotos de boda',
  description: 'Reúne todas las fotos de tu boda en un solo lugar',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'MarriedImage',
  },
  formatDetection: { telephone: false },
}

export const viewport: Viewport = {
  themeColor: '#f43f5e',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={inter.className}>
        <ServiceWorker />
        {children}
      </body>
    </html>
  )
}
