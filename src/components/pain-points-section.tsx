import { Gavel, Layers, Wallet } from "lucide-react"

const painPoints = [
  {
    icon: Gavel,
    title: "ADA lawsuits are a real P&L risk",
    body: "Demand letters and Title III filings now target mid-market sites, not just household brands. A public issue list without a remediation plan is evidence, not a defense.",
  },
  {
    icon: Wallet,
    title: "Enterprise scanners price out most teams",
    body: "Legacy platforms quote five- and six-figure contracts, professional services, and seat licenses. Legal needs coverage; engineering needs a tool they can actually run this sprint.",
  },
  {
    icon: Layers,
    title: "Overlays do not fix your code",
    body: "Widget layers can mask symptoms in a browser, but they do not change source HTML, CSS, or JS. Courts and disabled users still encounter the original inaccessible experience.",
  },
]

export function PainPointsSection() {
  return (
    <section
      id="pain-points"
      aria-labelledby="pain-points-heading"
      className="bg-slate-50 py-20"
    >
      <div className="mx-auto max-w-6xl px-6">
        <p className="text-sm font-medium tracking-wide text-sky-800 uppercase">
          Why teams switch
        </p>
        <h2
          id="pain-points-heading"
          className="mt-2 max-w-2xl text-3xl font-semibold tracking-tight text-slate-950"
        >
          Compliance theater is more expensive than fixing the product
        </h2>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-600">
          Legal wants risk down. Engineering wants diffs, not another overlay
          script. Procurement wants a price that does not require a board deck.
        </p>
        <ul className="mt-12 grid gap-6 md:grid-cols-3">
          {painPoints.map((item) => (
            <li
              key={item.title}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <item.icon
                aria-hidden="true"
                className="size-6 text-sky-700"
              />
              <h3 className="mt-4 text-lg font-semibold text-slate-950">
                {item.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                {item.body}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
