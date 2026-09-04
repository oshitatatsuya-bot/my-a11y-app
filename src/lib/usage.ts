import type { SupabaseClient } from "@supabase/supabase-js"

import { planLimits, type PlanLimits } from "./plans"

export interface Usage {
  plan: string
  limits: PlanLimits
  scansUsed: number
  periodStart: string
}

/** Start of the current month in UTC, matching `date_trunc('month', now())`. */
export function currentPeriodStart() {
  const now = new Date()
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
  ).toISOString()
}

/**
 * Reads the caller's plan and how much of it they have used. Row level
 * security already scopes both queries to the signed-in user; the explicit
 * filters keep the result correct even if a policy is later widened.
 */
export async function loadUsage(
  supabase: SupabaseClient,
  userId: string
): Promise<Usage> {
  const periodStart = currentPeriodStart()

  const [{ data: profile }, { count }] = await Promise.all([
    supabase.from("profiles").select("plan").eq("id", userId).maybeSingle(),
    supabase
      .from("scans")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", periodStart),
  ])

  const plan = profile?.plan ?? "free"

  return {
    plan,
    limits: planLimits(plan),
    scansUsed: count ?? 0,
    periodStart,
  }
}
