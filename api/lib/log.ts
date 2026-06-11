/**
 * Structured logger for all API routes.
 *
 * Usage — in a request handler:
 *   const log = createLogger(req);
 *   log.info({ userId }, 'Processing request');
 *
 * Usage — in a lib utility (no request context):
 *   import { logger } from './log.js';
 *   logger.warn({ error }, 'Something went wrong');
 *
 * Every log line is JSON. Handler-scoped loggers include `requestId`
 * (taken from x-vercel-id or a generated UUID) in every line.
 */

import pino from 'pino';
import type { VercelRequest } from '@vercel/node';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  // In production Vercel writes stdout straight to log aggregation —
  // plain JSON is correct. pino-pretty can be added locally via
  // LOG_LEVEL=debug and a dev script if desired.
  base: { service: 'nook-api' },
  timestamp: pino.stdTimeFunctions.isoTime,
});

/**
 * Create a child logger bound to a specific request.
 * Attaches `requestId` (x-vercel-id header or crypto UUID) to every line.
 */
export function createLogger(req: VercelRequest): pino.Logger {
  const requestId =
    (req.headers['x-vercel-id'] as string | undefined) ??
    crypto.randomUUID();

  return logger.child({ requestId });
}
