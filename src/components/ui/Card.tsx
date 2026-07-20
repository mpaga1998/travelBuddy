import type { HTMLAttributes } from 'react';

/** B2: standard content card. Interactive when onClick is passed. */
export function Card({
  className = '',
  onClick,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  const interactive = onClick
    ? 'cursor-pointer transition-all hover:shadow-modal touch-manipulation'
    : '';
  return (
    <div
      onClick={onClick}
      {...(onClick ? { role: 'button', tabIndex: 0 } : {})}
      className={`rounded-card border border-black/[0.08] bg-surface shadow-card overflow-hidden ${interactive} ${className}`}
      {...rest}
    />
  );
}
