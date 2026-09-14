import { NextRequest, NextResponse } from "next/server"

import { createSupabaseServerClient } from "@/lib/supabase/server"

/**
 * Enable or update weekly/monthly monitoring for a host (email + optional Slack).
 */
export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: "Sign in to enable monitoring", code: "AUTH_REQUIRED" },
      { status: 401 }
    )
  }

  const body = await req.json()
  const seedUrl = String(body.seedUrl ?? "").trim()
  const alertEmail = String(body.alertEmail ?? user.email ?? "").trim()
  const slackWebhookUrl = String(body.slackWebhookUrl ?? "").trim() || null
  const cadence = body.cadence === "monthly" ? "monthly" : "weekly"
  const enabled = body.enabled !== false

  if (!seedUrl) {
    return NextResponse.json({ error: "seedUrl is required" }, { status: 400 })
  }

  if (
    slackWebhookUrl &&
    !/^https:\/\/hooks\.slack\.com\//i.test(slackWebhookUrl)
  ) {
    return NextResponse.json(
      {
        error:
          "Slack webhook must be an https://hooks.slack.com/… URL. Leave it blank if you only want email.",
      },
      { status: 400 }
    )
  }

  let host: string
  try {
    const u = new URL(seedUrl)
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      throw new Error("bad protocol")
    }
    host = u.host
  } catch {
    return NextResponse.json({ error: "seedUrl is not a valid URL" }, { status: 400 })
  }

  if (!alertEmail || !alertEmail.includes("@")) {
    return NextResponse.json(
      { error: "A valid alertEmail is required" },
      { status: 400 }
    )
  }

  const { data, error } = await supabase
    .from("site_monitors")
    .upsert(
      {
        user_id: user.id,
        seed_url: seedUrl,
        host,
        cadence,
        alert_email: alertEmail,
        slack_webhook_url: slackWebhookUrl,
        enabled,
      },
      { onConflict: "user_id,host" }
    )
    .select("id, host, cadence, enabled, alert_email")
    .single()

  if (error) {
    console.error("Monitor upsert failed:", error)
    return NextResponse.json(
      {
        error:
          "Could not save monitor. Apply the monitors migration in Supabase and retry.",
        details: error.message,
      },
      { status: 503 }
    )
  }

  return NextResponse.json({ monitor: data })
}

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: "Sign in", code: "AUTH_REQUIRED" },
      { status: 401 }
    )
  }

  const { data, error } = await supabase
    .from("site_monitors")
    .select(
      "id, host, seed_url, cadence, enabled, alert_email, last_score, last_run_at"
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 503 })
  }

  return NextResponse.json({ monitors: data ?? [] })
}
