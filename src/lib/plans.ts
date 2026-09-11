export type Plan = "free" | "pro" | "agency"

export interface PlanLimits {
  label: string
  scansPerMonth: number
  sites: number
  fixesPerMonth: number
}

/**
 * Mirrors the limits enforced in `public.record_scan()` (and the app-side
 * AI fix quota). The database is the source of truth for scans; these values
 * drive the UI and the `/api/fix` monthly cap, so both must stay aligned.
 */
export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free: { label: "Free", scansPerMonth: 5, sites: 1, fixesPerMonth: 15 },
  pro: { label: "Pro", scansPerMonth: 1000, sites: 3, fixesPerMonth: 1000 },
  agency: {
    label: "Agency",
    scansPerMonth: 5000,
    sites: 1000,
    fixesPerMonth: 5000,
  },
}

export function planLimits(plan: string | null | undefined): PlanLimits {
  return PLAN_LIMITS[(plan ?? "free") as Plan] ?? PLAN_LIMITS.free
}
