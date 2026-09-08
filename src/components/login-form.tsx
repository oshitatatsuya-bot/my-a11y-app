"use client"

import { useEffect, useState } from "react"

import { createSupabaseBrowserClient } from "@/lib/supabase/browser"

type Status = "idle" | "sending" | "sent" | "error"

/** Supabase reports its send throttle as "you can only request this after N seconds". */
function throttleSeconds(reason: string) {
  const match = /after (\d+) seconds?/.exec(reason)

  return match ? Number(match[1]) : 60
}

export function LoginForm({ next }: { next: string }) {
  const [status, setStatus] = useState<Status>("idle")
  const [message, setMessage] = useState("")
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (cooldown <= 0) return

    const timer = setTimeout(() => setCooldown(cooldown - 1), 1000)

    return () => clearTimeout(timer)
  }, [cooldown])

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
      setStatus("error")

      // Being throttled is a normal thing to run into, so it reports how long
      // the wait is instead of surfacing as an application error.
      if (error.status === 429) {
        setMessage("")
        setCooldown(throttleSeconds(error.message))
        return
      }

      console.error("Magic link request failed:", error.message)
      setMessage("Could not send the sign-in link. Please try again.")
      return
    }

    setStatus("sent")
    setMessage(`We sent a sign-in link to ${email}. It expires in one hour.`)
  }

  const statusMessage =
    cooldown > 0
      ? `Supabase limits how often sign-in emails go out. You can request another in ${cooldown} seconds.`
      : message

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
        disabled={status === "sending" || cooldown > 0}
        className="w-full rounded-lg bg-sky-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:opacity-50"
      >
        {status === "sending"
          ? "Sending link…"
          : cooldown > 0
            ? `Try again in ${cooldown}s`
            : "Email me a sign-in link"}
      </button>

      <p
        id="login-status"
        role="status"
        aria-live="polite"
        className={
          status === "sent"
            ? "text-sm text-emerald-300"
            : statusMessage
              ? "text-sm text-red-300"
              : "sr-only"
        }
      >
        {statusMessage || "Form status"}
      </p>
    </form>
  )
}
