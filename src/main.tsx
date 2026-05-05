import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import { Analytics } from '@vercel/analytics/react'
import './index.css'
import App from './App.tsx'
import "mapbox-gl/dist/mapbox-gl.css";

const _sentryDsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
if (_sentryDsn) {
  Sentry.init({
    dsn: _sentryDsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,

    // Drop known-noise sources before they leave the browser. Saves event
    // quota and stops the on-call email storm. Add patterns here as new
    // false-positive classes show up in the dashboard.
    denyUrls: [
      // Vercel preview-deploy Toolbar / Live Feedback injection.
      // Errors thrown inside this script aren't ours — Vercel's
      // collaboration toolbar tries Array.from() on undefined, etc.,
      // particularly on niche browsers (Ecosia Android).
      /\/_next-live\/feedback\//,
      /vercel\.live/,
      // Browser extensions inject scripts that often throw inside our
      // event handlers. Anything from chrome-extension:// or
      // moz-extension:// is not our code.
      /^chrome-extension:\/\//,
      /^moz-extension:\/\//,
      /^safari-extension:\/\//,
    ],
    ignoreErrors: [
      // The specific Vercel-toolbar bubble-through we caught on
      // 2026-05-05. Defensive — should already be filtered by denyUrls.
      /undefined is not iterable.*Symbol\.iterator/,
      // ResizeObserver noise — fires on layout thrash, never actionable.
      /ResizeObserver loop limit exceeded/,
      /ResizeObserver loop completed with undelivered notifications/,
      // Generic unhandled-promise wrapper from third-party scripts.
      /Non-Error promise rejection captured/,
    ],
  });
} else {
  console.info('[Sentry] VITE_SENTRY_DSN not set — error tracking disabled.');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <Analytics />
  </StrictMode>,
)
