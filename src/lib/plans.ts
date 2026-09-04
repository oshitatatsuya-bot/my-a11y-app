export type Plan = "free" | "pro" | "agency"

export interface PlanLimits {
  label: string
  scansPerMonth: number
  sites: number
}

/**
 * Mirrors the limits enforced in `public.record_scan()`. The database is the
 * source of truth; these values only drive what the UI displays, so both must
 * be changed together.
 */
export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free: { label: "Free", scansPerMonth: 5, sites: 1 },
  pro: { label: "Pro", scansPerMonth: 1000, sites: 3 },
  agency: { label: "Agency", scansPerMonth: 5000, sites: 1000 },
}

export function planLimits(plan: string | null | undefined): PlanLimits {
  return PLAN_LIMITS[(plan ?? "free") as Plan] ?? PLAN_LIMITS.free
}
