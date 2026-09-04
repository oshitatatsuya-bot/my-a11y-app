import { NextResponse, type NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"

import { supabaseCredentials } from "@/lib/supabase/credentials"

const PROTECTED_PREFIXES = ["/scan", "/history"]

export async function proxy(request: NextRequest) {
  const { url, anonKey } = supabaseCredentials()
  let response = NextResponse.next({ request })

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet, headers) => {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value)
        }

        response = NextResponse.next({ request })

        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options)
        }

        // Responses that set auth cookies must not be cached, or one user's
        // token can be served to another.
        for (const [header, value] of Object.entries(headers ?? {})) {
          response.headers.set(header, value)
        }
      },
    },
  })

  // Refreshes an expiring session and writes the new tokens to the response.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )

  if (!user && isProtected) {
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("next", pathname)
    return NextResponse.redirect(loginUrl)
  }

  return response
}

export const config = {
  // Static assets and the public badge image are excluded: the badge is cached
  // by CDNs and must never depend on a session.
  matcher: [
    "/((?!_next/static|_next/image|api/badge|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
}
