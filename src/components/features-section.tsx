import { BadgeCheck, ScanSearch, Sparkles } from "lucide-react"

const features = [
  {
    icon: ScanSearch,
    title: "Instant Scan",
    body: "Paste a URL and get WCAG-aligned findings in minutes—contrast, names, roles, keyboard traps, and more—ranked by severity for product owners.",
  },
  {
    icon: Sparkles,
    title: "AI Code Fix",
    body: "Receive suggested patches in the stack you already ship. Review, apply, and re-scan so accessibility work lives in Git, not in a PDF appendix.",
  },
  {
    icon: BadgeCheck,
    title: "Embeddable Badge",
    body: "Publish a living compliance badge that reflects your latest passing scan. Show customers and counsel you are iterating—not hiding behind an overlay.",
  },
]

export function FeaturesSection() {
  return (
    <section
      id="features"
      aria-labelledby="features-heading"
      className="bg-white py-20"
    >
      <div className="mx-auto max-w-6xl px-6">
        <p className="text-sm font-medium tracking-wide text-sky-800 uppercase">
          Platform
        </p>
        <h2
          id="features-heading"
          className="mt-2 max-w-2xl text-3xl font-semibold tracking-tight text-slate-950"
        >
          Scan, fix, and prove progress in one workflow
        </h2>
        <ul className="mt-12 grid gap-8 md:grid-cols-3">
          {features.map((feature) => (
            <li key={feature.title} className="flex flex-col">
              <div className="flex size-11 items-center justify-center rounded-xl bg-slate-950 text-sky-300">
                <feature.icon aria-hidden="true" className="size-5" />
              </div>
              <h3 className="mt-5 text-xl font-semibold text-slate-950">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                {feature.body}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
