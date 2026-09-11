import type { Page } from "puppeteer-core"

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
  const ua = await page.browser().userAgent()
  await page.setUserAgent(ua.replace("HeadlessChrome", "Chrome"))
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

  if (await pageLooksLikeBotCheck(page)) {
    await page
      .waitForFunction(
        () => {
          const title = document.title || ""
          return !/just a moment|attention required|checking your browser|しばらくお待ちください|please wait/i.test(
            title
          )
        },
        { timeout: 12_000 }
      )
      .catch(() => {})
  }

  if (await pageLooksLikeBotCheck(page)) {
    throw new ScanBlockedError(
      "The site showed a bot-check or waiting page instead of its real content, so we stopped rather than score the wrong HTML. Try a staging URL, a page that loads without a human verification step, or example.com to confirm the scanner is working."
    )
  }

  await page.waitForNetworkIdle({ idleTime: 500, timeout: 5_000 }).catch(() => {})
}
