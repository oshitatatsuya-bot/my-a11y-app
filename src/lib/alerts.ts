import { Resend } from "resend"

const FROM =
  process.env.RESEND_FROM_EMAIL?.trim() || "A11yFix Alerts <onboarding@resend.dev>"

export async function sendScoreDropAlert(args: {
  to: string
  host: string
  seedUrl: string
  previousScore: number | null
  currentScore: number
  appUrl: string
}) {
  const key = process.env.RESEND_API_KEY
  if (!key) {
    console.warn("RESEND_API_KEY missing; skip email alert")
    return { sent: false as const, reason: "no_resend_key" }
  }

  const resend = new Resend(key)
  const drop =
    args.previousScore == null
      ? "a new baseline"
      : `${args.previousScore} → ${args.currentScore}`

  const subject =
    args.previousScore != null && args.currentScore < args.previousScore
      ? `A11yFix alert: score dropped on ${args.host}`
      : `A11yFix monitor: new scan on ${args.host}`

  const html = `
    <p>Your monitored site <strong>${args.host}</strong> was re-scanned.</p>
    <p>Score change: <strong>${drop}</strong> (out of 100).</p>
    <p>Seed URL: <a href="${args.seedUrl}">${args.seedUrl}</a></p>
    <p><a href="${args.appUrl}/history">Open scan history</a> to review new WCAG findings.</p>
    <p style="color:#64748b;font-size:12px">You receive this because weekly monitoring is enabled on A11yFix. Reply to support@geta11yfix.com to turn it off.</p>
  `

  const { error } = await resend.emails.send({
    from: FROM,
    to: args.to,
    subject,
    html,
  })

  if (error) {
    console.error("Resend alert failed:", error)
    return { sent: false as const, reason: error.message }
  }

  return { sent: true as const }
}

export async function postSlackWebhook(
  webhookUrl: string,
  text: string
): Promise<boolean> {
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    })
    return res.ok
  } catch (error) {
    console.error("Slack webhook failed:", error)
    return false
  }
}
