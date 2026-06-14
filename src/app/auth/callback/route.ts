import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  // Only allow same-origin relative redirects to avoid open-redirect abuse.
  const nextParam = searchParams.get('next') ?? '/dashboard'
  const next = nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/dashboard'

  if (code) {
    try {
      const cookieStore = await cookies()
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() {
              return cookieStore.getAll()
            },
            setAll(cookiesToSet: { name: string; value: string; options?: object }[]) {
              cookiesToSet.forEach(({ name, value, options }) =>
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                cookieStore.set(name, value, options as any)
              )
            },
          },
        }
      )
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      if (!error) {
        return NextResponse.redirect(`${origin}${next}`)
      }
    } catch {
      // fall through to the error redirect
    }
  }

  return NextResponse.redirect(`${origin}/?error=auth`)
}
