/**
 * B1.1: Social metadata fetcher — Tier 1 (oEmbed only).
 *
 * Given a public social URL, extracts the caption / title text that gets fed
 * into the LLM place extractor. All fetches are user-initiated, single-URL
 * requests in line with nook's B0.1 ToS policy — no bulk scraping, no video
 * download, no cookie-based auth.
 *
 * Platform support:
 *   TikTok   — public oEmbed endpoint, no auth required
 *   Pinterest — public oEmbed endpoint, no auth required
 *   Instagram — graceful error: Meta locked oEmbed behind Business-Manager
 *               approval in 2020; document the gap, don't silently fail
 *
 * Attribution fields (author, sourceUrl) are always returned and must be
 * stored / displayed whenever a place is saved from a social post.
 */

export type SocialPlatform = 'tiktok' | 'pinterest' | 'instagram' | 'unknown';

export interface SocialMetadata {
  platform: SocialPlatform;
  /** Caption / title text to feed into the place extractor. */
  caption: string;
  /** Creator display name — required for attribution. */
  author?: string;
  /** Thumbnail URL for the confirmation card UI. */
  thumbnailUrl?: string;
  /** Original URL supplied by the user — always stored for attribution. */
  sourceUrl: string;
}

/** Platform is reachable but requires credentials we don't have (Instagram). */
export class PlatformUnavailableError extends Error {
  constructor(public readonly platform: SocialPlatform, reason: string) {
    super(reason);
    this.name = 'PlatformUnavailableError';
  }
}

/** Host doesn't match any supported platform. */
export class UnsupportedPlatformError extends Error {
  constructor(host: string) {
    super(
      `"${host}" isn't a supported platform. Paste a TikTok or Pinterest URL.`
    );
    this.name = 'UnsupportedPlatformError';
  }
}

const FETCH_TIMEOUT_MS = 4000;

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function fetchWithTimeout(
  url: string,
  init?: RequestInit
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function detectPlatform(url: string): SocialPlatform {
  try {
    const { hostname } = new URL(url);
    if (hostname.includes('tiktok.com')) return 'tiktok';
    if (hostname.includes('pinterest.') || hostname === 'pin.it') return 'pinterest';
    if (hostname.includes('instagram.com') || hostname === 'instagr.am') return 'instagram';
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

// ─── Platform fetchers ────────────────────────────────────────────────────────

async function fetchTikTok(url: string): Promise<SocialMetadata> {
  const endpoint = `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`;
  const res = await fetchWithTimeout(endpoint, {
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) {
    throw new Error(`TikTok oEmbed returned ${res.status} — video may be private`);
  }

  const data = (await res.json()) as {
    title?: string;
    author_name?: string;
    thumbnail_url?: string;
  };

  return {
    platform: 'tiktok',
    caption: data.title?.trim() ?? '',
    author: data.author_name,
    thumbnailUrl: data.thumbnail_url,
    sourceUrl: url,
  };
}

async function fetchPinterest(url: string): Promise<SocialMetadata> {
  // Pinterest's public oEmbed resolves short pin.it redirects automatically.
  const endpoint = `https://www.pinterest.com/oembed/?url=${encodeURIComponent(url)}`;
  const res = await fetchWithTimeout(endpoint, {
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) {
    throw new Error(`Pinterest oEmbed returned ${res.status} — pin may be private`);
  }

  const data = (await res.json()) as {
    title?: string;
    description?: string;
    author_name?: string;
    thumbnail_url?: string;
  };

  // Join title + description so the extractor has as much context as possible.
  const caption = [data.title, data.description]
    .map((s) => s?.trim())
    .filter(Boolean)
    .join('. ');

  return {
    platform: 'pinterest',
    caption,
    author: data.author_name,
    thumbnailUrl: data.thumbnail_url,
    sourceUrl: url,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch text content from a public social-post URL (Tier 1: oEmbed only).
 *
 * Throws:
 *   PlatformUnavailableError — Instagram (no Meta app token)
 *   UnsupportedPlatformError — unrecognised host
 *   Error                    — network / API failure
 */
export async function fetchSocialMetadata(url: string): Promise<SocialMetadata> {
  const platform = detectPlatform(url);

  switch (platform) {
    case 'tiktok':
      return fetchTikTok(url);

    case 'pinterest':
      return fetchPinterest(url);

    case 'instagram':
      throw new PlatformUnavailableError(
        'instagram',
        'Instagram requires a Meta API token that nook doesn\'t have yet. ' +
        'Paste a TikTok or Pinterest link instead — Instagram support is coming.'
      );

    default:
      throw new UnsupportedPlatformError(
        (() => { try { return new URL(url).hostname; } catch { return url; } })()
      );
  }
}
