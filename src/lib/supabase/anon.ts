import { createClient } from "@supabase/supabase-js"

import { supabaseCredentials } from "./credentials"

/**
 * Session-less client for endpoints that must not depend on request cookies,
 * such as the publicly cached badge image and the waitlist form.
 */
export function createAnonClient() {
  const { url, anonKey } = supabaseCredentials()

  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
