"use client"

import { useState } from "react"

import { createSupabaseBrowserClient } from "@/lib/supabase/browser"

type Status = "idle" | "sending" | "sent" | "error"

export function LoginForm({ next }: { next: string }) {
  const [status, setStatus] = useState<Status>("idle")
  const [message, setMessage] = useState("")

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const email = String(new FormData(event.currentTarget).get("email") ?? "")
      .trim()
      .toLowerCase()

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setStatus("error")
      setMessage("Enter a valid email address.")
      return
    }

    setStatus("sending")
    setMessage("")

    // The link has to be requested from the browser. PKCE stores a code
    // verifier that /auth/confirm needs to redeem the link, and a server
    // client only flushes its storage to cookies once a session exists, which
    // it does not while the link is still being sent.
    const supabase = createSupabaseBrowserClient()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${window.location.origin}/auth/confirm?next=${encodeURIComponent(next)}`,
      },
    })

    if (error) {
      console.error("Magic link request failed:", error.message)
      setStatus("error")
      setMessage(
        error.status === 429
          ? "Too many sign-in emails were requested. Please wait and try again."
          : "Could not send the sign-in link. Please try again."
      )
      return
    }

    setStatus("sent")
    setMessage(`We sent a sign-in link to ${email}. It expires in one hour.`)
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-3">
      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-200">
          Work email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@company.com"
          aria-invalid={status === "error"}
          aria-describedby={message ? "login-status" : undefined}
          className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
        />
      </div>
      <button
        type="submit"
        disabled={status === "sending"}
        className="w-full rounded-lg bg-sky-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:opacity-50"
      >
        {status === "sending" ? "Sending link…" : "Email me a sign-in link"}
      </button>

      <p
        id="login-status"
        role="status"
        aria-live="polite"
        className={
          status === "sent"
            ? "text-sm text-emerald-300"
            : status === "error"
              ? "text-sm text-red-300"
              : "sr-only"
        }
      >
        {message || "Form status"}
      </p>
    </form>
  )
}
