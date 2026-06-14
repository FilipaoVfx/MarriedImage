'use client'

import { useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  isAcceptableImage,
  safeExtension,
  validateUploadInput,
  MAX_FILE_BYTES,
  MAX_FILES_PER_UPLOAD,
} from '@/lib/validation'
import { uploadVideoToCloudinary } from '@/lib/cloudinary.client'

interface Props {
  wedding: {
    id: string
    name: string
    couple_names: string
    date: string | null
  }
}

const MAX_VIDEO_BYTES = 200 * 1024 * 1024 // 200 MB per video

interface FilePreview {
  file: File
  preview: string
  mediaType: 'image' | 'video'
}

export default function UploadFunnel({ wedding }: Props) {
  const [uploaderName, setUploaderName] = useState('')
  const [message, setMessage] = useState('')
  const [items, setItems] = useState<FilePreview[]>([])
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentFile, setCurrentFile] = useState(0)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const galleryRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  function addFiles(incoming: File[]) {
    setError(null)

    const accepted: { file: File; mediaType: 'image' | 'video' }[] = []
    let rejectedType = 0
    let rejectedSize = 0

    for (const file of incoming) {
      const isVideo = file.type.startsWith('video/')
      const isImage = file.type.startsWith('image/') || file.type === ''

      if (!isImage && !isVideo) {
        rejectedType++
        continue
      }

      if (isVideo && file.size > MAX_VIDEO_BYTES) {
        rejectedSize++
        continue
      }

      if (isImage && !isAcceptableImage(file)) {
        rejectedSize++
        continue
      }

      accepted.push({ file, mediaType: isVideo ? 'video' : 'image' })
    }

    const room = MAX_FILES_PER_UPLOAD - items.length
    if (room <= 0) {
      setError(`Máximo ${MAX_FILES_PER_UPLOAD} archivos por envío.`)
      return
    }

    const toAdd = accepted.slice(0, room)

    if (rejectedType > 0) {
      setError('Algunos archivos no son imágenes ni videos y se omitieron.')
    } else if (rejectedSize > 0) {
      setError(
        `Algunos archivos superan el límite (fotos: ${Math.round(MAX_FILE_BYTES / (1024 * 1024))} MB, videos: ${Math.round(MAX_VIDEO_BYTES / (1024 * 1024))} MB) y se omitieron.`
      )
    } else if (accepted.length > room) {
      setError(`Solo se añadieron ${room}; máximo ${MAX_FILES_PER_UPLOAD} archivos por envío.`)
    }

    toAdd.forEach(({ file, mediaType }) => {
      if (mediaType === 'video') {
        // Use a blob URL for video preview instead of FileReader (much faster).
        const preview = URL.createObjectURL(file)
        setItems((cur) => [...cur, { file, preview, mediaType }])
      } else {
        const reader = new FileReader()
        reader.onload = (e) => {
          setItems((cur) => [
            ...cur,
            { file, preview: e.target?.result as string, mediaType },
          ])
        }
        reader.readAsDataURL(file)
      }
    })
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    addFiles(Array.from(e.target.files || []))
    e.target.value = ''
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    addFiles(Array.from(e.dataTransfer.files))
  }, [])

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (uploading) return

    const validation = validateUploadInput({ uploaderName, message })
    if (!validation.ok) {
      setError(validation.error)
      return
    }
    if (items.length === 0) {
      setError('Selecciona al menos una foto.')
      return
    }

    const { uploaderName: name, message: msg } = validation.value

    setUploading(true)
    setError(null)
    setProgress(0)
    setCurrentFile(0)

    let uploaded = 0

    for (let i = 0; i < items.length; i++) {
      setCurrentFile(i + 1)
      const { file, mediaType } = items[i]

      try {
        let storagePath: string

        if (mediaType === 'video') {
          // Upload video to Cloudinary with per-file progress.
          const result = await uploadVideoToCloudinary(
            file,
            `marriedimage/${wedding.id}`,
            (pct) => {
              // Blend per-file progress into overall progress.
              const base = Math.round((i / items.length) * 100)
              setProgress(base + Math.round(pct / items.length))
            }
          )
          storagePath = result.public_id
        } else {
          // Upload image to Supabase Storage.
          const ext = safeExtension(file.name)
          const path = `${wedding.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

          const { error: uploadErr } = await supabase.storage
            .from('wedding-photos')
            .upload(path, file, { contentType: file.type || 'image/jpeg', upsert: false })

          if (uploadErr) throw uploadErr
          storagePath = path
        }

        const { error: dbErr } = await supabase.from('photos').insert({
          wedding_id: wedding.id,
          uploader_name: name,
          message: msg,
          storage_path: storagePath,
          media_type: mediaType,
        })

        if (dbErr) {
          if (mediaType === 'image') {
            await supabase.storage.from('wedding-photos').remove([storagePath]).catch(() => {})
          }
          throw dbErr
        }

        uploaded++
        setProgress(Math.round(((i + 1) / items.length) * 100))
      } catch (err: unknown) {
        setUploading(false)
        const msg2 = err instanceof Error ? err.message : ''
        setError(
          uploaded > 0
            ? `Se subieron ${uploaded} de ${items.length}. Error: ${msg2 || 'inténtalo de nuevo.'}`
            : `No se pudo subir el archivo. ${msg2 || 'Revisa tu conexión e inténtalo de nuevo.'}`
        )
        return
      }
    }

    setUploading(false)
    setSuccess(true)
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-rose-50 via-pink-50 to-purple-50 flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="text-8xl mb-6 animate-bounce">💌</div>
          <h2 className="text-3xl font-semibold text-gray-800 mb-3">
            ¡Gracias, {uploaderName}!
          </h2>
          <p className="text-gray-500 text-lg leading-relaxed">
            Tus fotos fueron enviadas a{' '}
            <span className="text-rose-500 font-semibold">{wedding.couple_names}</span>
          </p>
          <p className="text-gray-400 text-sm mt-2">
            {items.length} foto{items.length !== 1 ? 's' : ''} compartida{items.length !== 1 ? 's' : ''} con éxito
          </p>
          <button
            onClick={() => {
              setSuccess(false)
              setItems([])
              setMessage('')
              setProgress(0)
            }}
            className="mt-8 bg-rose-500 hover:bg-rose-600 text-white font-medium px-8 py-3 rounded-2xl transition text-base"
          >
            Enviar más fotos
          </button>
        </div>
      </div>
    )
  }

  const weddingDate = wedding.date
    ? new Date(wedding.date + 'T12:00:00').toLocaleDateString('es-ES', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-pink-50 to-purple-50">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-rose-100 px-4 py-5 text-center sticky top-0 z-10">
        <div className="text-2xl mb-1">💍</div>
        <h1 className="text-xl font-semibold text-rose-900">{wedding.couple_names}</h1>
        {weddingDate && <p className="text-rose-400 text-xs mt-0.5">{weddingDate}</p>}
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 pb-10">
        <p className="text-center text-gray-600 mb-6 text-base">
          Comparte tus mejores momentos de la boda 📸
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nombre */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <label className="block text-sm font-semibold text-gray-600 mb-2">
              Tu nombre <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={uploaderName}
              onChange={(e) => setUploaderName(e.target.value)}
              required
              placeholder="¿Cómo te llamas?"
              autoComplete="given-name"
              className="w-full border border-gray-200 rounded-xl px-4 py-3.5 text-base focus:outline-none focus:ring-2 focus:ring-rose-300 transition"
            />
          </div>

          {/* Mensaje */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <label className="block text-sm font-semibold text-gray-600 mb-2">
              Mensaje para los novios{' '}
              <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="¡Felicidades! Que sean muy felices..."
              rows={2}
              className="w-full border border-gray-200 rounded-xl px-4 py-3.5 text-base focus:outline-none focus:ring-2 focus:ring-rose-300 resize-none transition"
            />
          </div>

          {/* Botones de subida: cámara + galería */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <label className="block text-sm font-semibold text-gray-600 mb-3">
              Tus fotos <span className="text-rose-400">*</span>
            </label>

            <div className="grid grid-cols-2 gap-3 mb-3">
              {/* Cámara directa */}
              <button
                type="button"
                onClick={() => cameraRef.current?.click()}
                className="flex flex-col items-center justify-center gap-2 bg-rose-500 hover:bg-rose-600 active:bg-rose-700 text-white rounded-2xl py-5 transition font-medium text-sm"
              >
                <span className="text-3xl">📷</span>
                <span>Tomar foto</span>
              </button>

              {/* Galería */}
              <button
                type="button"
                onClick={() => galleryRef.current?.click()}
                className="flex flex-col items-center justify-center gap-2 border-2 border-rose-200 hover:border-rose-400 hover:bg-rose-50 active:bg-rose-100 text-rose-600 rounded-2xl py-5 transition font-medium text-sm"
              >
                <span className="text-3xl">🖼️</span>
                <span>Desde galería</span>
              </button>
            </div>

            {/* Zona drag-and-drop (desktop) */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              className={`hidden sm:flex border-2 border-dashed rounded-xl p-4 text-center flex-col items-center justify-center transition ${
                dragging ? 'border-rose-400 bg-rose-50' : 'border-gray-200'
              }`}
            >
              <p className="text-gray-400 text-sm">O arrastra fotos aquí</p>
            </div>

            {/* Inputs ocultos */}
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
              className="hidden"
            />
            <input
              ref={galleryRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {/* Preview grid */}
          {items.length > 0 && (
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="flex justify-between items-center mb-3">
                <p className="text-sm font-semibold text-gray-600">
                  {items.length} foto{items.length !== 1 ? 's' : ''} seleccionada{items.length !== 1 ? 's' : ''}
                </p>
                <button
                  type="button"
                  onClick={() => setItems([])}
                  className="text-xs text-gray-400 hover:text-red-500 transition"
                >
                  Eliminar todas
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {items.map((item, i) => (
                  <div key={i} className="relative aspect-square rounded-xl overflow-hidden bg-gray-100">
                    {item.mediaType === 'video' ? (
                      <video
                        src={item.preview}
                        className="w-full h-full object-cover"
                        muted
                        playsInline
                        preload="metadata"
                      />
                    ) : (
                      <img
                        src={item.preview}
                        className="w-full h-full object-cover"
                        alt={`Foto ${i + 1}`}
                      />
                    )}
                    {item.mediaType === 'video' && (
                      <div className="absolute bottom-1 left-1 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded-md">
                        🎥
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => removeItem(i)}
                      className="absolute top-1 right-1 bg-black/60 text-white w-7 h-7 rounded-full text-base flex items-center justify-center font-bold leading-none"
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => galleryRef.current?.click()}
                  className="aspect-square rounded-xl border-2 border-dashed border-gray-200 hover:border-rose-300 flex items-center justify-center text-2xl text-gray-300 hover:text-rose-400 transition"
                >
                  +
                </button>
              </div>
            </div>
          )}

          {/* Progreso */}
          {uploading && (
            <div className="bg-white rounded-2xl p-4 shadow-sm space-y-2">
              <div className="flex justify-between text-sm text-gray-600 font-medium">
                <span>Subiendo foto {currentFile} de {items.length}...</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-3">
                <div
                  className="bg-rose-400 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-100 rounded-2xl p-4">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          {/* Botón enviar */}
          <button
            type="submit"
            disabled={uploading || items.length === 0 || !uploaderName.trim()}
            className="w-full bg-rose-500 hover:bg-rose-600 active:bg-rose-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold py-5 rounded-2xl transition text-lg shadow-sm"
          >
            {uploading
              ? `Enviando... ${progress}%`
              : items.length === 0
              ? 'Selecciona fotos para enviar'
              : `Enviar ${items.length} foto${items.length !== 1 ? 's' : ''} 💌`}
          </button>
        </form>
      </div>
    </div>
  )
}
