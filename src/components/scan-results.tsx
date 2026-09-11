'use client';

import { useState } from 'react';

import { UpgradeButton } from '@/components/billing-buttons';
import {
  IMPACT_ORDER,
  scoreColor,
  type Impact,
  type Violation,
  type ViolationNode,
} from '@/lib/a11y';

export interface ScanResultView {
  scanId: string;
  url: string;
  host: string;
  timestamp: string;
  rulesPassed: number | null;
  violationsCount: number;
  score: number;
  elementsAffected: number;
  counts: Record<Impact, number>;
  violations: Violation[];
  badgeUrl: string | null;
}

type Verification = 'verified' | 'unverified' | 'not-verifiable';

interface FixResult {
  originalCode: string;
  fixedCode: string;
  explanation: string;
  verification: Verification;
}

const VERIFICATION_COPY: Record<
  Verification,
  { label: string; detail: string; className: string }
> = {
  verified: {
    label: 'Verified',
    detail: 'Re-scanned with axe-core: this rule no longer fails on the fixed code.',
    className: 'border-emerald-800 bg-emerald-950/40 text-emerald-300',
  },
  unverified: {
    label: 'Not verified',
    detail: 'axe-core still reports this rule on the fixed code. Review it before shipping.',
    className: 'border-amber-800 bg-amber-950/40 text-amber-300',
  },
  'not-verifiable': {
    label: 'Not checked',
    detail:
      'This rule depends on the rest of the page, so the fix could not be confirmed in isolation.',
    className: 'border-slate-700 bg-slate-900 text-slate-300',
  },
};

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

export function ScanResults({
  result,
  offerUpgrade = false,
}: {
  result: ScanResultView;
  offerUpgrade?: boolean;
}) {
  const [fixingKey, setFixingKey] = useState<string | null>(null);
  const [fixes, setFixes] = useState<Record<string, FixResult>>({});
  const [fixErrors, setFixErrors] = useState<Record<string, string>>({});
  const [showFixUpgrade, setShowFixUpgrade] = useState(false);

  const handleGenerateFix = async (violation: Violation, node: ViolationNode) => {
    const key = `${violation.id}-${node.html}`;
    setFixingKey(key);
    setFixErrors((prev) => ({ ...prev, [key]: '' }));
    setShowFixUpgrade(false);

    try {
      const res = await fetch('/api/fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          html: node.html,
          failureSummary: node.failureSummary,
          description: violation.description,
          help: violation.help,
          ruleId: violation.id,
        }),
      });
      const text = await res.text();
      let data: Record<string, unknown> = {};
      try {
        data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
      } catch {
        throw new Error(
          `Fix failed with HTTP ${res.status}: ${text.replace(/\s+/g, ' ').trim().slice(0, 160) || 'empty response'}`
        );
      }

      if (!res.ok) {
        if (data.code === 'FIX_QUOTA_EXCEEDED' && offerUpgrade) {
          setShowFixUpgrade(true);
        }
        throw new Error(
          typeof data.error === 'string' ? data.error : 'Fix failed'
        );
      }
      setFixes((prev) => ({ ...prev, [key]: data as unknown as FixResult }));
    } catch (err: unknown) {
      setFixErrors((prev) => ({ ...prev, [key]: errorMessage(err) }));
    } finally {
      setFixingKey(null);
    }
  };

  const badgeSnippet = result.badgeUrl
    ? `<a href="https://${result.host}">\n  <img src="${result.badgeUrl}" alt="WCAG 2.2 AA score for ${result.host}" width="180" height="20" />\n</a>`
    : null;

  return (
    <div className="space-y-8">
      {showFixUpgrade ? (
        <div className="rounded-xl border border-amber-800 bg-amber-950/40 p-4 space-y-3">
          <p className="text-sm text-amber-200">
            You’ve reached this month’s AI fix limit on the Free plan. Pro adds
            more verified fixes when you need them—no rush if you’d rather wait
            for the monthly reset.
          </p>
          <UpgradeButton />
        </div>
      ) : null}

      <section aria-labelledby="summary-heading" className="space-y-4">
        <h2 id="summary-heading" className="text-xl font-semibold">
          Results for {result.host}
        </h2>
        <p className="text-sm text-slate-400 break-all">{result.url}</p>

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
            <div className="text-3xl font-semibold mt-1">
              {result.rulesPassed === null ? '—' : result.rulesPassed}
            </div>
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

        {badgeSnippet && result.badgeUrl && (
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

      {result.violations.length === 0 && (
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
        {result.violations.map((v) => (
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
                <div
                  key={i}
                  className="bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-3"
                >
                  {node.failureSummary && (
                    <div className="text-xs font-mono text-amber-400 bg-amber-950/30 p-2 rounded whitespace-pre-line">
                      {node.failureSummary}
                    </div>
                  )}
                  <div className="text-xs text-slate-500 font-mono">
                    {node.target.join(' ')}
                  </div>
                  <pre className="text-xs font-mono text-slate-300 bg-slate-900 p-3 rounded overflow-x-auto">
                    <code>{node.html}</code>
                  </pre>

                  {!fix ? (
                    <div className="space-y-2">
                      <button
                        type="button"
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
                        <div className="text-xs font-semibold text-emerald-400">
                          Fixed Code (AI):
                        </div>
                        <CopyButton value={fix.fixedCode} label="Copy code" />
                      </div>
                      <pre className="text-xs font-mono text-emerald-300 bg-emerald-950/30 border border-emerald-900 p-3 rounded overflow-x-auto">
                        <code>{fix.fixedCode}</code>
                      </pre>
                      <div
                        className={`rounded border px-3 py-2 text-xs ${VERIFICATION_COPY[fix.verification].className}`}
                      >
                        <span className="font-semibold">
                          {VERIFICATION_COPY[fix.verification].label}
                        </span>
                        {' — '}
                        {VERIFICATION_COPY[fix.verification].detail}
                      </div>
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
