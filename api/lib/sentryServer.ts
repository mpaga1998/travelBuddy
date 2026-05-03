import * as Sentry from '@sentry/node';

/**
 * Initialise Sentry for the Vercel serverless backend.
 *
 * Called at module load time — the conditional means this file is safe to
 * import in every handler regardless of whether a DSN is configured.
 * When SENTRY_DSN is absent (local dev, forks, CI) the module is a no-op
 * and captureApiError returns immediately without logging anything.
 */
const _dsn = process.env.SENTRY_DSN;

if (_dsn) {
  Sentry.init({
    dsn: _dsn,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'production',
    tracesSampleRate: 0.1,
  });
}

/**
 * Forward an error to Sentry. Safe to call even when Sentry is disabled —
 * the function returns immediately when no DSN is configured.
 *
 * @param err  The caught value (Error or unknown).
 * @param ctx  Optional extra context object attached to the Sentry event.
 */
export function captureApiError(
  err: unknown,
  ctx?: Record<string, unknown>,
): void {
  if (!_dsn) return;
  Sentry.captureException(err, ctx ? { extra: ctx } : undefined);
}
