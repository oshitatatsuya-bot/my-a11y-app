import { NextRequest, NextResponse } from 'next/server';
import { APICallError, RetryError, generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

import { createSupabaseServerClient } from '@/lib/supabase/server';

// The model call regularly takes longer than the 10s platform default.
export const maxDuration = 60;

const MAX_HTML_LENGTH = 4000;

const fixSchema = z.object({
  fixedCode: z
    .string()
    .describe('The corrected HTML snippet, with no markdown fences'),
  explanation: z
    .string()
    .describe('A concise explanation of the fix, written in Japanese'),
});

const SYSTEM_PROMPT = `You are a Web Accessibility (WCAG 2.2 AA) expert.
You rewrite inaccessible HTML so that it satisfies WCAG success criteria.
Rules:
- Preserve the original markup, content and class names; change only what accessibility requires.
- Never invent visible text. If a name is required and none can be derived, use a clearly marked placeholder.
- Return the snippet only, without surrounding document structure or markdown fences.`;

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
    const { html, failureSummary, description, help } = await req.json();

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

    // A schema-constrained call is used instead of parsing free-form text,
    // which breaks whenever the model wraps its answer in markdown or the
    // snippet itself contains quotes.
    const { object } = await generateObject({
      model: openai('gpt-4o'),
      // Someone is waiting on this response, and the failures worth retrying
      // rarely clear within one attempt. The default of two took 27s to report
      // an exhausted credit balance, which no number of retries would fix.
      maxRetries: 1,
      schema: fixSchema,
      system: SYSTEM_PROMPT,
      prompt: [
        `Rule: ${help || description || 'N/A'}`,
        `Why it fails: ${failureSummary || 'N/A'}`,
        '',
        'Inaccessible HTML:',
        html,
      ].join('\n'),
    });

    return NextResponse.json({
      originalCode: html,
      fixedCode: object.fixedCode,
      explanation: object.explanation,
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
