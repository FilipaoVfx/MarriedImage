'use client'

import { useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  isAcceptableImage,
  isAcceptableVideo,
  detectMediaKind,
  mediaLabel,
  safeExtension,
  validateUploadInput,
  MAX_FILE_BYTES,
  MAX_VIDEO_BYTES,
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

interface FilePreview {
  file: File
  preview: string
  mediaType: 'image' | 'video'
}

// ── VideoThumbnail ────────────────────────────────────────────────────────────
// Tap/click to play-pause. Uses blob URL — no upload happens at preview stage.

function VideoThumbnail({ src }: { src: string }) {
  const [playing, setPlaying] = useState(false)
  const ref = useRef<HTMLVideoElement>(null)

  function toggle(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!ref.current) return
    if (playing) ref.current.pause()
    else ref.current.play().catch(() => {})
  }

  return (
    <div className="relative w-full h-full bg-gray-900">
      <video
        ref={ref}
        src={src}
        className="w-full h-full object-cover"
        playsInline
        muted
        preload="metadata"
        loop
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />
      <div
        className={`absolute inset-0 flex items-center justify-center transition-opacity cursor-pointer select-none ${
          playing ? 'opacity-0 hover:opacity-100' : 'bg-black/30'
        }`}
        onClick={toggle}
        onTouchEnd={toggle}
        aria-label={playing ? 'Pausar' : 'Reproducir'}
      >
        <span className="bg-black/60 text-white w-10 h-10 rounded-full flex items-center justify-center text-base pointer-events-none">
          {playing ? '⏸' : '▶'}
        </span>
      </div>
      <span className="absolute bottom-1 left-1 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded-md pointer-events-none">
        🎥
      </span>
    </div>
  )
}

