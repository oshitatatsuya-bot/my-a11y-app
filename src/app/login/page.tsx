import Link from "next/link"
import { redirect } from "next/navigation"

import { LoginForm } from "@/components/login-form"
import { safeRedirectPath } from "@/lib/site"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const metadata = {
  title: "Sign in — A11yFix",
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams
  const next = safeRedirectPath(
    typeof params.next === "string" ? params.next : undefined
  )
  const linkError = params.error === "link"

  // A one-time link is often opened twice (email client preview, then the
  // real click). The first visit creates the session; the second reports the
  // link as used. Send an already-signed-in visitor on instead of an error.
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user) {
    redirect(next)
  }

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
            That sign-in link is invalid or has already been used. Request a
            new one below. If you already signed in in another tab, open
            Scanner from the home page.
          </p>
        )}

        <LoginForm next={next} />

        <p className="mt-8 text-xs text-slate-500">
          The Free plan includes 15 page scans per month across 3 sites
          (example.com demos are free).{" "}
          <Link href="/privacy" className="underline underline-offset-2 hover:text-slate-300">
            Privacy
          </Link>
        </p>
      </div>
    </main>
  )
}
