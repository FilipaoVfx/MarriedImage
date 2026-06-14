'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { copyToClipboard } from '@/lib/clipboard'
import { deletePhoto, updatePhotoMeta } from '@/app/actions'
import { cloudinaryVideoUrl, cloudinaryPosterUrl } from '@/lib/cloudinary.client'
import type { Wedding, Photo } from '@/types/database'

export default function WeddingGallery({
  wedding,
  photos: initialPhotos,
}: {
  wedding: Wedding
  photos: Photo[]
}) {
  const [photos, setPhotos] = useState<Photo[]>(initialPhotos)
  const [selected, setSelected] = useState<Photo | null>(null)
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editMessage, setEditMessage] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [isPending, startTransition] = useTransition()

  const supabase = createClient()

  const uploadUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/boda/${wedding.slug}` : ''

  function whatsappMessage() {
    return (
      `💍 ¡Hola! Te invitamos a compartir tus fotos de la boda de *${wedding.couple_names}*.\n\n` +
      `📸 Es muy fácil — solo haz clic en este enlace y sube tus fotos en segundos, ¡sin apps ni registro!\n\n` +
      uploadUrl
    )
  }

  async function copyLink() {
    const ok = await copyToClipboard(uploadUrl)
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  function shareWhatsApp() {
    const url = `https://wa.me/?text=${encodeURIComponent(whatsappMessage())}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  function openPhoto(photo: Photo) {
    setSelected(photo)
    setEditing(false)
    setEditName(photo.uploader_name)
    setEditMessage(photo.message ?? '')
    setActionError(null)
  }

  function getMediaUrl(photo: Photo) {
    if (photo.media_type === 'video') return cloudinaryVideoUrl(photo.storage_path)
    const { data } = supabase.storage.from('wedding-photos').getPublicUrl(photo.storage_path)
    return data.publicUrl
  }

  function handleDelete(photo: Photo) {
    setActionError(null)
    startTransition(async () => {
      const result = await deletePhoto(photo.id, photo.storage_path, wedding.id, photo.media_type)
      if (result?.error) {
        setActionError(result.error)
        return
      }
      setPhotos((prev) => prev.filter((p) => p.id !== photo.id))
      setSelected(null)
    })
  }

  function handleSaveMeta() {
    if (!selected) return
    setActionError(null)
    startTransition(async () => {
      const result = await updatePhotoMeta(selected.id, wedding.id, editName, editMessage)
      if (result?.error) {
        setActionError(result.error)
        return
      }
      const updated: Photo = {
        ...selected,
        uploader_name: editName.trim(),
        message: editMessage.trim() || null,
      }
      setPhotos((prev) => prev.map((p) => (p.id === selected.id ? updated : p)))
      setSelected(updated)
      setEditing(false)
    })
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
              {photos.length} {photos.length === 1 ? 'archivo recibido' : 'archivos recibidos'}
            </p>
            <p className="text-xs text-gray-400 mt-1 break-all">{uploadUrl}</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={shareWhatsApp}
              className="flex items-center gap-1.5 bg-[#25D366] hover:bg-[#1db955] text-white px-4 py-2 rounded-xl text-sm transition font-medium"
            >
              <span>💬</span> WhatsApp
            </button>
            <button
              onClick={copyLink}
              className="border border-rose-300 text-rose-500 hover:bg-rose-50 px-4 py-2 rounded-xl text-sm transition font-medium"
            >
              {copied ? '✓ Copiado' : 'Copiar'}
            </button>
          </div>
        </div>

        {photos.length === 0 ? (
          <div className="text-center py-24 text-gray-400">
            <div className="text-6xl mb-4">📸</div>
            <p className="text-lg font-medium">Aún no hay fotos</p>
            <p className="text-sm mt-1">Comparte el enlace con tus invitados</p>
          </div>
        ) : (
          <div className="columns-2 md:columns-3 lg:columns-4 gap-3 [column-gap:0.75rem]">
            {photos.map((photo) => (
              <div
                key={photo.id}
                className="mb-3 break-inside-avoid group relative rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition"
              >
                {photo.media_type === 'video' ? (
                  <video
                    src={cloudinaryVideoUrl(photo.storage_path)}
                    poster={cloudinaryPosterUrl(photo.storage_path)}
                    className="w-full object-cover cursor-pointer"
                    preload="none"
                    onClick={() => openPhoto(photo)}
                  />
                ) : (
                  <img
                    src={getMediaUrl(photo)}
                    alt={`Foto de ${photo.uploader_name}`}
                    className="w-full object-cover group-hover:scale-105 transition duration-300 cursor-pointer"
                    loading="lazy"
                    onClick={() => openPhoto(photo)}
                  />
                )}
                {photo.media_type === 'video' && (
                  <span className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full pointer-events-none">
                    ▶ Video
                  </span>
                )}
                {/* Overlay con nombre + acciones rápidas */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition duration-200 flex flex-col justify-end p-3">
                  <div className="flex justify-between items-end">
                    <div className="flex-1 min-w-0 mr-2" onClick={() => openPhoto(photo)}>
                      <p className="text-white text-sm font-medium truncate">
                        {photo.uploader_name}
                      </p>
                      {photo.message && (
                        <p className="text-white/70 text-xs truncate">{photo.message}</p>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          openPhoto(photo)
                          setTimeout(() => setEditing(true), 50)
                        }}
                        className="bg-white/20 hover:bg-white/40 text-white w-7 h-7 rounded-lg flex items-center justify-center text-xs transition"
                        title="Editar"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          if (confirm(`¿Eliminar la foto de ${photo.uploader_name}?`)) {
                            handleDelete(photo)
                          }
                        }}
                        className="bg-white/20 hover:bg-red-500 text-white w-7 h-7 rounded-lg flex items-center justify-center text-xs transition"
                        title="Eliminar"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Lightbox */}
      {selected && (
        <div
          className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4"
          onClick={() => !editing && setSelected(null)}
        >
          <div
            className="max-w-4xl w-full flex flex-col md:flex-row gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Media */}
            <div className="flex-1 flex items-center justify-center">
              {selected.media_type === 'video' ? (
                <video
                  src={cloudinaryVideoUrl(selected.storage_path)}
                  poster={cloudinaryPosterUrl(selected.storage_path)}
                  controls
                  className="w-full rounded-2xl max-h-[75vh] object-contain"
                />
              ) : (
                <img
                  src={getMediaUrl(selected)}
                  alt=""
                  className="w-full rounded-2xl max-h-[75vh] object-contain"
                />
              )}
            </div>

            {/* Panel lateral con metadata + acciones */}
            <div className="md:w-72 bg-white/10 backdrop-blur rounded-2xl p-5 flex flex-col gap-4">
              <button
                onClick={() => setSelected(null)}
                className="self-end text-white/50 hover:text-white text-2xl leading-none"
              >
                ×
              </button>

              {editing ? (
                /* Modo edición */
                <div className="space-y-3">
                  <div>
                    <label className="text-white/60 text-xs mb-1 block">Nombre</label>
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full bg-white/10 text-white border border-white/20 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-rose-400"
                    />
                  </div>
                  <div>
                    <label className="text-white/60 text-xs mb-1 block">Mensaje</label>
                    <textarea
                      value={editMessage}
                      onChange={(e) => setEditMessage(e.target.value)}
                      rows={3}
                      className="w-full bg-white/10 text-white border border-white/20 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-rose-400 resize-none"
                    />
                  </div>
                  {actionError && (
                    <p className="text-red-400 text-xs">{actionError}</p>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditing(false)}
                      className="flex-1 border border-white/20 text-white/70 py-2 rounded-xl text-sm hover:bg-white/10 transition"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleSaveMeta}
                      disabled={isPending}
                      className="flex-1 bg-rose-500 hover:bg-rose-600 text-white py-2 rounded-xl text-sm font-medium disabled:opacity-50 transition"
                    >
                      {isPending ? '...' : 'Guardar'}
                    </button>
                  </div>
                </div>
              ) : (
                /* Modo visualización */
                <div className="flex flex-col gap-3 flex-1">
                  <div>
                    <p className="text-white/50 text-xs mb-0.5">De</p>
                    <p className="text-white font-semibold text-lg leading-tight">
                      {selected.uploader_name}
                    </p>
                  </div>
                  {selected.message && (
                    <div>
                      <p className="text-white/50 text-xs mb-0.5">Mensaje</p>
                      <p className="text-white/80 text-sm italic">"{selected.message}"</p>
                    </div>
                  )}
                  <div>
                    <p className="text-white/50 text-xs mb-0.5">Recibida</p>
                    <p className="text-white/60 text-xs">
                      {new Date(selected.created_at).toLocaleDateString('es-ES', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>

                  {actionError && (
                    <p className="text-red-400 text-xs mt-auto">{actionError}</p>
                  )}

                  <div className="flex gap-2 mt-auto">
                    <button
                      onClick={() => setEditing(true)}
                      className="flex-1 border border-white/20 text-white/80 py-2.5 rounded-xl text-sm hover:bg-white/10 transition"
                    >
                      ✏️ Editar
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`¿Eliminar la foto de ${selected.uploader_name}?`)) {
                          handleDelete(selected)
                        }
                      }}
                      disabled={isPending}
                      className="flex-1 bg-red-500/80 hover:bg-red-500 text-white py-2.5 rounded-xl text-sm font-medium disabled:opacity-50 transition"
                    >
                      {isPending ? '...' : '🗑️ Eliminar'}
                    </button>
                  </div>

                  <a
                    href={getMediaUrl(selected)}
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-center border border-white/20 text-white/70 py-2.5 rounded-xl text-sm hover:bg-white/10 transition"
                  >
                    ⬇️ Descargar
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