// ── UploadFunnel ──────────────────────────────────────────────────────────────

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
  const videoRef = useRef<HTMLInputElement>(null)

  const supabase = createClient()

  function addFiles(incoming: File[]) {
    setError(null)
    const accepted: { file: File; mediaType: 'image' | 'video' }[] = []
    let rejectedType = 0
    let rejectedSize = 0

    for (const file of incoming) {
      const kind = detectMediaKind(file)
      if (!kind) { rejectedType++; continue }
      if (kind === 'video' && !isAcceptableVideo(file)) { rejectedSize++; continue }
      if (kind === 'image' && !isAcceptableImage(file)) { rejectedSize++; continue }
      accepted.push({ file, mediaType: kind })
    }

    const room = MAX_FILES_PER_UPLOAD - items.length
    if (room <= 0) {
      setError(`Máximo ${MAX_FILES_PER_UPLOAD} archivos por envío.`)
      return
    }

    if (rejectedType > 0) setError('Algunos archivos no son imágenes ni videos y se omitieron.')
    else if (rejectedSize > 0)
      setError(
        `Algunos archivos superan el límite (fotos: ${MAX_FILE_BYTES / (1024 * 1024)} MB · videos: ${MAX_VIDEO_BYTES / (1024 * 1024)} MB).`
      )
    else if (accepted.length > room)
      setError(`Solo se añadieron ${room}; máximo ${MAX_FILES_PER_UPLOAD}.`)

    accepted.slice(0, room).forEach(({ file, mediaType }) => {
      if (mediaType === 'video') {
        setItems((cur) => [...cur, { file, preview: URL.createObjectURL(file), mediaType }])
      } else {
        const reader = new FileReader()
        reader.onload = (e) =>
          setItems((cur) => [
            ...cur,
            { file, preview: e.target?.result as string, mediaType },
          ])
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
    setItems((prev) => {
      const removed = prev[index]
      if (removed.mediaType === 'video') URL.revokeObjectURL(removed.preview)
      return prev.filter((_, i) => i !== index)
    })
  }

  function clearAll() {
    items.forEach((it) => { if (it.mediaType === 'video') URL.revokeObjectURL(it.preview) })
    setItems([])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (uploading) return

    const validation = validateUploadInput({ uploaderName, message })
    if (!validation.ok) { setError(validation.error); return }
    if (items.length === 0) { setError('Selecciona al menos una foto o video.'); return }

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
          const result = await uploadVideoToCloudinary(
            file,
            `marriedimage/${wedding.id}`,
            (pct) => {
              const base = Math.round((i / items.length) * 100)
              setProgress(base + Math.round(pct / items.length))
            }
          )
          storagePath = result.public_id
        } else {
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
            : `No se pudo subir el archivo. ${msg2 || 'Revisa tu conexión.'}`
        )
        return
      }
    }

    setUploading(false)
    setSuccess(true)
  }

  // ── Success ─────────────────────────────────────────────────────────────────

  if (success) {
    const label = mediaLabel(items)
    return (
      <div className="min-h-screen bg-gradient-to-br from-rose-50 via-pink-50 to-purple-50 flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="text-8xl mb-4" style={{ animation: 'bounce 1s infinite' }}>💌</div>
          <h2 className="text-3xl font-bold text-rose-700 mb-2">
            ¡Gracias, {uploaderName}!
          </h2>
          <p className="text-gray-600 text-lg leading-relaxed mb-1">
            {label} {items.length === 1 ? 'ya forma parte' : 'ya forman parte'} del recuerdo de
          </p>
          <p className="text-rose-600 font-bold text-xl mb-6">{wedding.couple_names} 💕</p>
          <p className="text-gray-400 text-sm mb-8">¡Que disfrutes de la celebración! 🥂</p>
          <button
            onClick={() => {
              clearAll()
              setSuccess(false)
              setMessage('')
              setProgress(0)
            }}
            className="bg-rose-500 hover:bg-rose-600 text-white font-medium px-8 py-3 rounded-2xl transition text-base"
          >
            Enviar más fotos
          </button>
        </div>
      </div>
    )
  }

  // ── Form ─────────────────────────────────────────────────────────────────────

  const weddingDate = wedding.date
    ? new Date(wedding.date + 'T12:00:00').toLocaleDateString('es-ES', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null

  const currentItem = uploading ? items[currentFile - 1] : null
  const currentKind = currentItem?.mediaType ?? 'imagen'
  const submitLabel = mediaLabel(items)

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-pink-50 to-purple-50">

      {/* ── Invitation hero ────────────────────────────────────────────────── */}
      <div className="bg-white/60 backdrop-blur-sm border-b border-rose-100 px-6 py-8 text-center">
        <div className="text-4xl mb-3">💍</div>
        <h1 className="text-2xl font-bold text-rose-800 leading-tight">
          {wedding.couple_names}
        </h1>
        {weddingDate && (
          <p className="text-rose-500 text-sm font-medium mt-1">{weddingDate}</p>
        )}
        <p className="text-gray-600 mt-3 text-base leading-snug max-w-xs mx-auto">
          Te invitan a compartir tus fotos y videos del gran día 🎉
        </p>
      </div>

      {/* ── How it works (3 steps) ─────────────────────────────────────────── */}
      <div className="bg-white/40 border-b border-rose-100 px-4 py-4">
        <div className="max-w-md mx-auto flex justify-around text-center gap-2">
          {[
            { n: '1', icon: '✍️', label: 'Tu nombre' },
            { n: '2', icon: '📸', label: 'Tus fotos' },
            { n: '3', icon: '💌', label: '¡Enviar!' },
          ].map(({ n, icon, label }) => (
            <div key={n} className="flex flex-col items-center gap-1">
              <span className="text-2xl">{icon}</span>
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {n}. {label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Form ───────────────────────────────────────────────────────────── */}
      <div className="max-w-lg mx-auto px-4 py-6 pb-12">
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Nombre */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <label className="block text-sm font-semibold text-gray-600 mb-2">
              ¿Cómo te llamas? <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={uploaderName}
              onChange={(e) => setUploaderName(e.target.value)}
              required
              placeholder="Tu nombre"
              autoComplete="given-name"
              className="w-full border border-gray-200 rounded-xl px-4 py-3.5 text-base focus:outline-none focus:ring-2 focus:ring-rose-300 transition"
            />
          </div>

          {/* Mensaje opcional */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <label className="block text-sm font-semibold text-gray-600 mb-2">
              Un mensaje para los novios{' '}
              <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="¡Felicidades! Que sean muy felices…"
              rows={2}
              className="w-full border border-gray-200 rounded-xl px-4 py-3.5 text-base focus:outline-none focus:ring-2 focus:ring-rose-300 resize-none transition"
            />
          </div>

          {/* Selección de archivos */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <label className="block text-sm font-semibold text-gray-600 mb-3">
              Elige tus fotos o videos <span className="text-rose-400">*</span>
            </label>

            <div className="grid grid-cols-3 gap-2 mb-3">
              <button
                type="button"
                onClick={() => cameraRef.current?.click()}
                className="flex flex-col items-center justify-center gap-1.5 bg-rose-500 hover:bg-rose-600 active:bg-rose-700 text-white rounded-2xl py-5 transition font-medium text-xs"
              >
                <span className="text-2xl">📷</span>
                <span>Tomar foto</span>
              </button>

              <button
                type="button"
                onClick={() => videoRef.current?.click()}
                className="flex flex-col items-center justify-center gap-1.5 bg-purple-500 hover:bg-purple-600 active:bg-purple-700 text-white rounded-2xl py-5 transition font-medium text-xs"
              >
                <span className="text-2xl">🎥</span>
                <span>Grabar video</span>
              </button>

              <button
                type="button"
                onClick={() => galleryRef.current?.click()}
                className="flex flex-col items-center justify-center gap-1.5 border-2 border-rose-200 hover:border-rose-400 hover:bg-rose-50 active:bg-rose-100 text-rose-600 rounded-2xl py-5 transition font-medium text-xs"
              >
                <span className="text-2xl">🖼️</span>
                <span>Mi galería</span>
              </button>
            </div>

            {/* Drag-and-drop — desktop only */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              className={`hidden sm:flex border-2 border-dashed rounded-xl p-4 flex-col items-center justify-center transition ${
                dragging ? 'border-rose-400 bg-rose-50' : 'border-gray-200'
              }`}
            >
              <p className="text-gray-400 text-sm">O arrastra aquí tus fotos y videos</p>
            </div>

            {/* Hidden file inputs */}
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={handleFileChange} className="hidden" />
            <input ref={videoRef} type="file" accept="video/*" capture="environment" onChange={handleFileChange} className="hidden" />
            <input ref={galleryRef} type="file" accept="image/*,video/*" multiple onChange={handleFileChange} className="hidden" />
          </div>

          {/* Preview grid */}
          {items.length > 0 && (
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="flex justify-between items-center mb-3">
                <p className="text-sm font-semibold text-gray-600">
                  {submitLabel} {items.length === 1 ? 'seleccionado' : 'seleccionados'}
                </p>
                <button type="button" onClick={clearAll} className="text-xs text-gray-400 hover:text-red-500 transition">
                  Quitar todos
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {items.map((item, i) => (
                  <div key={i} className="relative aspect-square rounded-xl overflow-hidden bg-gray-100">
                    {item.mediaType === 'video' ? (
                      <VideoThumbnail src={item.preview} />
                    ) : (
                      <img src={item.preview} className="w-full h-full object-cover" alt={`Foto ${i + 1}`} />
                    )}
                    <button
                      type="button"
                      onClick={() => removeItem(i)}
                      className="absolute top-1 right-1 bg-black/60 text-white w-6 h-6 rounded-full text-sm flex items-center justify-center font-bold leading-none z-10"
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

          {/* Progress */}
          {uploading && (
            <div className="bg-white rounded-2xl p-4 shadow-sm space-y-2">
              <div className="flex justify-between text-sm text-gray-600 font-medium">
                <span>
                  Enviando {currentKind === 'video' ? 'video' : 'foto'} {currentFile} de {items.length}…
                </span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-3">
                <div
                  className="bg-rose-400 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              {currentKind === 'video' && (
                <p className="text-xs text-gray-400">Los videos tardan un poco más, ¡ya casi!</p>
              )}
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-100 rounded-2xl p-4">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={uploading || items.length === 0 || !uploaderName.trim()}
            className="w-full bg-rose-500 hover:bg-rose-600 active:bg-rose-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold py-5 rounded-2xl transition text-lg shadow-sm"
          >
            {uploading
              ? `Enviando… ${progress}%`
              : items.length === 0
              ? '📸 Selecciona tus fotos o videos'
              : `💌 Enviar ${submitLabel} al álbum`}
          </button>

          <p className="text-center text-xs text-gray-400 pb-2">
            Tus fotos se guardan de forma segura y solo los novios pueden verlas 🔒
          </p>
        </form>
      </div>
    </div>
  )
}
