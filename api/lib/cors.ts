import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Apply CORS headers to a response.
 *
 * Origin policy:
 * - If ALLOWED_ORIGINS is set (comma-separated list), only requests whose
 *   Origin header matches an entry in the list receive that origin reflected
 *   back. All other origins get no Access-Control-Allow-Origin header, so
 *   the browser rejects the preflight.
 * - If ALLOWED_ORIGINS is not set (local dev), falls back to '*' so
 *   localhost works without any .env entry.
 *
 * Usage — call once at the top of every handler, before any other logic:
 *
 *   applyCors(req, res, { methods: 'POST, OPTIONS' });
 *   if (req.method === 'OPTIONS') { res.status(200).end(); return; }
 */
export function applyCors(
  req: VercelRequest,
  res: VercelResponse,
  options: {
    methods?: string;
    headers?: string;
  } = {}
): void {
  const {
    methods = 'GET,OPTIONS,PATCH,DELETE,POST,PUT',
    headers = 'Authorization, X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version',
  } = options;

  const rawOrigins = process.env.ALLOWED_ORIGINS;

  if (rawOrigins) {
    const allowlist = rawOrigins.split(',').map((o) => o.trim()).filter(Boolean);
    const requestOrigin = req.headers.origin as string | undefined;

    if (requestOrigin && allowlist.includes(requestOrigin)) {
      res.setHeader('Access-Control-Allow-Origin', requestOrigin);
      // Vary tells CDNs/proxies that the response differs per origin
      res.setHeader('Vary', 'Origin');
    }
    // No header set for unlisted origins → browser rejects the request
  } else {
    // ALLOWED_ORIGINS not configured — open wildcard (local dev only)
    res.setHeader('Access-Control-Allow-Origin', '*');
  }

  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', methods);
  res.setHeader('Access-Control-Allow-Headers', headers);
}
