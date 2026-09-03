import { Check } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const plans = [
  {
    name: "Free",
    price: "$0",
    cadence: "forever",
    description: "Validate a single property and see whether we belong in your stack.",
    featured: false,
    features: [
      "1 site, 5 pages / month",
      "Core WCAG issue report",
      "Public badge (limited)",
    ],
  },
  {
    name: "Pro",
    price: "$29",
    cadence: "/mo",
    description: "Built for in-house product and compliance teams shipping continuously.",
    featured: true,
    features: [
      "Unlimited pages on 3 sites",
      "AI code-fix suggestions",
      "Historical scan trends",
      "Priority email support",
    ],
  },
  {
    name: "Agency",
    price: "$99",
    cadence: "/mo",
    description: "Run a portfolio of client properties from one workspace.",
    featured: false,
    features: [
      "Unlimited client sites",
      "White-label reports & badge",
      "Shared team seats",
      "SSO-ready on request",
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
          Start free. Upgrade when scans and fixes become part of every release.
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
              <a
                href="#waitlist"
                className={cn(
                  buttonVariants({
                    variant: plan.featured ? "default" : "outline",
                  }),
                  "mt-8 h-10 w-full",
                  plan.featured && "bg-sky-600 text-white hover:bg-sky-500"
                )}
              >
                Join waitlist
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
