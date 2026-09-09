import { createClient } from "@supabase/supabase-js"

import { supabaseCredentials } from "./credentials"

/**
 * Service-role client for privileged writes (billing webhooks). Never expose
 * this key to the browser or to Vercel env as NEXT_PUBLIC_*.
 */
export function createSupabaseAdminClient() {
  const { url } = supabaseCredentials()
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!serviceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY")
  }

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
