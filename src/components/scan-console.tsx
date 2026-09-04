'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import {
  IMPACT_ORDER,
  scoreColor,
  type Impact,
  type Violation,
  type ViolationNode,
} from '@/lib/a11y';

interface UsageState {
  planLabel: string;
  scansUsed: number;
  scansLimit: number;
  sites: number;
}

interface ScanResult {
  scanId: string;
  url: string;
  host: string;
  timestamp: string;
  rulesPassed: number;
  violationsCount: number;
  score: number;
  elementsAffected: number;
  counts: Record<Impact, number>;
  violations: Violation[];
  badgeUrl: string;
  usage?: { scansUsed: number; scansLimit: number };
}

interface FixResult {
  originalCode: string;
  fixedCode: string;
  explanation: string;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="text-xs text-slate-300 border border-slate-700 hover:border-slate-500 hover:text-white px-2 py-1 rounded transition"
    >
      {copied ? 'Copied' : label}
    </button>
  );
}

export function ScanConsole({ initialUsage }: { initialUsage: UsageState }) {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState(initialUsage);
  const [fixingKey, setFixingKey] = useState<string | null>(null);
  const [fixes, setFixes] = useState<Record<string, FixResult>>({});
  const [fixErrors, setFixErrors] = useState<Record<string, string>>({});

  const scansLeft = Math.max(0, usage.scansLimit - usage.scansUsed);
  const quotaReached = scansLeft === 0;

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    setFixes({});
    setFixErrors({});

    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();

      // The session expired while the page was open.
      if (res.status === 401) {
        router.push('/login?next=/scan');
        return;
      }

      if (!res.ok) throw new Error(data.error || 'Scan failed');

      const scan = data as ScanResult;
      setResult(scan);
      if (scan.usage) {
        setUsage((prev) => ({ ...prev, ...scan.usage }));
        // The header count is rendered on the server, so refresh it too.
        router.refresh();
      }
    } catch (err: unknown) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateFix = async (violation: Violation, node: ViolationNode) => {
    const key = `${violation.id}-${node.html}`;
    setFixingKey(key);
    setFixErrors((prev) => ({ ...prev, [key]: '' }));

    try {
      const res = await fetch('/api/fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          html: node.html,
          failureSummary: node.failureSummary,
          description: violation.description,
          help: violation.help,
        }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Fix failed');
      setFixes((prev) => ({ ...prev, [key]: data as FixResult }));
    } catch (err: unknown) {
      setFixErrors((prev) => ({ ...prev, [key]: errorMessage(err) }));
    } finally {
      setFixingKey(null);
    }
  };

  const badgeSnippet = result
    ? `<a href="https://${result.host}">\n  <img src="${result.badgeUrl}" alt="WCAG 2.2 AA score for ${result.host}" width="180" height="20" />\n</a>`
    : null;

  return (
    <div className="max-w-4xl mx-auto p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Accessibility Scanner &amp; AI Fixer</h1>
        <p className="text-slate-400 mt-2">
          Enter a URL to scan for WCAG 2.0–2.2 level A and AA violations and generate AI code fixes.
        </p>
        <p className="text-sm text-slate-500 mt-2">
          {usage.planLabel} plan: {scansLeft} of {usage.scansLimit} scans left this month,
          across {usage.sites === 1 ? 'one site' : `${usage.sites} sites`}.
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
        <p className="text-sm text-amber-300">
          You have used all {usage.scansLimit} scans in your {usage.planLabel} plan this month.
          The allowance resets at the start of next month.
        </p>
      )}

      <p role="status" aria-live="polite" className="sr-only">
        {loading
          ? 'Scanning in progress'
          : result
            ? `Scan finished with ${result.violationsCount} violated rules`
            : ''}
      </p>

      {error && (
        <div className="p-4 bg-red-950/50 border border-red-800 rounded-lg text-red-400" role="alert">
          {error}
        </div>
      )}

      {loading && (
        <p className="text-slate-400 text-sm">
          Loading the page in a headless browser and running axe-core. This usually takes 5–15 seconds.
        </p>
      )}

      {result && (
        <section aria-labelledby="summary-heading" className="space-y-4">
          <h2 id="summary-heading" className="text-xl font-semibold">
            Results for {result.host}
          </h2>

          <div className="grid gap-4 sm:grid-cols-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <div className="text-xs uppercase tracking-wider text-slate-400">Score</div>
              <div
                className="text-3xl font-semibold mt-1"
                style={{ color: scoreColor(result.score) }}
              >
                {result.score}
                <span className="text-base text-slate-500"> / 100</span>
              </div>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <div className="text-xs uppercase tracking-wider text-slate-400">Rules violated</div>
              <div className="text-3xl font-semibold mt-1">{result.violationsCount}</div>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <div className="text-xs uppercase tracking-wider text-slate-400">Elements affected</div>
              <div className="text-3xl font-semibold mt-1">{result.elementsAffected}</div>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <div className="text-xs uppercase tracking-wider text-slate-400">Rules passed</div>
              <div className="text-3xl font-semibold mt-1">{result.rulesPassed}</div>
            </div>
          </div>

          <dl className="flex flex-wrap gap-3 text-sm">
            {IMPACT_ORDER.map((impact) => (
              <div
                key={impact}
                className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5"
              >
                <dt className="capitalize text-slate-400">{impact}</dt>
                <dd className="font-semibold">{result.counts[impact]}</dd>
              </div>
            ))}
          </dl>

          {badgeSnippet && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between gap-4">
                <h3 className="font-medium">Embeddable badge</h3>
                <CopyButton value={badgeSnippet} label="Copy snippet" />
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={result.badgeUrl}
                alt={`WCAG 2.2 AA score for ${result.host}`}
                width={180}
                height={20}
              />
              <p className="text-xs text-slate-400">
                The badge always reflects your most recent scan of this host. Keep the
                token private to anyone you do not want reading this score.
              </p>
              <pre className="text-xs font-mono text-slate-300 bg-slate-950 p-3 rounded overflow-x-auto">
                <code>{badgeSnippet}</code>
              </pre>
            </div>
          )}
        </section>
      )}

      {result && result.violations.length === 0 && (
        <div className="p-6 bg-emerald-950/40 border border-emerald-800 rounded-xl">
          <p className="font-medium text-emerald-300">
            No WCAG 2.0–2.2 A/AA violations were detected on this page.
          </p>
          <p className="text-sm text-slate-400 mt-2">
            Automated testing covers roughly a third of the success criteria. Keyboard
            operation, focus order and screen reader semantics still need manual review.
          </p>
        </div>
      )}

      <div className="space-y-6">
        {result?.violations.map((v) => (
          <div key={v.id} className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm font-semibold uppercase tracking-wider px-2 py-1 bg-slate-800 rounded text-slate-300">
                Impact: {v.impact}
              </span>
              <a
                href={v.helpUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-blue-400 hover:underline"
              >
                Rule Spec ↗
              </a>
            </div>
            <div>
              <p className="font-medium text-slate-200">{v.help}</p>
              <p className="text-sm text-slate-400 mt-1">{v.description}</p>
            </div>

            {v.nodes.map((node, i) => {
              const key = `${v.id}-${node.html}`;
              const fix = fixes[key];
              const fixError = fixErrors[key];

              return (
                <div key={i} className="bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-3">
                  {node.failureSummary && (
                    <div className="text-xs font-mono text-amber-400 bg-amber-950/30 p-2 rounded whitespace-pre-line">
                      {node.failureSummary}
                    </div>
                  )}
                  <div className="text-xs text-slate-500 font-mono">{node.target.join(' ')}</div>
                  <pre className="text-xs font-mono text-slate-300 bg-slate-900 p-3 rounded overflow-x-auto">
                    <code>{node.html}</code>
                  </pre>

                  {!fix ? (
                    <div className="space-y-2">
                      <button
                        onClick={() => handleGenerateFix(v, node)}
                        disabled={fixingKey === key}
                        className="text-xs bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium px-4 py-2 rounded transition"
                      >
                        {fixingKey === key ? 'Generating AI Fix...' : 'Fix with AI'}
                      </button>
                      {fixError && (
                        <p className="text-xs text-red-400" role="alert">
                          {fixError}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="mt-4 pt-4 border-t border-slate-800 space-y-3">
                      <div className="flex items-center justify-between gap-4">
                        <div className="text-xs font-semibold text-emerald-400">Fixed Code (AI):</div>
                        <CopyButton value={fix.fixedCode} label="Copy code" />
                      </div>
                      <pre className="text-xs font-mono text-emerald-300 bg-emerald-950/30 border border-emerald-900 p-3 rounded overflow-x-auto">
                        <code>{fix.fixedCode}</code>
                      </pre>
                      <p className="text-xs text-slate-400">{fix.explanation}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
