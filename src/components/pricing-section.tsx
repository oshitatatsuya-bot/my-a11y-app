import { Check } from "lucide-react"

import { UpgradeButton } from "@/components/billing-buttons"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const plans = [
  {
    name: "Free",
    price: "$0",
    cadence: "forever",
    description: "Taste the full loop—site scan, axe-checked AI fix, draft ACR—before you pay.",
    featured: false,
    cta: { kind: "link" as const, label: "Start free", href: "/login?next=/scan" },
    features: [
      "3 sites · 15 page scans / month · sitemap site scan (up to 5 pages)",
      "example.com demos do not use a site slot",
      "15 AI fixes / month with axe re-check + GitHub PR",
      "Draft ACR (not a VPAT) + score badge",
      "Score monitoring alerts when regressions appear",
    ],
  },
  {
    name: "Pro",
    price: "$29",
    cadence: "/mo",
    description: "Built for in-house product and compliance teams shipping continuously.",
    featured: true,
    cta: { kind: "upgrade" as const },
    features: [
      "1,000 page scans / month on 3 sites",
      "Site scans up to 25 pages via sitemap",
      "1,000 AI fixes / month + GitHub PR flow",
      "Draft ACR exports + monitoring",
      "Email support when self-serve is not enough",
      "Self-serve billing via Stripe",
    ],
  },
  {
    name: "Agency",
    price: "$99",
    cadence: "/mo",
    description: "Portfolio coverage for agencies that ship client accessibility with every delivery.",
    featured: false,
    cta: {
      kind: "link" as const,
      label: "Join Agency waitlist",
      href: "#agency-waitlist",
    },
    features: [
      "5,000 page scans / month · up to 100 pages per site scan",
      "1,000 client hosts / month",
      "GitHub PR workflow for client repos",
      "Team seats and white-label reports (next)",
      "We onboard Agency accounts from the waitlist first",
    ],
  },
]

export function PricingSection() {
  return (
    <section
      id="pricing"
      aria-labelledby="pricing-heading"
      className="bg-slate-50 py-20"
    >
      <div className="mx-auto max-w-6xl px-6">
        <p className="text-center text-sm font-medium tracking-wide text-sky-800 uppercase">
          Pricing
        </p>
        <h2
          id="pricing-heading"
          className="mt-2 text-center text-3xl font-semibold tracking-tight text-slate-950"
        >
          Straightforward plans. No overlay tax.
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-base text-slate-600">
          Start free. Upgrade when site scans, AI fixes, and GitHub PRs become
          part of every release—not when an overlay tax shows up on the invoice.
        </p>
        <ul className="mt-12 grid gap-6 lg:grid-cols-3">
          {plans.map((plan) => (
            <li
              key={plan.name}
              className={`flex flex-col rounded-2xl border bg-white p-6 shadow-sm ${
                plan.featured
                  ? "border-sky-600 ring-2 ring-sky-600"
                  : "border-slate-200"
              }`}
            >
              {plan.featured ? (
                <p className="mb-3 text-xs font-semibold tracking-wide text-sky-800 uppercase">
                  Most popular
                </p>
              ) : null}
              <h3 className="text-lg font-semibold text-slate-950">{plan.name}</h3>
              <p className="mt-3 flex items-baseline gap-1">
                <span className="text-4xl font-semibold tracking-tight text-slate-950">
                  {plan.price}
                </span>
                <span className="text-sm text-slate-500">{plan.cadence}</span>
              </p>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                {plan.description}
              </p>
              <ul className="mt-6 flex flex-1 flex-col gap-2">
                {plan.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-2 text-sm text-slate-700"
                  >
                    <Check
                      aria-hidden="true"
                      className="mt-0.5 size-4 shrink-0 text-sky-700"
                    />
                    {feature}
                  </li>
                ))}
              </ul>
              {plan.cta.kind === "upgrade" ? (
                <UpgradeButton className="mt-8" featured={plan.featured} />
              ) : (
                <a
                  href={plan.cta.href}
                  className={cn(
                    buttonVariants({
                      variant: plan.featured ? "default" : "outline",
                    }),
                    "mt-8 h-10 w-full",
                    plan.featured && "bg-sky-700 text-white hover:bg-sky-800"
                  )}
                >
                  {plan.cta.label}
                </a>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
