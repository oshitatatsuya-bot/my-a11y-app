import { redirect } from 'next/navigation';
import type { NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';

import { safeRedirectPath } from '@/lib/site';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Accepts both shapes of Supabase sign-in link:
 *
 * - `?code=...` comes from the built-in email templates, which cannot be
 *   edited without custom SMTP. They point at Supabase's own `/auth/v1/verify`
 *   endpoint, which redirects back here with a PKCE authorization code.
 * - `?token_hash=...&type=...` comes from a customised template that links
 *   here directly, skipping the extra round trip.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const next = safeRedirectPath(searchParams.get('next'));
  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;

  // How Supabase reports an expired or already-used link.
  const rejected = searchParams.get('error_description') ?? searchParams.get('error');
  if (rejected) {
    console.error('Sign-in link rejected by Supabase:', rejected);
    redirect('/login?error=link');
  }

  const supabase = await createSupabaseServerClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error('Code exchange failed:', error.message);
      redirect('/login?error=link');
    }

    redirect(next);
  }

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });

    if (error) {
      console.error('Magic link verification failed:', error.message);
      redirect('/login?error=link');
    }

    redirect(next);
  }

  console.error('Sign-in link carried no credentials:', searchParams.toString());
  redirect('/login?error=link');
}
