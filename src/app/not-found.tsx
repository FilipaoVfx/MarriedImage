import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 to-pink-100 flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <div className="text-6xl mb-4">🔍</div>
        <h1 className="text-2xl font-semibold text-gray-800 mb-2">Página no encontrada</h1>
        <p className="text-gray-500 mb-6">
          El enlace que buscas no existe o el evento ya no está disponible.
        </p>
        <Link
          href="/"
          className="inline-block bg-rose-500 hover:bg-rose-600 text-white font-medium px-6 py-3 rounded-2xl transition"
        >
          Volver al inicio
        </Link>
      </div>
    </div>
  )
}
