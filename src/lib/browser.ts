import { existsSync } from "node:fs"
import chromium from "@sparticuz/chromium"
import puppeteer, { type Browser } from "puppeteer-core"

const LOCAL_CHROME_PATHS = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  process.env.LOCAL_CHROME_PATH,
].filter(Boolean) as string[]

const isVercel = Boolean(process.env.VERCEL)

// @sparticuz/chromium dropped its own `defaultViewport` export, so keep the
// viewport it used to ship for the serverless build.
const SERVERLESS_VIEWPORT = { width: 1920, height: 1080, deviceScaleFactor: 1 }
const LOCAL_VIEWPORT = { width: 1280, height: 800 }

// One Chrome instance needs roughly 500MB, so cap how many a single server
// instance will run at once instead of letting it exhaust memory. Scanning and
// fix verification share the budget because they share the machine.
const MAX_CONCURRENT_BROWSERS = 2
let active = 0

export class BrowserBusyError extends Error {}

async function executablePath() {
  if (isVercel) {
    return await chromium.executablePath()
  }

  for (const path of LOCAL_CHROME_PATHS) {
    if (existsSync(path)) {
      return path
    }
  }

  throw new Error("Local Chrome browser not found. Please install Google Chrome.")
}

/**
 * Runs `task` against headless Chrome configured for whichever environment is
 * hosting it, and closes the browser however `task` ends. Throws
 * `BrowserBusyError` rather than starting a browser the machine cannot afford.
 */
export async function withBrowser<T>(
  task: (browser: Browser) => Promise<T>
): Promise<T> {
  if (active >= MAX_CONCURRENT_BROWSERS) {
    throw new BrowserBusyError("The scanner is busy. Please retry in a moment.")
  }

  active += 1
  let browser: Browser | undefined

  try {
    browser = await puppeteer.launch({
      args: isVercel ? chromium.args : [],
      defaultViewport: isVercel ? SERVERLESS_VIEWPORT : LOCAL_VIEWPORT,
      executablePath: await executablePath(),
      headless: true,
    })

    return await task(browser)
  } finally {
    await browser?.close()
    active -= 1
  }
}
