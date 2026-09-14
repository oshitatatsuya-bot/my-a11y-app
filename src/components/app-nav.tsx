import Link from "next/link"

import { ManageBillingButton, UpgradeButton } from "@/components/billing-buttons"
import { planLimits } from "@/lib/plans"

interface AppNavProps {
  email: string
  plan: string
  scansUsed: number
}

export function AppNav({ email, plan, scansUsed }: AppNavProps) {
  const limits = planLimits(plan)
  const isPaid = plan === "pro" || plan === "agency"

  return (
    <header className="border-b border-slate-800">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-4 px-8 py-4">
        <nav aria-label="Application" className="flex items-center gap-6 text-sm">
          <Link href="/" className="font-semibold tracking-tight text-white">
            A11yFix
          </Link>
          <Link href="/scan" className="text-slate-300 hover:text-white">
            Scanner
          </Link>
          <Link href="/history" className="text-slate-300 hover:text-white">
            History
          </Link>
          <Link href="/guide" className="text-slate-300 hover:text-white">
            Guide
          </Link>
        </nav>
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
          <span>
            {limits.label} plan · {scansUsed}/{limits.scansPerMonth} scans this month
          </span>
          {isPaid ? (
            <ManageBillingButton />
          ) : (
            <UpgradeButton compact />
          )}
          <span className="hidden sm:inline">{email}</span>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="rounded border border-slate-700 px-2 py-1 text-slate-300 transition hover:border-slate-500 hover:text-white"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  )
}
