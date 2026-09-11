import { existsSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"
import chromium from "@sparticuz/chromium"
import puppeteer, { type Browser } from "puppeteer-core"

const require = createRequire(import.meta.url)

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

function serverlessChromiumBin() {
  try {
    return join(dirname(require.resolve("@sparticuz/chromium/package.json")), "bin")
  } catch {
    return join(process.cwd(), "node_modules/@sparticuz/chromium/bin")
  }
}

async function executablePath() {
  if (isVercel) {
    const bin = serverlessChromiumBin()
    if (!existsSync(bin)) {
      throw new Error(
        `Chromium binaries were not packaged (${bin}). Deploy outputFileTracingIncludes for @sparticuz/chromium.`
      )
    }
    return await chromium.executablePath(bin)
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
    if (isVercel) {
      // WebGL is unused by axe; skipping it avoids extra work in /tmp.
      chromium.setGraphicsMode = false
    }

    browser = await puppeteer.launch({
      args: isVercel ? chromium.args : [],
      defaultViewport: isVercel ? SERVERLESS_VIEWPORT : LOCAL_VIEWPORT,
      executablePath: await executablePath(),
      // @sparticuz/chromium ships chrome-headless-shell, not full Chrome.
      headless: isVercel ? "shell" : true,
    })

    return await task(browser)
  } finally {
    await browser?.close()
    active -= 1
  }
}
