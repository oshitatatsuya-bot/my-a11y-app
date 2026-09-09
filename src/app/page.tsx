import Link from "next/link"

import { FeaturesSection } from "@/components/features-section"
import { HeroSection } from "@/components/hero-section"
import { PainPointsSection } from "@/components/pain-points-section"
import { PricingSection } from "@/components/pricing-section"

export default function Home() {
  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-3 focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-slate-950"
      >
        Skip to main content
      </a>
      <header className="border-b border-slate-800 bg-slate-950">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <a href="#waitlist" className="text-sm font-semibold tracking-tight text-white">
            A11yFix
          </a>
          <nav aria-label="Primary">
            <ul className="flex items-center gap-6 text-sm text-slate-300">
              <li>
                <a className="hover:text-white" href="#pain-points">
                  Risk
                </a>
              </li>
              <li>
                <a className="hover:text-white" href="#features">
                  Product
                </a>
              </li>
              <li>
                <a className="hover:text-white" href="#pricing">
                  Pricing
                </a>
              </li>
              <li>
                <Link className="hover:text-white" href="/scan">
                  Scanner
                </Link>
              </li>
              <li>
                <Link className="hover:text-white" href="/login">
                  Sign in
                </Link>
              </li>
              <li>
                <a
                  className="rounded-lg bg-sky-500 px-3 py-1.5 font-medium text-slate-950 hover:bg-sky-400"
                  href="#waitlist"
                >
                  Get access
                </a>
              </li>
            </ul>
          </nav>
        </div>
      </header>
      <main id="main-content">
        <HeroSection />
        <PainPointsSection />
        <FeaturesSection />
        <PricingSection />
      </main>
      <footer className="border-t border-slate-200 bg-white py-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} A11yFix. Accessibility tooling for product teams.</p>
          <p>
            <Link href="/privacy" className="hover:text-slate-700">
              Privacy
            </Link>
            <span aria-hidden="true"> · </span>
            Not a substitute for legal advice.
          </p>
        </div>
      </footer>
    </>
  )
}
