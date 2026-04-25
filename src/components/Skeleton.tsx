import type { CSSProperties, ReactNode } from 'react';

type Props = {
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
};

/**
 * Pulsing gray placeholder used in loading states.
 *
 * Renders a `<div>` with Tailwind's `animate-pulse` + a neutral gray
 * background. Size / shape is driven entirely by utility classes passed in
 * via `className` (e.g. `h-4 w-32 rounded`) so the caller can match the
 * exact layout of whatever content will replace it.
 */
export function Skeleton({ className = '', style, children }: Props) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={`animate-pulse bg-gray-200 ${className}`}
      style={style}
    >
      {children}
    </div>
  );
}
