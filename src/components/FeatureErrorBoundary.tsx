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
        className="flex flex-col items-center justify-center gap-3 p-6 min-h-[200px] text-center"
      >
        <div className="text-4xl">⚠️</div>
        <div className="text-base font-semibold text-slate-900">
          Something went wrong in {featureName}.
        </div>
        <div className="max-w-[440px] text-sm text-slate-600">
          The rest of the app is still usable. You can try again — if the
          problem keeps happening, refresh the page.
        </div>
        {import.meta.env.DEV && (
          <pre className="mt-2 max-w-[440px] overflow-auto rounded-md bg-slate-100 p-3 text-left text-xs text-slate-700">
            {error.message}
          </pre>
        )}
        <button
          type="button"
          onClick={this.reset}
          className="mt-2 rounded-lg border-none bg-sky-600 text-white px-4 py-2 text-sm font-semibold cursor-pointer"
        >
          Try again
        </button>
      </div>
    );
  }
}
