'use client'

import { useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

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
}

export default function UploadFunnel({ wedding }: Props) {
  const [uploaderName, setUploaderName] = useState('')
  const [message, setMessage] = useState('')
  const [items, setItems] = useState<FilePreview[]>([])
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  function addFiles(incoming: File[]) {
    const imageFiles = incoming.filter((f) => f.type.startsWith('image/'))
    imageFiles.forEach((file) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        setItems((prev) => [...prev, { file, preview: e.target?.result as string }])
      }
      reader.readAsDataURL(file)
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
    if (!uploaderName.trim() || items.length === 0) return

    setUploading(true)
    setError(null)
    setProgress(0)

    try {
      for (let i = 0; i < items.length; i++) {
        const { file } = items[i]
        const ext = file.name.split('.').pop() ?? 'jpg'
        const path = `${wedding.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

        const { error: uploadErr } = await supabase.storage
          .from('wedding-photos')
          .upload(path, file, { contentType: file.type })

        if (uploadErr) throw uploadErr

        const { error: dbErr } = await supabase.from('photos').insert({
          wedding_id: wedding.id,
          uploader_name: uploaderName.trim(),
          message: message.trim() || null,
          storage_path: path,
        })

        if (dbErr) throw dbErr

        setProgress(Math.round(((i + 1) / items.length) * 100))
      }
      setSuccess(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al subir las fotos')
    } finally {
      setUploading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-rose-50 via-pink-50 to-purple-50 flex items-center justify-center p-4">
        <div className="text-center animate-in fade-in duration-500">
          <div className="text-7xl mb-5">💌</div>
          <h2 className="text-2xl font-semibold text-gray-800 mb-2">
            ¡Gracias, {uploaderName}!
          </h2>
          <p className="text-gray-500">
            Tus fotos fueron enviadas a{' '}
            <span className="text-rose-500 font-medium">{wedding.couple_names}</span>
          </p>
          <button
            onClick={() => {
              setSuccess(false)
              setItems([])
              setMessage('')
              setProgress(0)
            }}
            className="mt-6 text-rose-500 hover:text-rose-700 text-sm hover:underline transition"
          >
            Enviar más fotos →
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-pink-50 to-purple-50">
      <div className="max-w-lg mx-auto px-4 py-10 pb-20">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">💍</div>
          <h1 className="text-3xl font-light text-rose-900">{wedding.couple_names}</h1>
          <p className="text-gray-500 mt-1 text-sm">{wedding.name}</p>
          {wedding.date && (
            <p className="text-rose-400 text-sm mt-1">
              {new Date(wedding.date + 'T12:00:00').toLocaleDateString('es-ES', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </p>
          )}
          <p className="text-gray-600 mt-4 text-base">
            Comparte tus mejores momentos 📸
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Tu nombre <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={uploaderName}
              onChange={(e) => setUploaderName(e.target.value)}
              required
              placeholder="¿Cómo te llamas?"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-rose-300 transition"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Mensaje para los novios{' '}
              <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="¡Felicidades! Que sean muy felices..."
              rows={2}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-rose-300 resize-none transition"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Tus fotos <span className="text-rose-400">*</span>
            </label>
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition ${
                dragging
                  ? 'border-rose-400 bg-rose-50'
                  : 'border-rose-200 hover:border-rose-400 hover:bg-rose-50'
              }`}
            >
              <div className="text-4xl mb-2">📷</div>
              <p className="text-gray-600 font-medium">Toca para seleccionar fotos</p>
              <p className="text-gray-400 text-xs mt-1">o arrastra y suelta aquí</p>
              <p className="text-gray-300 text-xs mt-1">JPG · PNG · HEIC · múltiples archivos</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {items.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {items.map((item, i) => (
                <div key={i} className="relative aspect-square rounded-xl overflow-hidden group">
                  <img
                    src={item.preview}
                    className="w-full h-full object-cover"
                    alt={`Preview ${i + 1}`}
                  />
                  <button
                    type="button"
                    onClick={() => removeItem(i)}
                    className="absolute top-1 right-1 bg-black/60 text-white w-6 h-6 rounded-full text-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition font-bold leading-none"
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="aspect-square rounded-xl border-2 border-dashed border-gray-200 hover:border-rose-300 flex items-center justify-center text-2xl text-gray-300 hover:text-rose-400 transition"
              >
                +
              </button>
            </div>
          )}

          {uploading && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-500">
                <span>Subiendo fotos...</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2.5">
                <div
                  className="bg-rose-400 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {error && (
            <p className="text-red-500 text-sm bg-red-50 px-3 py-2 rounded-xl">{error}</p>
          )}

          <button
            type="submit"
            disabled={uploading || items.length === 0 || !uploaderName.trim()}
            className="w-full bg-rose-500 hover:bg-rose-600 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold py-4 rounded-2xl transition text-base"
          >
            {uploading
              ? `Enviando... ${progress}%`
              : `Enviar ${items.length > 0 ? items.length : ''} foto${items.length !== 1 ? 's' : ''}`}
          </button>
        </form>
      </div>
    </div>
  )
}
