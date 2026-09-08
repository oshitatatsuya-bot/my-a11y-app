import { AxePuppeteer } from "@axe-core/puppeteer"
import type { Page } from "puppeteer-core"

import { withBrowser } from "./browser"

export type Verification = "verified" | "unverified" | "not-verifiable"

// Elements that only carry meaning inside <head>. Everything else goes in the
// body so that it renders and can be measured.
const HEAD_ONLY = /^\s*<\s*(?:meta|title|link|base|style)\b/i

function harness(snippet: string) {
  const inHead = HEAD_ONLY.test(snippet)

  return [
    "<!doctype html>",
    '<html lang="en">',
    '<head><meta charset="utf-8"><title>Fix verification</title>',
    inHead ? snippet : "",
    "</head><body>",
    inHead ? "" : snippet,
    "</body></html>",
  ].join("")
}

async function stillViolates(page: Page, ruleId: string, snippet: string) {
  await page.setContent(harness(snippet), { waitUntil: "domcontentloaded" })

  const results = await new AxePuppeteer(page).withRules([ruleId]).analyze()

  return results.violations.some((violation) => violation.id === ruleId)
}

/**
 * Re-runs the failing rule against the generated snippet instead of taking the
 * model's word that it fixed anything.
 *
 * The original snippet is measured first. When the rule does not reproduce in
 * this minimal document it needs page context the harness cannot supply — a
 * stylesheet for contrast rules, sibling landmarks for region rules — so a
 * pass on the fixed snippet would prove nothing. Those report
 * `not-verifiable`, because claiming a fix is confirmed when it is not is
 * worse than admitting the limit.
 */
export async function verifyFix({
  ruleId,
  originalHtml,
  fixedHtml,
}: {
  ruleId: string
  originalHtml: string
  fixedHtml: string
}): Promise<Verification> {
  return withBrowser(async (browser) => {
    const page = await browser.newPage()

    if (!(await stillViolates(page, ruleId, originalHtml))) {
      return "not-verifiable"
    }

    return (await stillViolates(page, ruleId, fixedHtml))
      ? "unverified"
      : "verified"
  })
}
