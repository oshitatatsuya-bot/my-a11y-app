import Link from "next/link"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function HeroSection() {
  return (
    <section
      id="hero"
      aria-labelledby="hero-heading"
      className="relative overflow-hidden border-b border-slate-800 bg-slate-950"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(14,165,233,0.18),_transparent_55%)]"
      />
      <div className="relative mx-auto grid max-w-6xl gap-12 px-6 py-20 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-center lg:py-28">
        <div>
          <p className="mb-4 text-sm font-medium tracking-wide text-sky-300 uppercase">
            WCAG 2.2 · ADA · Section 508
          </p>
          <h1
            id="hero-heading"
            className="max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-5xl sm:leading-tight"
          >
            Fix WCAG &amp; ADA Compliance Issues Before You Get Sued
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-300">
            Sitemap-aware site scans, AI code fixes with axe re-checks, and
            one-click GitHub pull requests—so teams prove progress without
            overlay widgets or a six-figure audit retainer.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/login?next=/scan"
              className={cn(
                buttonVariants({ size: "lg" }),
                "h-11 bg-sky-500 px-6 text-sm font-semibold text-slate-950 hover:bg-sky-400"
              )}
            >
              Start free scan
            </Link>
            <Link
              href="/login"
              className={cn(
                buttonVariants({ size: "lg", variant: "outline" }),
                "h-11 border-slate-600 bg-transparent px-6 text-sm font-semibold text-white hover:bg-slate-900 hover:text-white"
              )}
            >
              Sign in
            </Link>
          </div>
          <p className="mt-4 text-sm text-slate-400">
            Free plan: 1 site, 5 page scans / month (sitemap site scan
            supported). No credit card. Self-serve docs in-product; email{' '}
            <a
              href="mailto:support@geta11yfix.com"
              className="font-medium text-sky-300 underline underline-offset-4 hover:text-sky-200"
            >
              support@geta11yfix.com
            </a>{' '}
            when you need a human.{' '}
            <Link
              href="/privacy"
              className="font-medium text-sky-300 underline underline-offset-4 hover:text-sky-200"
            >
              Privacy policy
            </Link>
            .
          </p>
        </div>
        <aside
          aria-label="Product snapshot"
          className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-sky-950/40"
        >
          <p className="text-xs font-medium tracking-wide text-slate-400 uppercase">
            Sample scan summary
          </p>
          <dl className="mt-5 grid grid-cols-2 gap-4">
            <div className="rounded-xl bg-slate-950 p-4">
              <dt className="text-sm text-slate-400">Critical issues</dt>
              <dd className="mt-1 text-2xl font-semibold text-white">12</dd>
            </div>
            <div className="rounded-xl bg-slate-950 p-4">
              <dt className="text-sm text-slate-400">WCAG AA coverage</dt>
              <dd className="mt-1 text-2xl font-semibold text-white">74%</dd>
            </div>
            <div className="col-span-2 rounded-xl bg-slate-950 p-4">
              <dt className="text-sm text-slate-400">Suggested fix</dt>
              <dd className="mt-2 font-mono text-sm leading-relaxed text-sky-200">
                {`aria-labelledby="checkout-heading"`}
              </dd>
            </div>
          </dl>
        </aside>
      </div>
    </section>
  )
}
