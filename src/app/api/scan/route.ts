import { lookup } from 'node:dns/promises';
import { NextRequest, NextResponse } from 'next/server';
import { AxePuppeteer } from '@axe-core/puppeteer';

import {
  WCAG_TAGS,
  normalizeImpact,
  sortViolations,
  summarizeViolations,
  type Violation,
} from '@/lib/a11y';
import { BrowserBusyError, withBrowser } from '@/lib/browser';
import {
  ScanBlockedError,
  ScanTimeoutError,
  openScanTarget,
} from '@/lib/scan-target';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadScannedHosts, loadUsage } from '@/lib/usage';

// Headless Chrome startup plus page load exceeds the platform default of 10s.
export const maxDuration = 60;

function isBlockedAddress(address: string, family: number): boolean {
  if (family === 4) {
    const [a, b] = address.split('.').map(Number);
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true; // link-local, incl. cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT
    return false;
  }

  const ip = address.toLowerCase();
  if (ip === '::' || ip === '::1') return true;
  if (ip.startsWith('::ffff:')) return isBlockedAddress(ip.slice(7), 4);
  if (/^f[cd]/.test(ip)) return true; // unique local, fc00::/7
  if (/^fe[89ab]/.test(ip)) return true; // link-local, fe80::/10
  return false;
}

// Opt-in for local development, so a developer can scan their own dev server.
// Never honoured on Vercel, where it would expose internal services.
const allowPrivateTargets =
  !process.env.VERCEL && process.env.ALLOW_PRIVATE_SCAN_TARGETS === 'true';

/**
 * Blocks scans of addresses that are only reachable from inside the network the
 * scanner runs in, so the endpoint cannot be used to read private services or
 * cloud instance metadata.
 */
async function assertPublicHost(hostname: string) {
  if (allowPrivateTargets) return;

  const addresses = await lookup(hostname, { all: true });

  if (addresses.some(({ address, family }) => isBlockedAddress(address, family))) {
    throw new BadRequestError('Only publicly reachable hosts can be scanned');
  }
}

class BadRequestError extends Error {}

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
    const { url } = await req.json();

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

    // Checked before launching Chrome so an exhausted quota does not burn a
    // browser run. `record_scan` re-checks atomically, which is authoritative.
    const usage = await loadUsage(supabase, user.id);
    if (usage.scansUsed >= usage.limits.scansPerMonth) {
      return NextResponse.json(
        {
          error: `Your ${usage.limits.label} plan allows ${usage.limits.scansPerMonth} scans per month.`,
          code: 'QUOTA_EXCEEDED',
          usage: { plan: usage.plan, scansUsed: usage.scansUsed, scansLimit: usage.limits.scansPerMonth },
        },
        { status: 429 }
      );
    }

    // Same reasoning as the quota check above: a scan that cannot be recorded
    // must not cost a browser run either.
    const hosts = await loadScannedHosts(supabase, user.id, usage.periodStart);
    if (!hosts.includes(target.host) && hosts.length >= usage.limits.sites) {
      return NextResponse.json(
        {
          error: `Your ${usage.limits.label} plan covers ${usage.limits.sites} site${
            usage.limits.sites === 1 ? '' : 's'
          } per month, and you have already scanned ${hosts.join(', ')} this month. Upgrade to scan more hosts.`,
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

    // axe-coreによるWCAGスキャン実行（WCAG 2.x A/AAのルールのみ）
    const axeResults = await withBrowser(async (browser) => {
      const page = await browser.newPage();
      await openScanTarget(page, target.href);

      return new AxePuppeteer(page).withTags(WCAG_TAGS).analyze();
    });

    // レスポンス用データ整形
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

    const { data: recorded, error: recordError } = await supabase
      .rpc('record_scan', {
        p_url: target.href,
        p_host: target.host,
        p_score: summary.score,
        p_violations_count: violations.length,
        p_elements_affected: summary.elementsAffected,
        p_critical: summary.counts.critical,
        p_serious: summary.counts.serious,
        p_moderate: summary.counts.moderate,
        p_minor: summary.counts.minor,
        p_violations: violations,
      })
      .single<{
        scan_id: string;
        badge_token: string;
        scans_used: number;
        scans_limit: number;
        sites_limit: number;
      }>();

    if (recordError) {
      return quotaErrorResponse(recordError.message);
    }

    return NextResponse.json({
      scanId: recorded.scan_id,
      url: target.href,
      host: target.host,
      timestamp: new Date().toISOString(),
      standards: WCAG_TAGS,
      rulesPassed: axeResults.passes.length,
      violationsCount: violations.length,
      ...summary,
      violations,
      badgeUrl: `${req.nextUrl.origin}/api/badge?token=${recorded.badge_token}`,
      usage: {
        plan: usage.plan,
        scansUsed: recorded.scans_used,
        scansLimit: recorded.scans_limit,
      },
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
      return NextResponse.json({ error: error.message, code: 'BOT_CHECK' }, { status: 422 });
    }

    console.error('Scan error:', error);
    return NextResponse.json(
      {
        error: 'Failed to scan the target URL',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * `record_scan` signals a rejected scan by raising an exception whose message
 * starts with a machine-readable code.
 */
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
