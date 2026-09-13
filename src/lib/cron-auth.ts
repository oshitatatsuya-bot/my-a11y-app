import { NextRequest, NextResponse } from "next/server"

/**
 * Vercel Cron and manual ops calls must present the shared secret.
 * Configure CRON_SECRET in Vercel and Authorization: Bearer <secret>.
 */
export function assertCronAuth(req: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured" },
      { status: 503 }
    )
  }

  const header = req.headers.get("authorization") || ""
  const token = header.startsWith("Bearer ") ? header.slice(7) : ""
  // Vercel Cron also sends `x-vercel-cron: 1` — still require the secret.
  if (token !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  return null
}
