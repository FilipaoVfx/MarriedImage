'use client'

import { useState, useEffect, useActionState } from 'react'
import Link from 'next/link'
import { createWedding, signOut } from '@/app/actions'
import { copyToClipboard } from '@/lib/clipboard'
import type { Wedding } from '@/types/database'
import type { User } from '@supabase/supabase-js'

export default function DashboardClient({
  user,
  weddings,
}: {
  user: User
  weddings: Wedding[]
}) {
  const [showCreate, setShowCreate] = useState(false)
  const [coupleNames, setCoupleNames] = useState('')
  const [copied, setCopied] = useState<string | null>(null)
  const [state, formAction, pending] = useActionState(createWedding, null)

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''

  // Close the modal only once the server action actually succeeded.
  useEffect(() => {
    if (state?.success) {
      setShowCreate(false)
      setCoupleNames('')
    }
  }, [state])

  async function copyLink(slug: string) {
    const ok = await copyToClipboard(`${baseUrl}/upload/${slug}`)
    if (ok) {
      setCopied(slug)
      setTimeout(() => setCopied(null), 2000)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 to-pink-50">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-light text-rose-900">💍 MarriedImage</h1>
          <div className="flex items-center gap-4">
            <span className="text-gray-400 text-sm hidden sm:block">{user.email}</span>
            <form action={signOut}>
              <button className="text-sm text-rose-500 hover:underline">Salir</button>
            </form>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-800">
            Mis bodas{' '}
            <span className="text-gray-400 font-normal text-base">({weddings.length})</span>
          </h2>
          <button
            onClick={() => setShowCreate(true)}
            className="bg-rose-500 hover:bg-rose-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition"
          >
            + Nueva boda
          </button>
        </div>

        {weddings.length === 0 ? (
          <div className="text-center py-24 text-gray-400">
            <div className="text-6xl mb-4">📷</div>
            <p className="text-lg font-medium">Aún no tienes bodas creadas</p>
            <p className="text-sm mt-1">Crea tu primer evento y comparte el enlace con tus invitados</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {weddings.map((wedding) => (
              <div
                key={wedding.id}
                className="bg-white rounded-2xl shadow-sm p-6 hover:shadow-md transition"
              >
                <h3 className="font-semibold text-gray-800 text-lg leading-tight">
                  {wedding.couple_names}
                </h3>
                <p className="text-gray-500 text-sm mt-1">{wedding.name}</p>
                {wedding.date && (
                  <p className="text-rose-400 text-sm mt-1">
                    {new Date(wedding.date + 'T12:00:00').toLocaleDateString('es-ES', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </p>
                )}

                <div className="mt-4 p-3 bg-gray-50 rounded-xl">
                  <p className="text-xs text-gray-400 mb-1">Enlace para invitados</p>
                  <p className="text-xs text-rose-500 break-all font-mono">
                    {baseUrl}/upload/{wedding.slug}
                  </p>
                </div>

                <div className="mt-4 flex gap-2">
                  <Link
                    href={`/dashboard/${wedding.id}`}
                    className="flex-1 text-center bg-rose-500 hover:bg-rose-600 text-white text-sm py-2 rounded-xl transition font-medium"
                  >
                    Ver fotos
                  </Link>
                  <button
                    onClick={() => copyLink(wedding.slug)}
                    className="px-4 py-2 border border-rose-200 text-rose-500 hover:bg-rose-50 text-sm rounded-xl transition"
                    title="Copiar enlace"
                  >
                    {copied === wedding.slug ? '✓' : '🔗'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-semibold mb-5">Crear evento de boda</h3>
            <form action={formAction} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre del evento
                </label>
                <input
                  name="name"
                  type="text"
                  required
                  placeholder="Ej: Boda de Ana y Carlos"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-rose-300"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombres de los novios
                </label>
                <input
                  name="couple_names"
                  type="text"
                  required
                  placeholder="Ej: Ana & Carlos"
                  value={coupleNames}
                  onChange={(e) => setCoupleNames(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-rose-300"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha (opcional)
                </label>
                <input
                  name="date"
                  type="date"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-rose-300"
                />
              </div>

              {state?.error && (
                <p className="text-red-500 text-sm bg-red-50 px-3 py-2 rounded-lg">
                  {state.error}
                </p>
              )}

              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreate(false)
                    setCoupleNames('')
                  }}
                  className="px-4 py-2 text-gray-500 hover:text-gray-700 text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="bg-rose-500 hover:bg-rose-600 text-white px-6 py-2 rounded-xl text-sm font-medium disabled:opacity-50 transition"
                >
                  {pending ? 'Creando...' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
