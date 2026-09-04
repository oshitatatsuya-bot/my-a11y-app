import { headers } from "next/headers"

/**
 * Absolute origin of the current request, used for links that leave the app
 * and come back (magic links, embedded badge images).
 */
export async function siteOrigin() {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")
  }

  const headerList = await headers()
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host")
  const protocol =
    headerList.get("x-forwarded-proto") ??
    (host?.startsWith("localhost") ? "http" : "https")

  return `${protocol}://${host}`
}

/** Prevents an attacker-supplied `next` parameter from redirecting off-site. */
export function safeRedirectPath(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/scan"
  }

  return value
}
