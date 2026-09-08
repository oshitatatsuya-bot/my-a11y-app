import Link from "next/link"

export const metadata = {
  title: "Privacy — A11yFix",
  description: "How A11yFix handles emails, scan data, and AI-generated fixes.",
}

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-white text-slate-800">
      <div className="mx-auto max-w-2xl px-6 py-16">
        <Link href="/" className="text-sm font-semibold text-slate-950">
          A11yFix
        </Link>
        <h1 className="mt-6 text-3xl font-semibold tracking-tight text-slate-950">
          Privacy
        </h1>
        <p className="mt-2 text-sm text-slate-500">Last updated 8 September 2026.</p>

        <div className="mt-8 space-y-6 text-sm leading-relaxed">
          <p>
            A11yFix scans public web pages for accessibility issues and suggests
            code changes. This page describes the data that process uses. It is
            not legal advice.
          </p>

          <section>
            <h2 className="text-base font-semibold text-slate-950">What we collect</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                Work email, when you join the waitlist or sign in with a magic
                link.
              </li>
              <li>
                URLs you ask us to scan, the host, the score, and a summary of
                the violations we found.
              </li>
              <li>
                HTML snippets from failing elements, sent to OpenAI only when
                you click “Fix with AI”.
              </li>
              <li>
                A public badge token per host, so a score image can be embedded
                without signing in.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-950">Who sees it</h2>
            <p className="mt-2">
              Scan history is visible only to the signed-in account that ran
              the scan. Badge images are public to anyone with the token.
              OpenAI receives the snippet you chose to fix, not your account
              email. We do not sell this data.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-950">How long we keep it</h2>
            <p className="mt-2">
              Waitlist emails stay until you ask to be removed. Account data,
              scans, and badges stay until you ask us to delete the account.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-950">Requests</h2>
            <p className="mt-2">
              To access or delete your data, sign in and write from the same
              email address. Do not send us pages that contain secrets, private
              networks, or personal data you are not allowed to process.
            </p>
          </section>
        </div>
      </div>
    </main>
  )
}
