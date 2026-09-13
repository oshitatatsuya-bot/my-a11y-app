import { AxePuppeteer } from "@axe-core/puppeteer"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Browser } from "puppeteer-core"

import {
  WCAG_TAGS,
  normalizeImpact,
  sortViolations,
  summarizeViolations,
  type Violation,
} from "@/lib/a11y"
import { withBrowser } from "@/lib/browser"
import { openScanTarget } from "@/lib/scan-target"

export type PageScanPayload = {
  url: string
  host: string
  score: number
  violationsCount: number
  elementsAffected: number
  critical: number
  serious: number
  moderate: number
  minor: number
  violations: Violation[]
  rulesPassed: number
}

export async function analyzeUrl(
  browser: Browser,
  href: string
): Promise<PageScanPayload> {
  const page = await browser.newPage()
  try {
    await openScanTarget(page, href)
    const axeResults = await new AxePuppeteer(page).withTags(WCAG_TAGS).analyze()
    const violations: Violation[] = sortViolations(
      axeResults.violations.map((v) => ({
        id: v.id,
        impact: normalizeImpact(v.impact),
        description: v.description,
        help: v.help,
        helpUrl: v.helpUrl,
        nodes: v.nodes.map((n) => ({
          html: n.html,
          target: n.target.map(String),
          failureSummary: n.failureSummary ?? "",
        })),
      }))
    )
    const summary = summarizeViolations(violations)
    const host = new URL(href).host
    return {
      url: href,
      host,
      score: summary.score,
      violationsCount: violations.length,
      elementsAffected: summary.elementsAffected,
      critical: summary.counts.critical,
      serious: summary.counts.serious,
      moderate: summary.counts.moderate,
      minor: summary.counts.minor,
      violations,
      rulesPassed: axeResults.passes.length,
    }
  } finally {
    await page.close().catch(() => {})
  }
}

export async function analyzeUrlWithBrowser(href: string) {
  return withBrowser((browser) => analyzeUrl(browser, href))
}

/**
 * Privileged insert used by cron / queue workers (service role).
 * Calls `record_scan_for_user` when available; otherwise inserts directly.
 */
export async function persistPageScan(
  admin: SupabaseClient,
  userId: string,
  payload: PageScanPayload,
  runId: string | null
) {
  const rpc = await admin
    .rpc("record_scan_for_user", {
      p_user_id: userId,
      p_url: payload.url,
      p_host: payload.host,
      p_score: payload.score,
      p_violations_count: payload.violationsCount,
      p_elements_affected: payload.elementsAffected,
      p_critical: payload.critical,
      p_serious: payload.serious,
      p_moderate: payload.moderate,
      p_minor: payload.minor,
      p_violations: payload.violations,
      p_run_id: runId,
    })
    .single<{
      scan_id: string
      badge_token: string
      scans_used: number
      scans_limit: number
    }>()

  if (!rpc.error && rpc.data) {
    return rpc.data
  }

  // Fallback if migration not applied: direct insert (service role bypasses RLS).
  const { data: scan, error: insertError } = await admin
    .from("scans")
    .insert({
      user_id: userId,
      url: payload.url,
      host: payload.host,
      score: payload.score,
      violations_count: payload.violationsCount,
      elements_affected: payload.elementsAffected,
      critical_count: payload.critical,
      serious_count: payload.serious,
      moderate_count: payload.moderate,
      minor_count: payload.minor,
      violations: payload.violations,
      ...(runId ? { run_id: runId } : {}),
    })
    .select("id")
    .single()

  if (insertError || !scan) {
    throw new Error(rpc.error?.message || insertError?.message || "persist failed")
  }

  const { data: badge } = await admin
    .from("badges")
    .upsert(
      {
        user_id: userId,
        host: payload.host,
        score: payload.score,
        scanned_at: new Date().toISOString(),
      },
      { onConflict: "user_id,host" }
    )
    .select("token")
    .single()

  return {
    scan_id: scan.id as string,
    badge_token: (badge?.token as string) || "",
    scans_used: 0,
    scans_limit: 0,
  }
}
