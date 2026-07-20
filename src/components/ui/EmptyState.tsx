import { Button } from './Button';

/** B2: the one empty state — replaces six per-surface implementations. */
export interface EmptyStateProps {
  /** Emoji or short glyph shown large. */
  icon: string;
  title: string;
  hint?: string;
  action?: { label: string; onClick: () => void };
  className?: string;
}

export function EmptyState({ icon, title, hint, action, className = '' }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 p-8 text-center ${className}`}>
      <div className="text-4xl" aria-hidden>{icon}</div>
      <p className="text-sm font-semibold text-ink m-0">{title}</p>
      {hint && <p className="text-xs text-muted m-0 max-w-[320px] leading-relaxed">{hint}</p>}
      {action && (
        <Button variant="primary" size="md" onClick={action.onClick} className="mt-1">
          {action.label}
        </Button>
      )}
    </div>
  );
}
