import { redirect } from "next/navigation"

import { AppNav } from "@/components/app-nav"
import { ScanConsole } from "@/components/scan-console"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { loadUsage } from "@/lib/usage"

export const metadata = {
  title: "Scanner — A11yFix",
}

export default async function ScanPage({
  searchParams,
}: PageProps<"/scan">) {
  const params = await searchParams
  const upgraded = params.upgraded === "1"

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login?next=/scan")
  }

  const usage = await loadUsage(supabase, user.id)

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <AppNav
        email={user.email ?? ""}
        plan={usage.plan}
        scansUsed={usage.scansUsed}
      />
      {upgraded ? (
        <p
          role="status"
          className="mx-auto max-w-4xl px-8 pt-4 text-sm text-emerald-300"
        >
          Payment received. Your Pro plan unlocks as soon as Stripe confirms the
          subscription—usually within a few seconds. Refresh if the header still
          says Free.
        </p>
      ) : null}
      <ScanConsole
        initialUsage={{
          planLabel: usage.limits.label,
          scansUsed: usage.scansUsed,
          scansLimit: usage.limits.scansPerMonth,
          sites: usage.limits.sites,
        }}
      />
    </div>
  )
}
