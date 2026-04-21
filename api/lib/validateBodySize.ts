import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Hard cap on accepted request body size.
 * Itinerary payloads are ~1-5 KB in practice; 100 KB leaves plenty of headroom
 * but makes "paste a 10 MB string to burn OpenAI tokens" attacks cheap to reject.
 *
 * If you find yourself hitting this in normal use, revisit the client — don't
 * bump the cap blindly.
 */
export const MAX_BODY_BYTES = 100 * 1024; // 100 KB

/**
 * Reject oversized request bodies before any expensive work (JSON parse, DB call,
 * OpenAI call) happens.
 *
 * Strategy:
 *   1. Trust the Content-Length header if present and > limit → 413.
 *   2. If Vercel has already parsed `req.body`, re-serialize and measure. This
 *      catches Transfer-Encoding: chunked uploads that have no Content-Length,
 *      and payloads that lied about their size.
 *
 * On rejection, writes a 413 to `res` and returns `false`. Handlers MUST check
 * the boolean and bail — same contract as `requireAuth`.
 *
 * Usage:
 *   if (!validateBodySize(req, res)) return;
 */
export function validateBodySize(
  req: VercelRequest,
  res: VercelResponse,
  maxBytes: number = MAX_BODY_BYTES
): boolean {
  // 1) Fast path: honour Content-Length if it's present and parseable.
  const contentLengthRaw = req.headers['content-length'];
  const contentLengthStr = Array.isArray(contentLengthRaw) ? contentLengthRaw[0] : contentLengthRaw;
  if (contentLengthStr) {
    const contentLength = Number.parseInt(contentLengthStr, 10);
    if (Number.isFinite(contentLength) && contentLength > maxBytes) {
      console.warn(
        `📦 [SIZE] Rejecting oversized request: Content-Length=${contentLength}B > ${maxBytes}B on ${req.method} ${req.url}`
      );
      res.status(413).json({
        success: false,
        error: `Request body too large. Max ${maxBytes} bytes.`,
      });
      return false;
    }
  }

  // 2) Slow path: measure the parsed body. Handles chunked uploads and lying clients.
  //    Vercel has already JSON-parsed req.body by the time this runs for POST/JSON.
  if (req.body !== undefined && req.body !== null) {
    try {
      const serialized =
        typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      const byteLength = Buffer.byteLength(serialized, 'utf8');
      if (byteLength > maxBytes) {
        console.warn(
          `📦 [SIZE] Rejecting oversized parsed body: ${byteLength}B > ${maxBytes}B on ${req.method} ${req.url}`
        );
        res.status(413).json({
          success: false,
          error: `Request body too large. Max ${maxBytes} bytes.`,
        });
        return false;
      }
    } catch {
      // If we can't measure, let it through — the handler's own validation will
      // catch malformed bodies. Don't false-positive on exotic payloads.
    }
  }

  return true;
}
