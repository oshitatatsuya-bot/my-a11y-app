"use server"

import { safeRedirectPath, siteOrigin } from "@/lib/site"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export interface LoginState {
  status: "idle" | "sent" | "error"
  message: string
}

export async function sendMagicLink(
  _previous: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase()
  const next = safeRedirectPath(String(formData.get("next") ?? ""))

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { status: "error", message: "Enter a valid email address." }
  }

  const supabase = await createSupabaseServerClient()
  const origin = await siteOrigin()

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: `${origin}/auth/confirm?next=${encodeURIComponent(next)}`,
    },
  })

  if (error) {
    console.error("Magic link request failed:", error.message)
    return {
      status: "error",
      message: "Could not send the sign-in link. Please try again.",
    }
  }

  return {
    status: "sent",
    message: `We sent a sign-in link to ${email}. It expires in one hour.`,
  }
}
