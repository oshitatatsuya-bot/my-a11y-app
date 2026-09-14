export type Plan = "free" | "pro" | "agency"

export interface PlanLimits {
  label: string
  scansPerMonth: number
  sites: number
  fixesPerMonth: number
  /** Max pages pulled from sitemap / same-host discovery per site scan. */
  pagesPerSiteScan: number
}

/**
 * Mirrors the limits enforced in `public.record_scan()` (and the app-side
 * AI fix quota). The database is the source of truth for scans; these values
 * drive the UI and the `/api/fix` monthly cap, so both must stay aligned.
 * Each page in a site scan consumes one monthly scan credit.
 */
export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free: {
    label: "Free",
    // Enough to taste a small site scan + AI fixes before upgrading.
    scansPerMonth: 15,
    sites: 3,
    fixesPerMonth: 15,
    pagesPerSiteScan: 5,
  },
  pro: {
    label: "Pro",
    scansPerMonth: 1000,
    sites: 3,
    fixesPerMonth: 1000,
    pagesPerSiteScan: 25,
  },
  agency: {
    label: "Agency",
    scansPerMonth: 5000,
    sites: 1000,
    fixesPerMonth: 5000,
    pagesPerSiteScan: 100,
  },
}

export function planLimits(plan: string | null | undefined): PlanLimits {
  return PLAN_LIMITS[(plan ?? "free") as Plan] ?? PLAN_LIMITS.free
}
