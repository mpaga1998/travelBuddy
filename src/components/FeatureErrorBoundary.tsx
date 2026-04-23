import { Component, type ErrorInfo, type ReactNode } from 'react';

/**
 * Feature-level error boundary.
 *
 * Wrap the root of each top-level feature (Map, Itinerary, Profile, ...) so a
 * render/render-effect crash in one feature doesn't blank the entire app.
 *
 * The fallback is intentionally minimal: a message + optional "Try again" reset
 * callback. Unlike a global boundary, this is meant to degrade gracefully,
 * leaving the rest of the shell (navigation, other modals) usable.
 *
 * Errors are logged to console + any provided `onError` sink (e.g. Sentry).
 */
interface Props {
  /** Short label shown in the fallback, e.g. "Map", "Itinerary". */
  featureName: string;
  /** Render children normally; fallback replaces them on error. */
  children: ReactNode;
  /** Optional error sink (analytics / Sentry / etc.). */
  onError?: (error: Error, info: ErrorInfo) => void;
  /**
   * Optional custom fallback. Receives the error and a reset() callback that
   * clears the boundary so children re-render on the next try.
   */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

export class FeatureErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Keep the console trail — devtools breakpoint on console.error still works.
    console.error(
      `[FeatureErrorBoundary:${this.props.featureName}] caught:`,
      error,
      info.componentStack,
    );
    this.props.onError?.(error, info);
  }

  private reset = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    const { error } = this.state;
    const { children, featureName, fallback } = this.props;

    if (!error) return children;

    if (fallback) return fallback(error, this.reset);

    return (
      <div
        role="alert"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          padding: 24,
          minHeight: 200,
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 36 }}>⚠️</div>
        <div style={{ fontSize: 16, fontWeight: 600, color: '#0f172a' }}>
          Something went wrong in {featureName}.
        </div>
        <div style={{ maxWidth: 440, fontSize: 14, color: '#475569' }}>
          The rest of the app is still usable. You can try again — if the
          problem keeps happening, refresh the page.
        </div>
        {import.meta.env.DEV && (
          <pre
            style={{
              marginTop: 8,
              maxWidth: 440,
              overflow: 'auto',
              borderRadius: 6,
              background: '#f1f5f9',
              padding: 12,
              textAlign: 'left',
              fontSize: 12,
              color: '#334155',
            }}
          >
            {error.message}
          </pre>
        )}
        <button
          type="button"
          onClick={this.reset}
          style={{
            marginTop: 8,
            borderRadius: 8,
            border: 'none',
            background: '#0284c7',
            color: 'white',
            padding: '8px 16px',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
      </div>
    );
  }
}
