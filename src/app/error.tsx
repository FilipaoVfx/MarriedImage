'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 to-pink-100 flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <div className="text-6xl mb-4">💔</div>
        <h1 className="text-2xl font-semibold text-gray-800 mb-2">Algo salió mal</h1>
        <p className="text-gray-500 mb-6">
          Ocurrió un problema al cargar esta página. Inténtalo de nuevo.
        </p>
        <button
          onClick={reset}
          className="bg-rose-500 hover:bg-rose-600 text-white font-medium px-6 py-3 rounded-2xl transition"
        >
          Reintentar
        </button>
      </div>
    </div>
  )
}
