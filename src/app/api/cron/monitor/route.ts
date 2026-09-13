import { NextRequest, NextResponse } from "next/server"

import { postSlackWebhook, sendScoreDropAlert } from "@/lib/alerts"
import { assertCronAuth } from "@/lib/cron-auth"
import { analyzeUrlWithBrowser, persistPageScan } from "@/lib/run-page-scan"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

export const maxDuration = 60

const MAX_MONITORS_PER_RUN = 5

function isDue(
  cadence: string,
  lastRunAt: string | null,
  now: Date
): boolean {
  if (!lastRunAt) return true
  const last = new Date(lastRunAt).getTime()
  const ms =
    cadence === "monthly"
      ? 28 * 24 * 60 * 60 * 1000
      : 7 * 24 * 60 * 60 * 1000
  return now.getTime() - last >= ms
}

/**
 * Weekly monitor pass: re-scan seed URLs, alert on score drops.
 * Schedule: once per day; due-check enforces weekly/monthly cadence.
 */
export async function GET(req: NextRequest) {
  const denied = assertCronAuth(req)
  if (denied) return denied

  const admin = createSupabaseAdminClient()
  const now = new Date()
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "https://www.geta11yfix.com"

  const { data: monitors, error } = await admin
    .from("site_monitors")
    .select(
      "id, user_id, seed_url, host, cadence, alert_email, slack_webhook_url, last_score, last_run_at, enabled"
    )
    .eq("enabled", true)
    .limit(40)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const due = (monitors ?? [])
    .filter((m) => isDue(m.cadence, m.last_run_at, now))
    .slice(0, MAX_MONITORS_PER_RUN)

  const outcomes: {
    id: string
    host: string
    previous: number | null
    current?: number
    alerted?: boolean
    error?: string
  }[] = []

  for (const monitor of due) {
    try {
      const payload = await analyzeUrlWithBrowser(monitor.seed_url)
      await persistPageScan(admin, monitor.user_id, payload, null)

      const previous = monitor.last_score as number | null
      const current = payload.score
      const dropped = previous != null && current < previous

      let alerted = false
      if (dropped || previous == null) {
        const mail = await sendScoreDropAlert({
          to: monitor.alert_email,
          host: monitor.host,
          seedUrl: monitor.seed_url,
          previousScore: previous,
          currentScore: current,
          appUrl,
        })
        alerted = mail.sent
        if (monitor.slack_webhook_url && dropped) {
          await postSlackWebhook(
            monitor.slack_webhook_url,
            `A11yFix: ${monitor.host} score dropped ${previous} → ${current}. ${appUrl}/history`
          )
        }
      }

      await admin
        .from("site_monitors")
        .update({
          last_score: current,
          last_run_at: now.toISOString(),
        })
        .eq("id", monitor.id)

      outcomes.push({
        id: monitor.id,
        host: monitor.host,
        previous,
        current,
        alerted,
      })
    } catch (err) {
      outcomes.push({
        id: monitor.id,
        host: monitor.host,
        previous: monitor.last_score,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return NextResponse.json({
    checked: due.length,
    outcomes,
  })
}
