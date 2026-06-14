'use client'

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="es">
      <body
        style={{
          fontFamily: 'system-ui, sans-serif',
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #fff1f2, #fce7f3)',
          margin: 0,
        }}
      >
        <div style={{ textAlign: 'center', maxWidth: 360, padding: 24 }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>💔</div>
          <h1 style={{ fontSize: 24, color: '#1f2937', marginBottom: 8 }}>
            Algo salió mal
          </h1>
          <p style={{ color: '#6b7280', marginBottom: 24 }}>
            Ocurrió un error inesperado. Inténtalo de nuevo.
          </p>
          <button
            onClick={reset}
            style={{
              background: '#f43f5e',
              color: 'white',
              border: 'none',
              padding: '12px 24px',
              borderRadius: 16,
              fontSize: 16,
              cursor: 'pointer',
            }}
          >
            Reintentar
          </button>
        </div>
      </body>
    </html>
  )
}
