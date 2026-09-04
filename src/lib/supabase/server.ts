import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"

import { supabaseCredentials } from "./credentials"

/**
 * Request-scoped client that reads the session from cookies. A new client must
 * be created per request; sharing one would leak sessions between users.
 */
export async function createSupabaseServerClient() {
  const { url, anonKey } = supabaseCredentials()
  const cookieStore = await cookies()

  return createServerClient(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        } catch {
          // Server Components cannot write cookies. The proxy refreshes the
          // session for those requests, so this can be ignored.
        }
      },
    },
  })
}

export async function getSessionUser() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return user
}
