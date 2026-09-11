'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import { UpgradeButton } from '@/components/billing-buttons';
import { ScanResults, type ScanResultView } from '@/components/scan-results';

interface UsageState {
  planLabel: string;
  scansUsed: number;
  scansLimit: number;
  sites: number;
}

type ErrorKind = 'bot' | 'timeout' | 'busy' | 'quota' | 'generic';

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

async function readJsonBody(res: Response) {
  const text = await res.text();
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    const snippet = text.replace(/\s+/g, ' ').trim().slice(0, 160);
    throw new Error(
      res.ok
        ? `The server returned a non-JSON response: ${snippet || '(empty)'}`
        : `We hit an unexpected server response (HTTP ${res.status}). Please try once more. If it continues, write to support@geta11yfix.com with the URL.`
    );
  }
}

function classifyError(code: unknown, status: number, message: string): ErrorKind {
  if (code === 'BOT_CHECK') return 'bot';
  if (code === 'QUOTA_EXCEEDED' || code === 'SITE_LIMIT_EXCEEDED') return 'quota';
  if (status === 504 || /too long|timed? ?out/i.test(message)) return 'timeout';
  if (status === 429 || /busy|wait about 30/i.test(message)) return 'busy';
  return 'generic';
}

const ERROR_HINTS: Record<ErrorKind, string[]> = {
  bot: [
    'Open the URL in your browser and confirm the real page appears without a waiting screen.',
    'Prefer a staging or publicly cacheable page when the production site uses bot protection.',
    'You can verify the scanner with https://example.com first.',
  ],
  timeout: [
    'Confirm the page loads quickly in a normal browser.',
    'Very heavy pages sometimes need a second try after a short wait.',
    'If it keeps timing out, email us the URL and we will investigate.',
  ],
  busy: [
    'Another scan is using the browser pool. Wait about 30 seconds, then retry.',
  ],
  quota: [
    'Your monthly allowance is used up. Upgrade for more capacity, or wait until next month.',
  ],
  generic: [
    'Retry once. Transient failures do happen on cold starts.',
    'If it fails again, email support@geta11yfix.com with the URL—we reply within one business day (JST).',
  ],
};

export function ScanConsole({ initialUsage }: { initialUsage: UsageState }) {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScanResultView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<ErrorKind>('generic');
  const [offerUpgrade, setOfferUpgrade] = useState(false);
  const [usage, setUsage] = useState(initialUsage);

  const scansLeft = Math.max(0, usage.scansLimit - usage.scansUsed);
  const quotaReached = scansLeft === 0;
  const canUpgrade = usage.planLabel === 'Free';

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setErrorKind('generic');
    setOfferUpgrade(false);
    setResult(null);
    let nextKind: ErrorKind = 'generic';

    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await readJsonBody(res);

      if (res.status === 401) {
        router.push('/login?next=/scan');
        return;
      }

      if (!res.ok) {
        const message =
          typeof data.error === 'string' ? data.error : 'Scan failed';
        const details =
          typeof data.details === 'string' && data.details !== message
            ? data.details
            : null;
        nextKind = classifyError(data.code, res.status, message);
        if (
          data.code === 'QUOTA_EXCEEDED' ||
          data.code === 'SITE_LIMIT_EXCEEDED' ||
          nextKind === 'quota' ||
          (canUpgrade && (res.status === 429 || res.status === 403))
        ) {
          setOfferUpgrade(canUpgrade);
        }
        throw new Error(details ? `${message} (${details})` : message);
      }

      const scan = data as ScanResultView & {
        usage?: { scansUsed: number; scansLimit: number };
      };
      setResult({
        ...scan,
        rulesPassed: scan.rulesPassed ?? null,
        badgeUrl: scan.badgeUrl ?? null,
      });
      if (scan.usage) {
        setUsage((prev) => ({ ...prev, ...scan.usage }));
        router.refresh();
      }
    } catch (err: unknown) {
      const message = errorMessage(err);
      if (nextKind === 'generic') {
        nextKind = classifyError(undefined, 0, message);
      }
      setErrorKind(nextKind);
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Accessibility Scanner &amp; AI Fixer
        </h1>
        <p className="text-slate-400 mt-2">
          Enter a URL to scan for WCAG 2.0–2.2 level A and AA violations and
          generate AI code fixes.
        </p>
        <p className="text-sm text-slate-500 mt-2">
          {usage.planLabel} plan: {scansLeft} of {usage.scansLimit} scans left
          this month, across{' '}
          {usage.sites === 1 ? 'one site' : `${usage.sites} sites`}.
        </p>
      </div>

      <form onSubmit={handleScan} className="flex gap-4">
        <label htmlFor="scan-url" className="sr-only">
          URL to scan
        </label>
        <input
          id="scan-url"
          type="url"
          required
          placeholder="https://example.com"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={loading || quotaReached}
          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium px-6 py-3 rounded-lg transition"
        >
          {loading ? 'Scanning...' : 'Scan Now'}
        </button>
      </form>

      {quotaReached && (
        <div className="rounded-xl border border-amber-800 bg-amber-950/40 p-4 space-y-3">
          <p className="text-sm text-amber-200">
            You have used all {usage.scansLimit} scans in your {usage.planLabel}{' '}
            plan this month.
            {canUpgrade
              ? ' When you are ready, Pro unlocks 1,000 scans across 3 sites—no pressure either way.'
              : ' Your allowance renews at the start of next month. Thank you for scanning with us.'}
          </p>
          {canUpgrade ? <UpgradeButton /> : null}
        </div>
      )}

      <p role="status" aria-live="polite" className="sr-only">
        {loading
          ? 'Scanning in progress'
          : result
            ? `Scan finished with ${result.violationsCount} violated rules`
            : ''}
      </p>

      {error && (
        <div
          className="p-4 bg-red-950/50 border border-red-800 rounded-lg text-red-200 space-y-3"
          role="alert"
        >
          <p className="font-medium text-red-300">{error}</p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-red-200/90">
            {ERROR_HINTS[errorKind].map((hint) => (
              <li key={hint}>{hint}</li>
            ))}
          </ul>
          <p className="text-sm text-slate-400">
            Need a hand?{' '}
            <a
              href="mailto:support@geta11yfix.com"
              className="text-sky-400 underline underline-offset-4 hover:text-sky-300"
            >
              support@geta11yfix.com
            </a>
            {' · '}
            <Link
              href="https://example.com"
              className="text-sky-400 underline underline-offset-4 hover:text-sky-300"
              onClick={(event) => {
                event.preventDefault();
                setUrl('https://example.com');
              }}
            >
              Try example.com
            </Link>
          </p>
          {offerUpgrade ? <UpgradeButton /> : null}
        </div>
      )}

      {loading && (
        <p className="text-slate-400 text-sm">
          Opening the page in a private browser and running axe-core. Most scans
          finish in 5–15 seconds—thank you for waiting.
        </p>
      )}

      {result && <ScanResults result={result} offerUpgrade={canUpgrade} />}
    </div>
  );
}
