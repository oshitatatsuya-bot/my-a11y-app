/**
 * Same-host page discovery for site scans: sitemap.xml → robots.txt Sitemap →
 * same-origin links on the seed page. Caps keep serverless time budgets honest.
 */

const SITEMAP_FETCH_MS = 8_000
const MAX_SITEMAP_BYTES = 2_000_000

function sameHost(a: URL, b: URL) {
  return a.hostname === b.hostname && a.protocol === b.protocol
}

function normalizePageUrl(href: string, base: URL): string | null {
  try {
    const u = new URL(href, base)
    if (u.protocol !== "http:" && u.protocol !== "https:") return null
    if (!sameHost(u, base)) return null
    u.hash = ""
    // Drop common non-HTML assets from sitemaps/crawls.
    if (/\.(pdf|png|jpe?g|gif|webp|svg|css|js|xml|json|zip|mp4|webm)(\?|$)/i.test(u.pathname)) {
      return null
    }
    return u.href
  } catch {
    return null
  }
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(SITEMAP_FETCH_MS),
      headers: {
        Accept: "text/xml,application/xml,text/plain,*/*",
        "User-Agent":
          "Mozilla/5.0 (compatible; A11yFixBot/1.0; +https://www.geta11yfix.com)",
      },
      redirect: "follow",
    })
    if (!res.ok) return null
    const buf = await res.arrayBuffer()
    if (buf.byteLength > MAX_SITEMAP_BYTES) return null
    return new TextDecoder("utf-8").decode(buf)
  } catch {
    return null
  }
}

function urlsFromSitemapXml(xml: string, seed: URL): string[] {
  const locs = [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)].map((m) =>
    m[1].trim()
  )
  const out: string[] = []
  for (const loc of locs) {
    // Nested sitemap index: recurse one level via caller; skip .xml leaves here
    // only when collecting page URLs — sitemap indexes are handled separately.
    const normalized = normalizePageUrl(loc, seed)
    if (normalized) out.push(normalized)
  }
  return out
}

function sitemapLocs(xml: string): string[] {
  return [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)].map((m) =>
    m[1].trim()
  )
}

async function collectFromSitemap(
  sitemapUrl: string,
  seed: URL,
  limit: number,
  depth = 0
): Promise<string[]> {
  if (depth > 1) return []
  const xml = await fetchText(sitemapUrl)
  if (!xml) return []

  const isIndex =
    /<sitemapindex[\s>]/i.test(xml) ||
    (/<sitemap[\s>]/i.test(xml) && !/<urlset[\s>]/i.test(xml))

  if (isIndex) {
    const childMaps = sitemapLocs(xml).slice(0, 5)
    const pages: string[] = []
    for (const child of childMaps) {
      if (pages.length >= limit) break
      try {
        const childUrl = new URL(child)
        if (childUrl.hostname !== seed.hostname) continue
      } catch {
        continue
      }
      const found = await collectFromSitemap(child, seed, limit - pages.length, depth + 1)
      pages.push(...found)
    }
    return pages
  }

  return urlsFromSitemapXml(xml, seed).slice(0, limit)
}

async function sitemapsFromRobots(seed: URL): Promise<string[]> {
  const robots = await fetchText(new URL("/robots.txt", seed).href)
  if (!robots) return []
  return [...robots.matchAll(/^\s*Sitemap:\s*(\S+)/gim)].map((m) => m[1].trim())
}

/**
 * Discover up to `limit` same-host pages starting from `seed`.
 * Always includes the seed URL first.
 */
export async function discoverSitePages(
  seedHref: string,
  limit: number
): Promise<{ pages: string[]; source: "sitemap" | "robots" | "seed-only" }> {
  const seed = new URL(seedHref)
  const ordered: string[] = []
  const seen = new Set<string>()

  const push = (href: string) => {
    const n = normalizePageUrl(href, seed)
    if (!n || seen.has(n)) return
    seen.add(n)
    ordered.push(n)
  }

  push(seed.href)

  const candidates = [
    new URL("/sitemap.xml", seed).href,
    new URL("/sitemap_index.xml", seed).href,
    ...(await sitemapsFromRobots(seed)),
  ]

  let source: "sitemap" | "robots" | "seed-only" = "seed-only"

  for (const mapUrl of candidates) {
    if (ordered.length >= limit) break
    try {
      const u = new URL(mapUrl)
      if (u.hostname !== seed.hostname) continue
    } catch {
      continue
    }
    const found = await collectFromSitemap(mapUrl, seed, limit)
    if (found.length > 0) {
      source = mapUrl.includes("robots") ? "robots" : "sitemap"
      for (const p of found) {
        if (ordered.length >= limit) break
        push(p)
      }
    }
  }

  return { pages: ordered.slice(0, limit), source }
}
