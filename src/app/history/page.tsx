import Link from "next/link"
import { redirect } from "next/navigation"

import { AppNav } from "@/components/app-nav"
import { ScoreTrend } from "@/components/score-trend"
import { scoreColor } from "@/lib/a11y"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { loadUsage } from "@/lib/usage"

export const metadata = {
  title: "Scan history — A11yFix",
}

interface ScanRow {
  id: string
  url: string
  host: string
  score: number
  violations_count: number
  elements_affected: number
  created_at: string
}

export default async function HistoryPage() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login?next=/history")
  }

  const [usage, { data, error }] = await Promise.all([
    loadUsage(supabase, user.id),
    supabase
      .from("scans")
      .select("id, url, host, score, violations_count, elements_affected, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100),
  ])

  const scans = (data ?? []) as ScanRow[]

  // Oldest first per host, so the trend line reads left to right in time.
  const byHost = new Map<string, ScanRow[]>()
  for (const scan of [...scans].reverse()) {
    byHost.set(scan.host, [...(byHost.get(scan.host) ?? []), scan])
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
          <h1 className="text-3xl font-bold tracking-tight">Scan history</h1>
          <p className="mt-2 text-slate-400">
            Your last {scans.length} scans. Use this to show reviewers that
            accessibility defects are trending down over time.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-lg border border-red-800 bg-red-950/50 p-4 text-sm text-red-300"
          >
            History could not be loaded: {error.message}
          </div>
        )}

        {!error && scans.length === 0 && (
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
            <p className="font-medium">No scans yet.</p>
            <p className="mt-2 text-sm text-slate-400">
              Run your first scan to start building a record of progress.
            </p>
            <Link
              href="/scan"
              className="mt-4 inline-block rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-sky-400"
            >
              Open the scanner
            </Link>
          </div>
        )}

        {byHost.size > 0 && (
          <section aria-labelledby="trend-heading" className="space-y-4">
            <h2 id="trend-heading" className="text-xl font-semibold">
              Score by site
            </h2>
            <ul className="grid gap-4 sm:grid-cols-2">
              {[...byHost.entries()].map(([host, hostScans]) => {
                const latest = hostScans[hostScans.length - 1]
                const previous = hostScans[hostScans.length - 2]
                const delta = previous ? latest.score - previous.score : null

                return (
                  <li
                    key={host}
                    className="rounded-xl border border-slate-800 bg-slate-900 p-4"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <h3 className="truncate font-medium">{host}</h3>
                      <span className="text-xs text-slate-500">
                        {hostScans.length} scan{hostScans.length === 1 ? "" : "s"}
                      </span>
                    </div>
                    <div className="mt-2 flex items-end gap-3">
                      <span
                        className="text-3xl font-semibold"
                        style={{ color: scoreColor(latest.score) }}
                      >
                        {latest.score}
                      </span>
                      {delta !== null && (
                        <span
                          className={
                            delta > 0
                              ? "text-sm text-emerald-400"
                              : delta < 0
                                ? "text-sm text-red-400"
                                : "text-sm text-slate-500"
                          }
                        >
                          {delta > 0 ? `+${delta}` : delta} vs previous
                        </span>
                      )}
                    </div>
                    <ScoreTrend
                      scores={hostScans.map((scan) => scan.score)}
                      label={`Score trend for ${host}`}
                    />
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        {scans.length > 0 && (
          <section aria-labelledby="log-heading" className="space-y-4">
            <h2 id="log-heading" className="text-xl font-semibold">
              All scans
            </h2>
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">
                  Every recorded scan, most recent first
                </caption>
                <thead className="bg-slate-900 text-xs uppercase tracking-wider text-slate-400">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Scanned at (UTC)
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      URL
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Score
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Rules
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Elements
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {scans.map((scan) => (
                    <tr key={scan.id}>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-400">
                        {formatter.format(new Date(scan.created_at))}
                      </td>
                      <td className="max-w-xs truncate px-4 py-3">{scan.url}</td>
                      <td
                        className="px-4 py-3 font-semibold"
                        style={{ color: scoreColor(scan.score) }}
                      >
                        {scan.score}
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {scan.violations_count}
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {scan.elements_affected}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
