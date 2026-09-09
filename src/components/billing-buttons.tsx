"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

async function postBilling(path: string) {
  const response = await fetch(path, { method: "POST" })
  const payload = (await response.json()) as { url?: string; error?: string; code?: string }

  if (response.status === 401 || payload.code === "AUTH_REQUIRED") {
    return { kind: "redirect" as const, path: "/login?next=/scan" }
  }

  if (!response.ok || !payload.url) {
    throw new Error(payload.error ?? "Billing request failed")
  }

  return { kind: "checkout" as const, url: payload.url }
}

export function UpgradeButton({
  className,
  featured = false,
  compact = false,
}: {
  className?: string
  featured?: boolean
  compact?: boolean
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")

  return (
    <div className={cn(compact ? undefined : "w-full", className)}>
      <button
        type="button"
        disabled={pending}
        onClick={async () => {
          setPending(true)
          setError("")
          try {
            const result = await postBilling("/api/billing/checkout")
            if (result.kind === "redirect") {
              router.push(result.path)
              return
            }
            window.location.href = result.url
          } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Upgrade failed")
            setPending(false)
          }
        }}
        className={
          compact
            ? "rounded border border-sky-700 bg-sky-950/50 px-2 py-1 text-sky-200 transition hover:border-sky-500 hover:text-white disabled:opacity-50"
            : cn(
                buttonVariants({ variant: featured ? "default" : "outline" }),
                "h-10 w-full",
                featured && "bg-sky-700 text-white hover:bg-sky-800",
                "disabled:opacity-50"
              )
        }
      >
        {pending ? "Redirecting…" : "Upgrade to Pro"}
      </button>
      {error ? (
        <p
          className={cn(
            "mt-2 text-xs text-red-600",
            compact ? "text-red-400" : "text-center"
          )}
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </div>
  )
}

export function ManageBillingButton({ className }: { className?: string }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")

  return (
    <div className={className}>
      <button
        type="button"
        disabled={pending}
        onClick={async () => {
          setPending(true)
          setError("")
          try {
            const result = await postBilling("/api/billing/portal")
            if (result.kind === "redirect") {
              router.push(result.path)
              return
            }
            window.location.href = result.url
          } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Could not open billing")
            setPending(false)
          }
        }}
        className="rounded border border-slate-700 px-2 py-1 text-slate-300 transition hover:border-slate-500 hover:text-white disabled:opacity-50"
      >
        {pending ? "Opening…" : "Manage billing"}
      </button>
      {error ? (
        <p className="mt-1 text-xs text-red-400" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
