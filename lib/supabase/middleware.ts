import { createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session — do not remove this call
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isHostRoute =
    request.nextUrl.pathname.startsWith('/host') &&
    !request.nextUrl.pathname.startsWith('/host/login')

  if (!user && isHostRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/host/login'
    return NextResponse.redirect(url)
  }

  if (user && request.nextUrl.pathname === '/host/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/host'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
