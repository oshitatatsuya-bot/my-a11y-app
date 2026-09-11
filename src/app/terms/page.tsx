import Link from "next/link"

const SUPPORT_EMAIL = "support@geta11yfix.com"

export const metadata = {
  title: "Terms — A11yFix",
  description: "Terms of use for the A11yFix accessibility scanner.",
}

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-white text-slate-800">
      <div className="mx-auto max-w-2xl px-6 py-16">
        <Link href="/" className="text-sm font-semibold text-slate-950">
          A11yFix
        </Link>
        <h1 className="mt-6 text-3xl font-semibold tracking-tight text-slate-950">
          Terms of use
        </h1>
        <p className="mt-2 text-sm text-slate-500">Last updated 11 September 2026.</p>

        <div className="mt-8 space-y-6 text-sm leading-relaxed">
          <p>
            By using A11yFix you agree to these terms. The service scans public
            URLs, stores results for your account, and can generate suggested
            HTML fixes with a third-party model. This is a product agreement,
            not legal advice about ADA, WCAG, or Section 508 compliance.
          </p>

          <section>
            <h2 className="text-base font-semibold text-slate-950">The service</h2>
            <p className="mt-2">
              A11yFix provides automated checks and suggested code changes. It
              does not guarantee that a site is legally compliant, fully
              accessible, or free of defects. Automated rules cover only part of
              WCAG. You remain responsible for what you ship.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-950">
              Acceptable use
            </h2>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Scan only pages you are allowed to test.</li>
              <li>
                Do not use the scanner against private networks, admin panels,
                or content you are not authorized to process.
              </li>
              <li>
                Do not attempt to overload, reverse engineer, or abuse the
                service or its quotas.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-950">Accounts and billing</h2>
            <p className="mt-2">
              Free and paid plans are subject to the published scan and AI-fix
              limits. Paid subscriptions are billed through Stripe. You can
              manage or cancel billing from the customer portal while signed
              in. Fees already charged for a billing period are not refunded
              except where required by law.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-950">
              AI-generated fixes
            </h2>
            <p className="mt-2">
              Suggested fixes are starting points. Review them before merging.
              Verification with axe-core reduces false confidence but does not
              prove a change is correct for every user or every page context.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-950">Disclaimer</h2>
            <p className="mt-2">
              The service is provided “as is.” To the fullest extent permitted by
              law, A11yFix is not liable for indirect, incidental, or
              consequential damages, or for decisions you make based on scan
              results or suggested fixes. Our total liability for any claim
              relating to the service is limited to the fees you paid us in the
              three months before the claim.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-950">Contact</h2>
            <p className="mt-2">
              Questions about these terms or Pro support:{" "}
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="font-medium text-sky-800 underline underline-offset-4"
              >
                {SUPPORT_EMAIL}
              </a>
              . We aim to reply within one business day (Japan Standard Time).
            </p>
          </section>
        </div>
      </div>
    </main>
  )
}
