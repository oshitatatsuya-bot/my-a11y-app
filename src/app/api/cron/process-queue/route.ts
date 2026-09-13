import { NextRequest, NextResponse } from "next/server"

import { assertCronAuth } from "@/lib/cron-auth"
import { analyzeUrl, persistPageScan } from "@/lib/run-page-scan"
import { withBrowser } from "@/lib/browser"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

export const maxDuration = 60

const BATCH = 3

/**
 * Processes up to 3 pending scan_queue rows per invocation (Vercel Cron every minute).
 */
export async function GET(req: NextRequest) {
  const denied = assertCronAuth(req)
  if (denied) return denied

  const admin = createSupabaseAdminClient()
  const { data: jobs, error } = await admin
    .from("scan_queue")
    .select("id, user_id, url, host, run_id, attempts")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(BATCH)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!jobs?.length) {
    return NextResponse.json({ processed: 0 })
  }

  const results: { id: string; ok: boolean; error?: string }[] = []

  await withBrowser(async (browser) => {
    for (const job of jobs) {
      await admin
        .from("scan_queue")
        .update({
          status: "processing",
          attempts: (job.attempts ?? 0) + 1,
        })
        .eq("id", job.id)

      try {
        const payload = await analyzeUrl(browser, job.url)
        await persistPageScan(
          admin,
          job.user_id,
          payload,
          job.run_id ?? null
        )
        await admin
          .from("scan_queue")
          .update({
            status: "done",
            processed_at: new Date().toISOString(),
            last_error: null,
          })
          .eq("id", job.id)
        results.push({ id: job.id, ok: true })
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        await admin
          .from("scan_queue")
          .update({
            status: "failed",
            processed_at: new Date().toISOString(),
            last_error: message.slice(0, 500),
          })
          .eq("id", job.id)
        results.push({ id: job.id, ok: false, error: message })
      }
    }
  })

  return NextResponse.json({ processed: results.length, results })
}
