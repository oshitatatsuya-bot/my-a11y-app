import { NextRequest, NextResponse } from 'next/server';
import { APICallError, RetryError, generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

import { BrowserBusyError } from '@/lib/browser';
import { planLimits } from '@/lib/plans';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { currentPeriodStart } from '@/lib/usage';
import { verifyFix, type Verification } from '@/lib/verify-fix';

// The model call regularly takes longer than the 10s platform default.
export const maxDuration = 60;

const MAX_HTML_LENGTH = 4000;

const fixSchema = z.object({
  fixedCode: z
    .string()
    .describe('The corrected HTML snippet, with no markdown fences'),
  explanation: z
    .string()
    .describe('A concise explanation of the fix, written in English'),
});

const SYSTEM_PROMPT = `You are a Web Accessibility (WCAG 2.2 AA) expert.
You rewrite inaccessible HTML so that it satisfies WCAG success criteria.
Rules:
- Preserve the original markup, content and class names; change only what accessibility requires.
- Remove the barrier itself. Never settle on a value that stops an automated
  checker from reporting the rule while the barrier remains for the user; a
  timed refresh moved just past a threshold is not a fix.
- When the accessible outcome is to drop the offending markup or attribute,
  drop it instead of keeping a nominal version of it.
- Never invent visible text. If a name is required and none can be derived, use a clearly marked placeholder.
- Return the snippet only, without surrounding document structure or markdown fences.`;

/**
 * A schema-constrained call is used instead of parsing free-form text, which
 * breaks whenever the model wraps its answer in markdown or the snippet itself
 * contains quotes.
 */
async function generateFix(prompt: string) {
  const { object } = await generateObject({
    model: openai('gpt-4o'),
    // Someone is waiting on this response, and the failures worth retrying
    // rarely clear within one attempt. The default of two took 27s to report
    // an exhausted credit balance, which no number of retries would fix.
    maxRetries: 1,
    schema: fixSchema,
    system: SYSTEM_PROMPT,
    prompt,
  });

  return object;
}

/**
 * A fix that cannot be checked is still worth showing, so anything that stops
 * the check — a busy browser pool, a missing local Chrome — downgrades to
 * `not-verifiable` rather than failing the request.
 */
async function verify(
  ruleId: unknown,
  originalHtml: string,
  fixedHtml: string
): Promise<Verification> {
  if (typeof ruleId !== 'string' || !ruleId) {
    return 'not-verifiable';
  }

  try {
    return await verifyFix({ ruleId, originalHtml, fixedHtml });
  } catch (error) {
    if (!(error instanceof BrowserBusyError)) {
      console.error('Fix verification failed:', error);
    }

    return 'not-verifiable';
  }
}

/**
 * Retryable failures are re-thrown wrapped in a `RetryError`, so the
 * provider's own response — the only place that says what actually went
 * wrong — is reachable only through the wrapper.
 */
function providerError(error: unknown) {
  if (RetryError.isInstance(error)) {
    return APICallError.isInstance(error.lastError) ? error.lastError : undefined;
  }

  return APICallError.isInstance(error) ? error : undefined;
}

export async function POST(req: NextRequest) {
  // Each call spends OpenAI credits, so it is gated the same way as scanning.
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: 'Sign in to generate fixes', code: 'AUTH_REQUIRED' },
      { status: 401 }
    );
  }

  try {
    const { html, failureSummary, description, help, ruleId } = await req.json();

    if (!html || typeof html !== 'string') {
      return NextResponse.json({ error: 'HTML snippet is required' }, { status: 400 });
    }

    if (html.length > MAX_HTML_LENGTH) {
      return NextResponse.json(
        { error: `HTML snippet must be ${MAX_HTML_LENGTH} characters or fewer` },
        { status: 413 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'AI fixes are unavailable: OPENAI_API_KEY is not configured' },
        { status: 503 }
      );
    }

    const periodStart = currentPeriodStart();
    const [{ data: profile }, { count: fixesUsed, error: countError }] =
      await Promise.all([
        supabase.from('profiles').select('plan').eq('id', user.id).maybeSingle(),
        supabase
          .from('ai_fixes')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .gte('created_at', periodStart),
      ]);

    if (countError) {
      console.error('AI fix quota check failed:', countError);
      return NextResponse.json(
        {
          error:
            'AI fix quota could not be checked. Apply the ai_fixes migration and retry.',
        },
        { status: 503 }
      );
    }

    const limits = planLimits(profile?.plan);
    const used = fixesUsed ?? 0;
    if (used >= limits.fixesPerMonth) {
      return NextResponse.json(
        {
          error: `Your ${limits.label} plan allows ${limits.fixesPerMonth} AI fixes per month. Upgrade to keep generating fixes.`,
          code: 'FIX_QUOTA_EXCEEDED',
          usage: { fixesUsed: used, fixesLimit: limits.fixesPerMonth },
        },
        { status: 429 }
      );
    }

    const basePrompt = [
      `Rule: ${help || description || 'N/A'}`,
      `Why it fails: ${failureSummary || 'N/A'}`,
      '',
      'Inaccessible HTML:',
      html,
    ].join('\n');

    let fix = await generateFix(basePrompt);
    let verification = await verify(ruleId, html, fix.fixedCode);

    // Telling the model exactly which rule its answer still trips is far more
    // useful than asking it to try again, so it gets one such attempt.
    if (verification === 'unverified') {
      fix = await generateFix(
        [
          basePrompt,
          '',
          'A previous attempt produced the snippet below, and axe-core still',
          `reports the ${ruleId} rule against it. Do not repeat that approach.`,
          '',
          fix.fixedCode,
        ].join('\n')
      );

      verification = await verify(ruleId, html, fix.fixedCode);
    }

    const { error: recordError } = await supabase.from('ai_fixes').insert({
      user_id: user.id,
      rule_id: typeof ruleId === 'string' ? ruleId : null,
    });

    if (recordError) {
      console.error('AI fix could not be recorded:', recordError);
    }

    return NextResponse.json({
      originalCode: html,
      fixedCode: fix.fixedCode,
      explanation: fix.explanation,
      verification,
    });
  } catch (error) {
    console.error('Fix API error:', error);

    // A rejected key or an empty balance is an operator problem, not a model
    // failure, and saying so is the difference between a five minute fix and a
    // debugging session.
    const apiError = providerError(error);

    if (apiError) {
      const body =
        typeof apiError.responseBody === 'string' ? apiError.responseBody : '';

      // Reported as 429 like a rate limit, but no amount of waiting fixes it.
      if (
        body.includes('insufficient_quota') ||
        body.includes('credit_balance_exhausted')
      ) {
        return NextResponse.json(
          {
            error:
              'AI fixes are unavailable: the OpenAI account has no credits remaining.',
          },
          { status: 503 }
        );
      }

      if (apiError.statusCode === 401 || apiError.statusCode === 403) {
        return NextResponse.json(
          {
            error:
              'AI fixes are unavailable: the OpenAI API key was rejected. Check OPENAI_API_KEY.',
          },
          { status: 503 }
        );
      }

      if (apiError.statusCode === 429) {
        return NextResponse.json(
          { error: 'The AI service is rate limited. Please retry in a moment.' },
          { status: 429 }
        );
      }
    }

    return NextResponse.json(
      {
        error: 'Failed to generate fix',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
