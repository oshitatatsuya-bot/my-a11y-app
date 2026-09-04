import { createBrowserClient } from "@supabase/ssr"

import { supabaseCredentials } from "./credentials"

export function createSupabaseBrowserClient() {
  const { url, anonKey } = supabaseCredentials()

  return createBrowserClient(url, anonKey)
}
