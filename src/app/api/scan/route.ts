import { randomUUID } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { NextRequest, NextResponse } from 'next/server';
import { AxePuppeteer } from '@axe-core/puppeteer';
import type { Browser } from 'puppeteer-core';
import type { SupabaseClient } from '@supabase/supabase-js';

import {
  WCAG_TAGS,
  normalizeImpact,
  sortViolations,
  summarizeViolations,
  type Violation,
} from '@/lib/a11y';
import { BrowserBusyError, withBrowser } from '@/lib/browser';
import { countableHosts, isDemoHost } from '@/lib/demo-hosts';
import { discoverSitePages } from '@/lib/discover-pages';
import { planLimits } from '@/lib/plans';
import {
  ScanBlockedError,
  ScanTimeoutError,
  openScanTarget,
} from '@/lib/scan-target';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadScannedHosts, loadUsage } from '@/lib/usage';

// Headless Chrome startup plus multi-page site scans need the full budget.
export const maxDuration = 60;

const SITE_SCAN_DEADLINE_MS = 48_000;

function isBlockedAddress(address: string, family: number): boolean {
  if (family === 4) {
    const [a, b] = address.split('.').map(Number);
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    return false;
  }

  const ip = address.toLowerCase();
  if (ip === '::' || ip === '::1') return true;
  if (ip.startsWith('::ffff:')) return isBlockedAddress(ip.slice(7), 4);
  if (/^f[cd]/.test(ip)) return true;
  if (/^fe[89ab]/.test(ip)) return true;
  return false;
}

const allowPrivateTargets =
  !process.env.VERCEL && process.env.ALLOW_PRIVATE_SCAN_TARGETS === 'true';

async function assertPublicHost(hostname: string) {
  if (allowPrivateTargets) return;

  const addresses = await lookup(hostname, { all: true });

  if (addresses.some(({ address, family }) => isBlockedAddress(address, family))) {
    throw new BadRequestError('Only publicly reachable hosts can be scanned');
  }
}

class BadRequestError extends Error {}

type Recorded = {
  scan_id: string;
  badge_token: string;
  scans_used: number;
  scans_limit: number;
  sites_limit: number;
};

async function recordScan(
  supabase: SupabaseClient,
  args: {
    url: string;
    host: string;
    score: number;
    violationsCount: number;
    elementsAffected: number;
    critical: number;
    serious: number;
    moderate: number;
    minor: number;
    violations: Violation[];
    runId: string | null;
  }
): Promise<{ data: Recorded | null; error: { message: string } | null }> {
  const base = {
    p_url: args.url,
    p_host: args.host,
    p_score: args.score,
    p_violations_count: args.violationsCount,
    p_elements_affected: args.elementsAffected,
    p_critical: args.critical,
    p_serious: args.serious,
    p_moderate: args.moderate,
    p_minor: args.minor,
    p_violations: args.violations,
  };

  if (args.runId) {
    const withRun = await supabase
      .rpc('record_scan', { ...base, p_run_id: args.runId })
      .single<Recorded>();
    if (!withRun.error) return withRun;
    // Migration 20260912 not applied yet — fall back without run_id.
    if (!/p_run_id|function public\.record_scan|Could not find/i.test(withRun.error.message)) {
      return withRun;
    }
  }

  return supabase.rpc('record_scan', base).single<Recorded>();
}

