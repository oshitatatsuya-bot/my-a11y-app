export type Impact = "critical" | "serious" | "moderate" | "minor"

export interface ViolationNode {
  html: string
  target: string[]
  failureSummary: string
}

export interface Violation {
  id: string
  impact: Impact
  description: string
  help: string
  helpUrl: string
  nodes: ViolationNode[]
}

export interface ScanSummary {
  score: number
  elementsAffected: number
  counts: Record<Impact, number>
}

/**
 * Only rules mapped to a WCAG 2.x A/AA success criterion are reported, because
 * ADA and Section 508 claims are argued against those criteria. axe-core's
 * `best-practice` rules are intentionally excluded.
 */
export const WCAG_TAGS = [
  "wcag2a",
  "wcag2aa",
  "wcag21a",
  "wcag21aa",
  "wcag22a",
  "wcag22aa",
]

export const IMPACT_ORDER: Impact[] = ["critical", "serious", "moderate", "minor"]

const IMPACT_WEIGHTS: Record<Impact, number> = {
  critical: 10,
  serious: 5,
  moderate: 2,
  minor: 1,
}

// A single rule failing on 50 elements is not 50x worse than failing on one, so
// each rule's contribution to the penalty is capped.
const MAX_NODES_PER_RULE = 5

export function normalizeImpact(impact: string | null | undefined): Impact {
  return IMPACT_ORDER.includes(impact as Impact) ? (impact as Impact) : "minor"
}

/**
 * Score is `100 / (1 + penalty / 50)`: 100 when nothing fails, ~50 at a penalty
 * of 50 (for example ten serious rules), and asymptotic towards 0 so that a
 * badly failing page still gets a comparable number.
 */
export function summarizeViolations(violations: Violation[]): ScanSummary {
  const counts: Record<Impact, number> = {
    critical: 0,
    serious: 0,
    moderate: 0,
    minor: 0,
  }

  let penalty = 0
  let elementsAffected = 0

  for (const violation of violations) {
    const nodeCount = violation.nodes.length
    counts[violation.impact] += nodeCount
    elementsAffected += nodeCount
    penalty +=
      IMPACT_WEIGHTS[violation.impact] * Math.min(nodeCount, MAX_NODES_PER_RULE)
  }

  return {
    score: Math.round(100 / (1 + penalty / 50)),
    elementsAffected,
    counts,
  }
}

export function sortViolations(violations: Violation[]): Violation[] {
  return [...violations].sort(
    (a, b) => IMPACT_ORDER.indexOf(a.impact) - IMPACT_ORDER.indexOf(b.impact)
  )
}

export function scoreColor(score: number): string {
  if (score >= 90) return "#16a34a"
  if (score >= 70) return "#ca8a04"
  if (score >= 50) return "#ea580c"
  return "#dc2626"
}
