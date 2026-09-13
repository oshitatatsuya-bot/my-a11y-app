import { NextRequest, NextResponse } from 'next/server';
import { APICallError, RetryError, generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

import { BrowserBusyError } from '@/lib/browser';
import { planLimits } from '@/lib/plans';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { currentPeriodStart } from '@/lib/usage';
import {
  verifyFixDetailed,
  type Verification,
  type VerifyDetail,
} from '@/lib/verify-fix';

export const maxDuration = 60;

const MAX_HTML_LENGTH = 4000;
/** Self-correction attempts after the first generation (total gens ≤ 1 + this). */
const MAX_CORRECTION_ROUNDS = 2;

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

async function generateFix(prompt: string) {
  const { object } = await generateObject({
    model: openai('gpt-4o'),
    maxRetries: 1,
    schema: fixSchema,
    system: SYSTEM_PROMPT,
    prompt,
  });

  return object;
}

async function verify(
  ruleId: unknown,
  originalHtml: string,
  fixedHtml: string
): Promise<VerifyDetail> {
  if (typeof ruleId !== 'string' || !ruleId) {
    return { verification: 'not-verifiable', remainingFailures: [] };
  }

  try {
    return await verifyFixDetailed({ ruleId, originalHtml, fixedHtml });
  } catch (error) {
    if (!(error instanceof BrowserBusyError)) {
      console.error('Fix verification failed:', error);
    }

    return { verification: 'not-verifiable', remainingFailures: [] };
  }
}

function providerError(error: unknown) {
  if (RetryError.isInstance(error)) {
    return APICallError.isInstance(error.lastError) ? error.lastError : undefined;
  }

  return APICallError.isInstance(error) ? error : undefined;
}

export async function POST(req: NextRequest) {
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
    let detail = await verify(ruleId, html, fix.fixedCode);
    let attempts = 1;

    // Self-correction: feed remaining axe failures back into GPT until clean
    // or we exhaust correction rounds. Only `verified` means axe reported 0
    // hits for this rule on the fixed snippet in the sandbox harness.
    while (
      detail.verification === 'unverified' &&
      attempts <= MAX_CORRECTION_ROUNDS
    ) {
      attempts += 1;
      const failureBlock =
        detail.remainingFailures.length > 0
          ? detail.remainingFailures.map((f) => `- ${f}`).join('\n')
          : `- axe-core still reports rule ${ruleId}`;

      fix = await generateFix(
        [
          basePrompt,
          '',
          `Attempt ${attempts - 1} still failed axe-core for rule ${ruleId}.`,
          'Remaining axe findings on that snippet:',
          failureBlock,
          '',
          'Do not repeat the previous approach. Produce a different fix.',
          '',
          'Previous snippet:',
          fix.fixedCode,
        ].join('\n')
      );

      detail = await verify(ruleId, html, fix.fixedCode);
    }

    const verification: Verification = detail.verification;

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
      attempts,
      remainingFailures: detail.remainingFailures,
      axeClean: verification === 'verified',
    });
  } catch (error) {
    console.error('Fix API error:', error);

    const apiError = providerError(error);

    if (apiError) {
      const body =
        typeof apiError.responseBody === 'string' ? apiError.responseBody : '';

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
