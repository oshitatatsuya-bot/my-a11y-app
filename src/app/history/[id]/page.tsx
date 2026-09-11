import Link from "next/link"
import { notFound, redirect } from "next/navigation"

import { AppNav } from "@/components/app-nav"
import { ScanResults, type ScanResultView } from "@/components/scan-results"
import {
  IMPACT_ORDER,
  normalizeImpact,
  type Impact,
  type Violation,
} from "@/lib/a11y"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { loadUsage } from "@/lib/usage"

export const metadata = {
  title: "Scan detail — A11yFix",
}

function emptyCounts(): Record<Impact, number> {
  return { critical: 0, serious: 0, moderate: 0, minor: 0 }
}

function parseViolations(raw: unknown): Violation[] {
  if (!Array.isArray(raw)) return []

  return raw.flatMap((item) => {
    if (!item || typeof item !== "object") return []
    const v = item as Record<string, unknown>
    if (typeof v.id !== "string" || typeof v.help !== "string") return []

    const nodes = Array.isArray(v.nodes)
      ? v.nodes.flatMap((node) => {
          if (!node || typeof node !== "object") return []
          const n = node as Record<string, unknown>
          if (typeof n.html !== "string") return []
          return [
            {
              html: n.html,
              target: Array.isArray(n.target)
                ? n.target.map(String)
                : [],
              failureSummary:
                typeof n.failureSummary === "string" ? n.failureSummary : "",
            },
          ]
        })
      : []

    return [
      {
        id: v.id,
        impact: normalizeImpact(
          typeof v.impact === "string" ? v.impact : null
        ),
        description: typeof v.description === "string" ? v.description : "",
        help: v.help,
        helpUrl: typeof v.helpUrl === "string" ? v.helpUrl : "#",
        nodes,
      },
    ]
  })
}

export default async function HistoryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/login?next=/history/${id}`)
  }

  const [usage, { data: scan, error }] = await Promise.all([
    loadUsage(supabase, user.id),
    supabase
      .from("scans")
      .select(
        "id, url, host, score, violations_count, elements_affected, critical_count, serious_count, moderate_count, minor_count, violations, created_at"
      )
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle(),
  ])

  if (error || !scan) {
    notFound()
  }

  const { data: badge } = await supabase
    .from("badges")
    .select("token")
    .eq("user_id", user.id)
    .eq("host", scan.host)
    .maybeSingle()

  const counts = emptyCounts()
  counts.critical = scan.critical_count ?? 0
  counts.serious = scan.serious_count ?? 0
  counts.moderate = scan.moderate_count ?? 0
  counts.minor = scan.minor_count ?? 0

  // Prefer stored counts; fall back to recomputing from the JSON payload.
  if (IMPACT_ORDER.every((impact) => counts[impact] === 0)) {
    for (const violation of parseViolations(scan.violations)) {
      counts[violation.impact] += violation.nodes.length
    }
  }

  const origin =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "https://www.geta11yfix.com"

  const result: ScanResultView = {
    scanId: scan.id,
    url: scan.url,
    host: scan.host,
    timestamp: scan.created_at,
    rulesPassed: null,
    violationsCount: scan.violations_count,
    score: scan.score,
    elementsAffected: scan.elements_affected,
    counts,
    violations: parseViolations(scan.violations),
    badgeUrl: badge?.token
      ? `${origin}/api/badge?token=${badge.token}`
      : null,
  }

  const formatter = new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  })

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <AppNav
        email={user.email ?? ""}
        plan={usage.plan}
        scansUsed={usage.scansUsed}
      />
      <main className="mx-auto max-w-4xl space-y-8 p-8">
        <div>
          <p className="text-sm text-slate-500">
            <Link href="/history" className="text-sky-400 hover:underline">
              ← Scan history
            </Link>
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight">Scan detail</h1>
          <p className="mt-2 text-slate-400">
            Saved {formatter.format(new Date(scan.created_at))} UTC. Re-run AI
            fixes without spending another scan.
          </p>
        </div>
        <ScanResults result={result} />
      </main>
    </div>
  )
}
