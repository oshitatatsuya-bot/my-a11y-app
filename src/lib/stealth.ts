import type { Page } from "puppeteer-core"

/**
 * Lightweight stealth hardening for headless Chrome on Vercel / local.
 * Does not claim to defeat every Cloudflare challenge; it removes the most
 * common automation fingerprints and uses a realistic desktop UA.
 */
export async function applyStealth(page: Page) {
  const ua =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"

  await page.setUserAgent(ua)
  await page.setExtraHTTPHeaders({
    "Accept-Language": "en-US,en;q=0.9",
    "Upgrade-Insecure-Requests": "1",
  })
  await page.setViewport({ width: 1365, height: 900, deviceScaleFactor: 1 })

  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, "webdriver", {
      get: () => undefined,
    })

    const w = window as Window & { chrome?: { runtime: object } }
    w.chrome = { runtime: {} }

    Object.defineProperty(navigator, "languages", {
      get: () => ["en-US", "en"],
    })
    Object.defineProperty(navigator, "plugins", {
      get: () => [1, 2, 3, 4, 5],
    })

    const originalQuery = window.navigator.permissions.query.bind(
      window.navigator.permissions
    )
    window.navigator.permissions.query = ((parameters: PermissionDescriptor) =>
      parameters.name === "notifications"
        ? Promise.resolve({
            state: Notification.permission,
            name: "notifications",
            onchange: null,
          } as PermissionStatus)
        : originalQuery(parameters)) as typeof window.navigator.permissions.query
  })
}

export function stealthLaunchArgs(extra: string[] = []): string[] {
  return [
    ...extra,
    "--disable-blink-features=AutomationControlled",
    "--disable-features=IsolateOrigins,site-per-process",
    "--lang=en-US,en",
  ]
}

/** Optional HTTP(S) proxy for scanning (e.g. residential). Set SCAN_PROXY_URL. */
export function scanProxyServer(): string | undefined {
  const raw = process.env.SCAN_PROXY_URL?.trim()
  return raw || undefined
}
