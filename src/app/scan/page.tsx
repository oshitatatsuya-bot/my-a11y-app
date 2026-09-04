import { redirect } from "next/navigation"

import { AppNav } from "@/components/app-nav"
import { ScanConsole } from "@/components/scan-console"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { loadUsage } from "@/lib/usage"

export const metadata = {
  title: "Scanner — A11yFix",
}

export default async function ScanPage() {
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
