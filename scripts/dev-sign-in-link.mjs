/**
 * Prints a working sign-in link without sending an email.
 *
 * Supabase's built-in mail service allows two messages per hour per project,
 * which runs out quickly while testing the sign-in flow. The admin API can
 * mint the same one-time token the email would have carried, so this asks for
 * one and formats it as a link to /auth/confirm.
 *
 * Local use only: it needs the service role key, which bypasses row level
 * security entirely.
 *
 *   npm run dev:link -- you@example.com [/scan]
 */
import { createClient } from "@supabase/supabase-js"

const [email, next = "/scan"] = process.argv.slice(2)
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const origin = process.env.DEV_ORIGIN ?? "http://localhost:3000"

if (!email) {
  console.error("Usage: npm run dev:link -- you@example.com [/scan]")
  process.exit(1)
}

if (!url || !serviceRoleKey) {
  console.error(
    "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local.\n" +
      "The service role key is in the dashboard under Project Settings > API Keys."
  )
  process.exit(1)
}

const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const { data, error } = await admin.auth.admin.generateLink({
  type: "magiclink",
  email,
})

if (error) {
  console.error(`Could not generate a link for ${email}: ${error.message}`)
  process.exit(1)
}

// The hashed token is what a customised email template would embed, and
// /auth/confirm already knows how to redeem that shape.
const link = new URL("/auth/confirm", origin)
link.searchParams.set("token_hash", data.properties.hashed_token)
link.searchParams.set("type", "magiclink")
link.searchParams.set("next", next)

console.log(`\nSign-in link for ${email} (single use, expires in one hour):\n`)
console.log(link.href)
console.log("")
