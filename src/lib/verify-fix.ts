/**
 * Enhanced fix verification: re-run axe on a harnessed snippet and return
 * whether the target rule still fails, plus failure detail for self-correction.
 */

import { AxePuppeteer } from "@axe-core/puppeteer"
import type { Page } from "puppeteer-core"

import { withBrowser } from "./browser"

export type Verification = "verified" | "unverified" | "not-verifiable"

export type VerifyDetail = {
  verification: Verification
  /** axe failure summaries when the fixed snippet still trips the rule */
  remainingFailures: string[]
}

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

async function analyzeRule(page: Page, ruleId: string, snippet: string) {
  await page.setContent(harness(snippet), { waitUntil: "domcontentloaded" })
  const results = await new AxePuppeteer(page).withRules([ruleId]).analyze()
  const hit = results.violations.filter((v) => v.id === ruleId)
  const remainingFailures = hit.flatMap((v) =>
    v.nodes.map((n) => n.failureSummary || v.help).filter(Boolean)
  )
  return { stillFails: hit.length > 0, remainingFailures }
}

/**
 * Re-runs the failing rule against the generated snippet instead of taking the
 * model's word that it fixed anything.
 */
export async function verifyFixDetailed({
  ruleId,
  originalHtml,
  fixedHtml,
}: {
  ruleId: string
  originalHtml: string
  fixedHtml: string
}): Promise<VerifyDetail> {
  return withBrowser(async (browser) => {
    const page = await browser.newPage()

    const original = await analyzeRule(page, ruleId, originalHtml)
    if (!original.stillFails) {
      return { verification: "not-verifiable", remainingFailures: [] }
    }

    const fixed = await analyzeRule(page, ruleId, fixedHtml)
    if (fixed.stillFails) {
      return {
        verification: "unverified",
        remainingFailures: fixed.remainingFailures.slice(0, 5),
      }
    }

    return { verification: "verified", remainingFailures: [] }
  })
}

export async function verifyFix(args: {
  ruleId: string
  originalHtml: string
  fixedHtml: string
}): Promise<Verification> {
  const detail = await verifyFixDetailed(args)
  return detail.verification
}
