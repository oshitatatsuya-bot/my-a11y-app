import Link from "next/link"

import { LoginForm } from "@/components/login-form"
import { safeRedirectPath } from "@/lib/site"

export const metadata = {
  title: "Sign in — A11yFix",
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams
  const next = safeRedirectPath(
    typeof params.next === "string" ? params.next : undefined
  )
  const linkError = params.error === "link"

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 py-16 text-slate-50">
      <div className="w-full max-w-md">
        <Link href="/" className="text-sm font-semibold tracking-tight text-white">
          A11yFix
        </Link>
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">
          Sign in to run a scan
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          We email you a one-time link, so there is no password to manage. A new
          account is created automatically on first sign-in.
        </p>

        {linkError && (
          <p
            role="alert"
            className="mt-6 rounded-lg border border-red-800 bg-red-950/50 p-3 text-sm text-red-300"
          >
            That sign-in link is invalid or has expired. Request a new one below.
          </p>
        )}

        <LoginForm next={next} />

        <p className="mt-8 text-xs text-slate-500">
          The Free plan includes 5 scans per month on one site.
        </p>
      </div>
    </main>
  )
}
