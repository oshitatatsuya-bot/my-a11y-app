'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { UpgradeButton } from '@/components/billing-buttons';
import { ScanResults, type ScanResultView } from '@/components/scan-results';

interface UsageState {
  planLabel: string;
  scansUsed: number;
  scansLimit: number;
  sites: number;
}

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
        : `Scan failed with HTTP ${res.status}: ${snippet || 'empty response from the server'}`
    );
  }
}

export function ScanConsole({ initialUsage }: { initialUsage: UsageState }) {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScanResultView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [offerUpgrade, setOfferUpgrade] = useState(false);
  const [usage, setUsage] = useState(initialUsage);

  const scansLeft = Math.max(0, usage.scansLimit - usage.scansUsed);
  const quotaReached = scansLeft === 0;
  const canUpgrade = usage.planLabel === 'Free';

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setOfferUpgrade(false);
    setResult(null);

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
        if (
          data.code === 'QUOTA_EXCEEDED' ||
          data.code === 'SITE_LIMIT_EXCEEDED' ||
          res.status === 429 ||
          res.status === 403
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
      setError(errorMessage(err));
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
              ? ' Upgrade to Pro for 1,000 scans across 3 sites.'
              : ' The allowance resets at the start of next month.'}
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
          className="p-4 bg-red-950/50 border border-red-800 rounded-lg text-red-400 space-y-3"
          role="alert"
        >
          <p>{error}</p>
          {offerUpgrade ? <UpgradeButton /> : null}
        </div>
      )}

      {loading && (
        <p className="text-slate-400 text-sm">
          Loading the page in a headless browser and running axe-core. This
          usually takes 5–15 seconds.
        </p>
      )}

      {result && <ScanResults result={result} offerUpgrade={canUpgrade} />}
    </div>
  );
}