async function axePage(browser: Browser, href: string) {
  const page = await browser.newPage();
  try {
    await openScanTarget(page, href);
    const axeResults = await new AxePuppeteer(page).withTags(WCAG_TAGS).analyze();
    const violations: Violation[] = sortViolations(
      axeResults.violations.map((v) => ({
        id: v.id,
        impact: normalizeImpact(v.impact),
        description: v.description,
        help: v.help,
        helpUrl: v.helpUrl,
        nodes: v.nodes.map((n) => ({
          html: n.html,
          target: n.target.map(String),
          failureSummary: n.failureSummary ?? '',
        })),
      }))
    );
    const summary = summarizeViolations(violations);
    return {
      violations,
      summary,
      rulesPassed: axeResults.passes.length,
    };
  } finally {
    await page.close().catch(() => {});
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: 'Sign in to run a scan', code: 'AUTH_REQUIRED' },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    const url = body.url as string | undefined;
    const mode = body.mode === 'site' ? 'site' : 'page';

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    let target: URL;
    try {
      target = new URL(url);
    } catch {
      return NextResponse.json({ error: 'URL is not valid' }, { status: 400 });
    }

    if (target.protocol !== 'http:' && target.protocol !== 'https:') {
      return NextResponse.json(
        { error: 'Only http and https URLs can be scanned' },
        { status: 400 }
      );
    }

    const usage = await loadUsage(supabase, user.id);
    const limits = planLimits(usage.plan);

    if (usage.scansUsed >= usage.limits.scansPerMonth) {
      return NextResponse.json(
        {
          error: `Your ${usage.limits.label} plan allows ${usage.limits.scansPerMonth} scans per month.`,
          code: 'QUOTA_EXCEEDED',
          usage: {
            plan: usage.plan,
            scansUsed: usage.scansUsed,
            scansLimit: usage.limits.scansPerMonth,
          },
        },
        { status: 429 }
      );
    }

    const hosts = await loadScannedHosts(supabase, user.id, usage.periodStart);
    const billedHosts = countableHosts(hosts);
    if (
      !isDemoHost(target.host) &&
      !hosts.includes(target.host) &&
      billedHosts.length >= usage.limits.sites
    ) {
      return NextResponse.json(
        {
          error: `Your ${usage.limits.label} plan covers ${usage.limits.sites} site${
            usage.limits.sites === 1 ? '' : 's'
          } per month (not counting example.com demos). You have already scanned ${billedHosts.join(
            ', '
          )} this month. Keep scanning those hosts, try https://example.com, or upgrade for more.`,
          code: 'SITE_LIMIT_EXCEEDED',
          usage: {
            plan: usage.plan,
            scansUsed: usage.scansUsed,
            scansLimit: usage.limits.scansPerMonth,
          },
        },
        { status: 403 }
      );
    }

    await assertPublicHost(target.hostname);

    if (mode === 'page') {
      const analyzed = await withBrowser((browser) => axePage(browser, target.href));
      const { data: recorded, error: recordError } = await recordScan(supabase, {
        url: target.href,
        host: target.host,
        score: analyzed.summary.score,
        violationsCount: analyzed.violations.length,
        elementsAffected: analyzed.summary.elementsAffected,
        critical: analyzed.summary.counts.critical,
        serious: analyzed.summary.counts.serious,
        moderate: analyzed.summary.counts.moderate,
        minor: analyzed.summary.counts.minor,
        violations: analyzed.violations,
        runId: null,
      });

      if (recordError || !recorded) {
        return quotaErrorResponse(recordError?.message ?? 'record failed');
      }

      return NextResponse.json({
        mode: 'page',
        scanId: recorded.scan_id,
        runId: null,
        url: target.href,
        host: target.host,
        timestamp: new Date().toISOString(),
        standards: WCAG_TAGS,
        rulesPassed: analyzed.rulesPassed,
        violationsCount: analyzed.violations.length,
        ...analyzed.summary,
        violations: analyzed.violations,
        pages: null,
        badgeUrl: `${req.nextUrl.origin}/api/badge?token=${recorded.badge_token}`,
        usage: {
          plan: usage.plan,
          scansUsed: recorded.scans_used,
          scansLimit: recorded.scans_limit,
        },
      });
    }

    // --- Site scan: sitemap discovery + sequential pages in one browser ---
    const remaining = Math.max(0, usage.limits.scansPerMonth - usage.scansUsed);
    const pageCap = Math.min(limits.pagesPerSiteScan, remaining);
    if (pageCap < 1) {
      return NextResponse.json(
        {
          error: `Your ${usage.limits.label} plan allows ${usage.limits.scansPerMonth} scans per month.`,
          code: 'QUOTA_EXCEEDED',
        },
        { status: 429 }
      );
    }

    const discovered = await discoverSitePages(target.href, pageCap);
    const runId = randomUUID();
    const started = Date.now();

    type PageResult = {
      scanId: string;
      url: string;
      score: number;
      violationsCount: number;
      elementsAffected: number;
      counts: ReturnType<typeof summarizeViolations>['counts'];
      rulesPassed: number;
      error?: string;
      code?: string;
    };

    const pageResults: PageResult[] = [];
    let badgeToken: string | null = null;
    let lastUsage = {
      plan: usage.plan,
      scansUsed: usage.scansUsed,
      scansLimit: usage.limits.scansPerMonth,
    };
    let aggregatedViolations: Violation[] = [];
    let worstPage: PageResult | null = null;

    await withBrowser(async (browser) => {
      for (const pageUrl of discovered.pages) {
        if (Date.now() - started > SITE_SCAN_DEADLINE_MS) break;
        if (pageResults.filter((p) => !p.error).length >= pageCap) break;

        try {
          const analyzed = await axePage(browser, pageUrl);
          const { data: recorded, error: recordError } = await recordScan(supabase, {
            url: pageUrl,
            host: target.host,
            score: analyzed.summary.score,
            violationsCount: analyzed.violations.length,
            elementsAffected: analyzed.summary.elementsAffected,
            critical: analyzed.summary.counts.critical,
            serious: analyzed.summary.counts.serious,
            moderate: analyzed.summary.counts.moderate,
            minor: analyzed.summary.counts.minor,
            violations: analyzed.violations,
            runId,
          });

          if (recordError || !recorded) {
            if (recordError?.message.includes('QUOTA_EXCEEDED')) break;
            pageResults.push({
              scanId: '',
              url: pageUrl,
              score: analyzed.summary.score,
              violationsCount: analyzed.violations.length,
              elementsAffected: analyzed.summary.elementsAffected,
              counts: analyzed.summary.counts,
              rulesPassed: analyzed.rulesPassed,
              error: 'Saved scan failed',
            });
            continue;
          }

          badgeToken = recorded.badge_token;
          lastUsage = {
            plan: usage.plan,
            scansUsed: recorded.scans_used,
            scansLimit: recorded.scans_limit,
          };

          const entry: PageResult = {
            scanId: recorded.scan_id,
            url: pageUrl,
            score: analyzed.summary.score,
            violationsCount: analyzed.violations.length,
            elementsAffected: analyzed.summary.elementsAffected,
            counts: analyzed.summary.counts,
            rulesPassed: analyzed.rulesPassed,
          };
          pageResults.push(entry);
          if (!worstPage || entry.score < worstPage.score) worstPage = entry;

          // Prefer showing the worst page's violations in the detail pane.
          if (worstPage.scanId === entry.scanId) {
            aggregatedViolations = analyzed.violations;
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          const code =
            err instanceof ScanBlockedError
              ? 'BOT_CHECK'
              : err instanceof ScanTimeoutError
                ? 'TIMEOUT'
                : 'SCAN_FAILED';
          pageResults.push({
            scanId: '',
            url: pageUrl,
            score: 0,
            violationsCount: 0,
            elementsAffected: 0,
            counts: { critical: 0, serious: 0, moderate: 0, minor: 0 },
            rulesPassed: 0,
            error: message,
            code,
          });
          // Seed page bot-blocked → fail the whole site scan loudly.
          if (pageUrl === discovered.pages[0] && err instanceof ScanBlockedError) {
            throw err;
          }
        }
      }
    });

    const okPages = pageResults.filter((p) => !p.error && p.scanId);
    if (okPages.length === 0) {
      const firstErr = pageResults.find((p) => p.error);
      return NextResponse.json(
        {
          error:
            firstErr?.error ??
            'No pages could be scanned. Check the URL or try a staging host.',
          code: firstErr?.code ?? 'SCAN_FAILED',
          pages: pageResults,
        },
        { status: firstErr?.code === 'BOT_CHECK' ? 422 : 500 }
      );
    }

    const failedPages = pageResults.filter((p) => p.error);
    // Headline score is the worst successful page—not an average that hides failures.
    const headlineScore = Math.min(...okPages.map((p) => p.score));
    const totalViolations = okPages.reduce((sum, p) => sum + p.violationsCount, 0);
    const totalElements = okPages.reduce((sum, p) => sum + p.elementsAffected, 0);
    const counts = okPages.reduce(
      (acc, p) => ({
        critical: acc.critical + p.counts.critical,
        serious: acc.serious + p.counts.serious,
        moderate: acc.moderate + p.counts.moderate,
        minor: acc.minor + p.counts.minor,
      }),
      { critical: 0, serious: 0, moderate: 0, minor: 0 }
    );
    const rulesPassed = okPages.reduce((sum, p) => sum + p.rulesPassed, 0);
    const detail = worstPage ?? okPages[0];

    // Pages we discovered but could not finish inline go to the background queue.
    const scannedUrls = new Set(okPages.map((p) => p.url));
    const queuedPages = discovered.pages.filter((p) => !scannedUrls.has(p));
    if (queuedPages.length > 0) {
      const rows = queuedPages.map((pageUrl) => ({
        user_id: user.id,
        url: pageUrl,
        host: target.host,
        run_id: runId,
        status: 'pending',
      }));
      const { error: queueError } = await supabase.from('scan_queue').insert(rows);
      if (queueError) {
        console.warn('scan_queue insert skipped:', queueError.message);
      }
    }

    // Badge should reflect the weakest scored page from this run, not the last page.
    if (badgeToken) {
      try {
        const admin = createSupabaseAdminClient();
        const { error: badgeError } = await admin
          .from('badges')
          .update({ score: headlineScore, scanned_at: new Date().toISOString() })
          .eq('token', badgeToken);
        if (badgeError) console.warn('badge score sync skipped:', badgeError.message);
      } catch (err) {
        console.warn(
          'badge score sync unavailable:',
          err instanceof Error ? err.message : err
        );
      }
    }

    return NextResponse.json({
      mode: 'site',
      scanId: detail.scanId,
      runId,
      url: target.href,
      host: target.host,
      timestamp: new Date().toISOString(),
      standards: WCAG_TAGS,
      rulesPassed,
      violationsCount: totalViolations,
      score: headlineScore,
      scoreNote:
        failedPages.length > 0
          ? `Worst scored page among ${okPages.length} successful pages. ${failedPages.length} page(s) failed and are not in this score.`
          : `Worst scored page among ${okPages.length} successful pages (not an average).`,
      elementsAffected: totalElements,
      counts,
      violations: aggregatedViolations,
      discoverySource: discovered.source,
      pagesDiscovered: discovered.pages.length,
      pagesScanned: okPages.length,
      pagesFailed: failedPages.length,
      pagesQueued: queuedPages.length,
      pages: pageResults,
      badgeUrl: badgeToken
        ? `${req.nextUrl.origin}/api/badge?token=${badgeToken}`
        : null,
      usage: lastUsage,
    });
  } catch (error) {
    if (error instanceof BadRequestError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (error instanceof BrowserBusyError) {
      return NextResponse.json(
        { error: error.message },
        { status: 429, headers: { 'Retry-After': '30' } }
      );
    }

    if (error instanceof ScanTimeoutError) {
      return NextResponse.json({ error: error.message }, { status: 504 });
    }

    if (error instanceof ScanBlockedError) {
      return NextResponse.json(
        { error: error.message, code: 'BOT_CHECK' },
        { status: 422 }
      );
    }

    console.error('Scan error:', error);
    return NextResponse.json(
      {
        error:
          'We could not finish this scan. Please try again in a moment. If it keeps failing, email support@geta11yfix.com with the URL and we will look into it.',
        details: error instanceof Error ? error.message : String(error),
        code: 'SCAN_FAILED',
      },
      { status: 500 }
    );
  }
}

function quotaErrorResponse(message: string) {
  if (message.includes('QUOTA_EXCEEDED')) {
    const [used, limit] = message.split('QUOTA_EXCEEDED:')[1]?.split('/') ?? [];
    return NextResponse.json(
      {
        error: `Monthly scan limit reached (${used ?? '?'}/${limit ?? '?'}). Upgrade to keep scanning.`,
        code: 'QUOTA_EXCEEDED',
      },
      { status: 429 }
    );
  }

  if (message.includes('SITE_LIMIT_EXCEEDED')) {
    const limit = message.split('SITE_LIMIT_EXCEEDED:')[1];
    return NextResponse.json(
      {
        error: `Your plan covers ${limit ?? '1'} site(s) per month. Upgrade to scan more hosts.`,
        code: 'SITE_LIMIT_EXCEEDED',
      },
      { status: 403 }
    );
  }

  if (message.includes('AUTH_REQUIRED')) {
    return NextResponse.json(
      { error: 'Sign in to run a scan', code: 'AUTH_REQUIRED' },
      { status: 401 }
    );
  }

  console.error('Scan could not be stored:', message);
  return NextResponse.json(
    { error: 'The scan completed but could not be saved. Please retry.' },
    { status: 500 }
  );
}
