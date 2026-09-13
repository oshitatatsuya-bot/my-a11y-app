import { notFound, redirect } from "next/navigation"

import {
  IMPACT_ORDER,
  WCAG_TAGS,
  normalizeImpact,
  type Impact,
  type Violation,
} from "@/lib/a11y"
import { buildConformanceStatementHtml } from "@/lib/conformance-statement"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const metadata = {
  title: "Conformance statement — A11yFix",
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
              target: Array.isArray(n.target) ? n.target.map(String) : [],
              failureSummary:
                typeof n.failureSummary === "string" ? n.failureSummary : "",
            },
          ]
        })
      : []
    return [
      {
        id: v.id,
        impact: normalizeImpact(typeof v.impact === "string" ? v.impact : null),
        description: typeof v.description === "string" ? v.description : "",
        help: v.help,
        helpUrl: typeof v.helpUrl === "string" ? v.helpUrl : "#",
        nodes,
      },
    ]
  })
}

export default async function ConformanceStatementPage({
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
    redirect(`/login?next=/history/${id}/statement`)
  }

  const { data: scan } = await supabase
    .from("scans")
    .select(
      "id, url, host, score, violations_count, elements_affected, critical_count, serious_count, moderate_count, minor_count, violations, created_at"
    )
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle()

  if (!scan) notFound()

  const violations = parseViolations(scan.violations)
  const counts = emptyCounts()
  for (const key of IMPACT_ORDER) {
    const col = `${key}_count` as keyof typeof scan
    counts[key] = Number(scan[col] ?? 0)
  }

  const html = buildConformanceStatementHtml({
    host: scan.host,
    url: scan.url,
    scannedAt: scan.created_at,
    score: scan.score,
    standards: [...WCAG_TAGS],
    rulesPassed: null,
    violationsCount: scan.violations_count,
    counts,
    violations,
  })

  return (
    <iframe
      title="Accessibility conformance statement"
      srcDoc={html}
      className="min-h-screen w-full border-0 bg-white"
      sandbox="allow-scripts allow-modals allow-same-origin"
    />
  )
}
