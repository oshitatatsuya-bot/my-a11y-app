"use client"

import { useActionState } from "react"

import { sendMagicLink, type LoginState } from "@/app/login/actions"

const INITIAL_STATE: LoginState = { status: "idle", message: "" }

export function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState(sendMagicLink, INITIAL_STATE)

  return (
    <form action={formAction} className="mt-6 space-y-3">
      <input type="hidden" name="next" value={next} />
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
          aria-invalid={state.status === "error"}
          aria-describedby={state.message ? "login-status" : undefined}
          className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-sky-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:opacity-50"
      >
        {pending ? "Sending link…" : "Email me a sign-in link"}
      </button>

      <p
        id="login-status"
        role="status"
        aria-live="polite"
        className={
          state.status === "sent"
            ? "text-sm text-emerald-300"
            : state.status === "error"
              ? "text-sm text-red-300"
              : "sr-only"
        }
      >
        {state.message || "Form status"}
      </p>
    </form>
  )
}
