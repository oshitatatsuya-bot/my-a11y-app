import type { Page } from "puppeteer-core"

import { applyStealth } from "@/lib/stealth"

export class ScanTimeoutError extends Error {}
export class ScanBlockedError extends Error {}

function isTimeoutError(error: unknown) {
  return (
    error instanceof Error &&
    (error.name === "TimeoutError" || /timed? ?out/i.test(error.message))
  )
}

/**
 * Cloudflare (and similar) bot-management pages. Matching here matters more
 * than a navigation timeout: a "successful" axe run against the interstitial
 * is reported as the target site's accessibility score.
 */
export async function pageLooksLikeBotCheck(page: Page): Promise<boolean> {
  const title = await page.title()
  if (isBotCheckText(title)) return true

  return page.evaluate(() => {
    const html = document.documentElement?.outerHTML?.slice(0, 4000) ?? ""
    const titleText = document.title || ""
    const probe =
      `${titleText}\n${html}\n${location.pathname}\n${location.search}`
    return (
      /just a moment|attention required|checking your browser|しばらくお待ちください|please wait|enable javascript and cookies to continue|cdn-cgi\/challenge-platform|cf-browser-verification|challenges\.cloudflare\.com/i.test(
        probe
      ) || Boolean(document.getElementById("challenge-error-text"))
    )
  })
}

function isBotCheckText(value: string) {
  return /just a moment|attention required|checking your browser|しばらくお待ちください|please wait/i.test(
    value
  )
}

/**
 * `networkidle0` waits until every request has finished. Bot-check scripts
 * keep connections open, so Puppeteer's 30s budget expires on serverless
 * even though a document is already in the DOM. Axe only needs that document
 * — but it must be the *target* document, not an interstitial.
 */
export async function openScanTarget(page: Page, href: string) {
  await applyStealth(page)
  // axe-core injects a script; CSP on the target must not block it.
  await page.setBypassCSP(true)

  try {
    await page.goto(href, { waitUntil: "domcontentloaded", timeout: 25_000 })
  } catch (error) {
    if (isTimeoutError(error)) {
      throw new ScanTimeoutError(
        "This page took longer than we could wait. Open the URL in your own browser to confirm it loads, then try again—or scan a lighter page such as a static landing page first."
      )
    }
    throw error
  }

  // Give JS challenges a longer window when stealth + proxy may clear them.
  const challengeBudgetMs = process.env.SCAN_PROXY_URL ? 20_000 : 15_000

  if (await pageLooksLikeBotCheck(page)) {
    await page
      .waitForFunction(
        () => {
          const title = document.title || ""
          return !/just a moment|attention required|checking your browser|しばらくお待ちください|please wait/i.test(
            title
          )
        },
        { timeout: challengeBudgetMs }
      )
      .catch(() => {})

    // Soft reload once — some managed bots pass on the second document load.
    if (await pageLooksLikeBotCheck(page)) {
      await page.reload({ waitUntil: "domcontentloaded", timeout: 15_000 }).catch(() => {})
      await page
        .waitForFunction(
          () => {
            const title = document.title || ""
            return !/just a moment|attention required|checking your browser|しばらくお待ちください|please wait/i.test(
              title
            )
          },
          { timeout: 8_000 }
        )
        .catch(() => {})
    }
  }

  if (await pageLooksLikeBotCheck(page)) {
    throw new ScanBlockedError(
      "The site still showed a bot-check page after stealth retries, so we stopped rather than score the wrong HTML. Prefer a staging URL, set SCAN_PROXY_URL (residential proxy) in production, or try example.com to confirm the scanner works."
    )
  }

  await page.waitForNetworkIdle({ idleTime: 500, timeout: 5_000 }).catch(() => {})
}
