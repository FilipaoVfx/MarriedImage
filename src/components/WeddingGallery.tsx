'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Wedding, Photo } from '@/types/database'

export default function WeddingGallery({
  wedding,
  photos,
}: {
  wedding: Wedding
  photos: Photo[]
}) {
  const [selected, setSelected] = useState<Photo | null>(null)
  const [copied, setCopied] = useState(false)
  const supabase = createClient()

  function getPhotoUrl(path: string) {
    const { data } = supabase.storage.from('wedding-photos').getPublicUrl(path)
    return data.publicUrl
  }

  const uploadUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/upload/${wedding.slug}` : ''

  function copyLink() {
    navigator.clipboard.writeText(uploadUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 to-pink-50">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/dashboard" className="text-gray-400 hover:text-gray-600 text-sm transition">
            ← Mis bodas
          </Link>
          <span className="text-gray-300">/</span>
          <h1 className="text-lg font-semibold text-gray-800">{wedding.couple_names}</h1>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <p className="text-2xl font-semibold text-gray-800">
              {photos.length} {photos.length === 1 ? 'foto recibida' : 'fotos recibidas'}
            </p>
            <p className="text-sm text-gray-500 mt-1 font-mono break-all">{uploadUrl}</p>
          </div>
          <button
            onClick={copyLink}
            className="shrink-0 border border-rose-300 text-rose-500 hover:bg-rose-50 px-4 py-2 rounded-xl text-sm transition font-medium"
          >
            {copied ? '✓ Copiado' : 'Copiar enlace'}
          </button>
        </div>

        {photos.length === 0 ? (
          <div className="text-center py-24 text-gray-400">
            <div className="text-6xl mb-4">📸</div>
            <p className="text-lg font-medium">Aún no hay fotos</p>
            <p className="text-sm mt-1">Comparte el enlace con tus invitados para empezar a recibir fotos</p>
          </div>
        ) : (
          <div className="columns-2 md:columns-3 lg:columns-4 gap-3 [column-gap:0.75rem]">
            {photos.map((photo) => (
              <div
                key={photo.id}
                onClick={() => setSelected(photo)}
                className="mb-3 break-inside-avoid cursor-pointer group relative rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition"
              >
                <img
                  src={getPhotoUrl(photo.storage_path)}
                  alt={`Foto de ${photo.uploader_name}`}
                  className="w-full object-cover group-hover:scale-105 transition duration-300"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition duration-200 flex flex-col justify-end p-3">
                  <p className="text-white text-sm font-medium">{photo.uploader_name}</p>
                  {photo.message && (
                    <p className="text-white/75 text-xs mt-0.5 line-clamp-2">{photo.message}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {selected && (
        <div
          className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 p-4"
          onClick={() => setSelected(null)}
        >
          <div className="max-w-4xl w-full" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setSelected(null)}
              className="absolute top-4 right-4 text-white/70 hover:text-white text-3xl leading-none"
            >
              ×
            </button>
            <img
              src={getPhotoUrl(selected.storage_path)}
              alt=""
              className="w-full rounded-2xl max-h-[78vh] object-contain"
            />
            <div className="mt-4 text-white">
              <p className="font-semibold text-lg">{selected.uploader_name}</p>
              {selected.message && (
                <p className="text-white/70 text-sm mt-1 italic">"{selected.message}"</p>
              )}
              <p className="text-white/40 text-xs mt-2">
                {new Date(selected.created_at).toLocaleDateString('es-ES', {
                  day: 'numeric',
                  month: 'long',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
