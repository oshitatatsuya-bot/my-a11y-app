import { redirect } from 'next/navigation';
import type { NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';

import { safeRedirectPath } from '@/lib/site';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const next = safeRedirectPath(searchParams.get('next'));

  if (!tokenHash || !type) {
    redirect('/login?error=link');
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });

  if (error) {
    console.error('Magic link verification failed:', error.message);
    redirect('/login?error=link');
  }

  redirect(next);
}
