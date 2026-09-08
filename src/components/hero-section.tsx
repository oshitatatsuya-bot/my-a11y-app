"use client"

import { useId, useState } from "react"
import type { FormEvent } from "react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function HeroSection() {
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
      setMessage("You’re on the list. We’ll reach out when your workspace is ready.")
      setEmail("")
    } catch {
      setStatus("error")
      setMessage("Network error. Check your connection and try again.")
    }
  }

  return (
    <section
      id="waitlist"
      aria-labelledby="hero-heading"
      className="relative overflow-hidden border-b border-slate-800 bg-slate-950"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(14,165,233,0.18),_transparent_55%)]"
      />
      <div className="relative mx-auto grid max-w-6xl gap-12 px-6 py-20 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-center lg:py-28">
        <div>
          <p className="mb-4 text-sm font-medium tracking-wide text-sky-300 uppercase">
            WCAG 2.2 · ADA · Section 508
          </p>
          <h1
            id="hero-heading"
            className="max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-5xl sm:leading-tight"
          >
            Fix WCAG &amp; ADA Compliance Issues Before You Get Sued
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-300">
            Scan production pages, ship AI-generated code fixes, and prove
            progress to legal and procurement—without overlay widgets or a
            six-figure audit retainer.
          </p>
          <form
            onSubmit={handleSubmit}
            className="mt-8 max-w-xl"
            noValidate
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1">
                <label
                  htmlFor={emailId}
                  className="mb-1.5 block text-sm font-medium text-slate-200"
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
                  placeholder="you@company.com"
                  aria-describedby={status !== "idle" ? statusId : undefined}
                  aria-invalid={status === "error"}
                  className="h-11 border-slate-700 bg-slate-900 px-3 text-white placeholder:text-slate-500"
                />
              </div>
              <Button
                type="submit"
                disabled={status === "loading"}
                className="h-11 shrink-0 bg-sky-500 px-5 text-sm font-semibold text-slate-950 hover:bg-sky-400"
              >
                {status === "loading" ? "Joining…" : "Join the waitlist"}
              </Button>
            </div>
            <p className="mt-3 text-sm text-slate-400">
              No spam. Early access for engineering, legal, and agency teams.{" "}
              By joining you agree to the{" "}
              <Link
                href="/privacy"
                className="font-medium text-sky-300 underline underline-offset-4 hover:text-sky-200"
              >
                privacy policy
              </Link>
              .{" "}
              <Link
                href="/scan"
                className="font-medium text-sky-300 underline underline-offset-4 hover:text-sky-200"
              >
                Or scan a page now on the free plan
              </Link>
              .
            </p>
            <p
              id={statusId}
              role="status"
              aria-live="polite"
              className={`mt-3 text-sm ${
                status === "success"
                  ? "text-emerald-300"
                  : status === "error"
                    ? "text-red-300"
                    : "sr-only"
              }`}
            >
              {message || "Form status"}
            </p>
          </form>
        </div>
        <aside
          aria-label="Product snapshot"
          className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-sky-950/40"
        >
          <p className="text-xs font-medium tracking-wide text-slate-400 uppercase">
            Sample scan summary
          </p>
          <dl className="mt-5 grid grid-cols-2 gap-4">
            <div className="rounded-xl bg-slate-950 p-4">
              <dt className="text-sm text-slate-400">Critical issues</dt>
              <dd className="mt-1 text-2xl font-semibold text-white">12</dd>
            </div>
            <div className="rounded-xl bg-slate-950 p-4">
              <dt className="text-sm text-slate-400">WCAG AA coverage</dt>
              <dd className="mt-1 text-2xl font-semibold text-white">74%</dd>
            </div>
            <div className="col-span-2 rounded-xl bg-slate-950 p-4">
              <dt className="text-sm text-slate-400">Suggested fix</dt>
              <dd className="mt-2 font-mono text-sm leading-relaxed text-sky-200">
                {`aria-labelledby="checkout-heading"`}
              </dd>
            </div>
          </dl>
        </aside>
      </div>
    </section>
  )
}
