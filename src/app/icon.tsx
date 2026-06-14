import { ImageResponse } from 'next/og'

export const size = { width: 512, height: 512 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: 'linear-gradient(135deg, #f43f5e 0%, #be123c 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 120,
        }}
      >
        <div style={{ fontSize: 280, lineHeight: 1 }}>💍</div>
      </div>
    ),
    { ...size }
  )
}
