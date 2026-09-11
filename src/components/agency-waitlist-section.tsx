"use client"

import { useId, useState } from "react"
import type { FormEvent } from "react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

/**
 * Agency is not self-serve yet. Capture interest here without blocking Free/Pro
 * visitors who can scan immediately from the hero.
 */
export function AgencyWaitlistSection() {
  const emailId = useId()
  const statusId = useId()
  const [email, setEmail] = useState("")
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">(
    "idle"
  )
  const [message, setMessage] = useState("")

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStatus("loading")
    setMessage("")

    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      const payload = (await response.json()) as { error?: string }

      if (!response.ok) {
        setStatus("error")
        setMessage(payload.error ?? "Something went wrong. Please try again.")
        return
      }

      setStatus("success")
      setMessage("You’re on the Agency list. We’ll confirm scope before charging.")
      setEmail("")
    } catch {
      setStatus("error")
      setMessage("Network error. Check your connection and try again.")
    }
  }

  return (
    <section
      id="agency-waitlist"
      aria-labelledby="agency-waitlist-heading"
      className="border-t border-slate-200 bg-white py-16"
    >
      <div className="mx-auto max-w-xl px-6 text-center">
        <p className="text-sm font-medium tracking-wide text-sky-800 uppercase">
          Agency
        </p>
        <h2
          id="agency-waitlist-heading"
          className="mt-2 text-2xl font-semibold tracking-tight text-slate-950"
        >
          Running a client portfolio?
        </h2>
        <p className="mt-3 text-base text-slate-600">
          Agency seats and white-label reports are next. Leave your work email
          and we’ll reach out when the plan is ready.
        </p>
        <form onSubmit={handleSubmit} className="mt-8 text-left" noValidate>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <label
                htmlFor={emailId}
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                Work email
              </label>
              <Input
                id={emailId}
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@agency.com"
                aria-describedby={status !== "idle" ? statusId : undefined}
                aria-invalid={status === "error"}
                className="h-11 border-slate-300 bg-white px-3"
              />
            </div>
            <Button
              type="submit"
              disabled={status === "loading"}
              className="h-11 shrink-0 bg-slate-900 px-5 text-sm font-semibold text-white hover:bg-slate-800"
            >
              {status === "loading" ? "Joining…" : "Join Agency waitlist"}
            </Button>
          </div>
          <p className="mt-3 text-sm text-slate-500">
            Free and Pro are live today.{" "}
            <Link
              href="/login?next=/scan"
              className="font-medium text-sky-800 underline underline-offset-4 hover:text-sky-900"
            >
              Start a free scan
            </Link>
            .
          </p>
          <p
            id={statusId}
            role="status"
            aria-live="polite"
            className={`mt-3 text-sm ${
              status === "success"
                ? "text-emerald-700"
                : status === "error"
                  ? "text-red-700"
                  : "sr-only"
            }`}
          >
            {message || "Form status"}
          </p>
        </form>
      </div>
    </section>
  )
}
