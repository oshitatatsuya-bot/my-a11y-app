import { NextRequest } from 'next/server';

import { scoreColor } from '@/lib/a11y';
import { createAnonClient } from '@/lib/supabase/anon';

const LABEL = 'WCAG 2.2 AA';
const CHAR_WIDTH = 6.5;
const PADDING = 10;

function escapeXml(value: string) {
  return value.replace(/[<>&'"]/g, (char) => {
    switch (char) {
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '&':
        return '&amp;';
      case "'":
        return '&apos;';
      default:
        return '&quot;';
    }
  });
}

function renderBadge(value: string, color: string) {
  const labelWidth = Math.round(LABEL.length * CHAR_WIDTH) + PADDING * 2;
  const valueWidth = Math.round(value.length * CHAR_WIDTH) + PADDING * 2;
  const width = labelWidth + valueWidth;
  const label = escapeXml(LABEL);
  const text = escapeXml(value);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="20" role="img" aria-label="${label}: ${text}">
  <title>${label}: ${text}</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#fff" stop-opacity=".7"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r"><rect width="${width}" height="20" rx="3" fill="#fff"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="${labelWidth}" height="20" fill="#1e293b"/>
    <rect x="${labelWidth}" width="${valueWidth}" height="20" fill="${color}"/>
    <rect width="${width}" height="20" fill="url(#s)" opacity=".1"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">
    <text x="${labelWidth / 2}" y="14">${label}</text>
    <text x="${labelWidth + valueWidth / 2}" y="14">${text}</text>
  </g>
</svg>`;
}

function svgResponse(body: string, maxAge: number) {
  return new Response(body, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': `public, max-age=${maxAge}, s-maxage=${maxAge}, stale-while-revalidate=86400`,
    },
  });
}

/**
 * Embeddable compliance badge, addressed by an unguessable per-host token so
 * that embedding it does not let anyone enumerate other customers' hosts or
 * scores. It always reflects the owner's most recent scan of that host.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')?.trim();

  if (!token) {
    return svgResponse(renderBadge('no token', '#64748b'), 60);
  }

  try {
    const { data, error } = await createAnonClient()
      .rpc('badge_by_token', { badge_token: token })
      .maybeSingle<{ host: string; score: number; scanned_at: string }>();

    if (error) {
      console.error('Badge lookup failed:', error.message);
      return svgResponse(renderBadge('unavailable', '#64748b'), 60);
    }

    if (!data) {
      return svgResponse(renderBadge('not scanned', '#64748b'), 300);
    }

    const score = Number(data.score);
    return svgResponse(renderBadge(`${score} / 100`, scoreColor(score)), 300);
  } catch (error) {
    console.error('Badge lookup failed:', error);
    return svgResponse(renderBadge('unavailable', '#64748b'), 60);
  }
}
