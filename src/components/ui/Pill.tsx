import type { ButtonHTMLAttributes, HTMLAttributes } from 'react';

/**
 * B2: pills — three shapes the app repeats everywhere.
 *   filter — toggleable chip (category filters, list filters); renders a button
 *   badge  — small static label (status, attribution, category tags)
 *   count  — circular numeric badge (unread counts, saved-places count)
 */

export interface FilterPillProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
}

export function FilterPill({ active = false, className = '', ...rest }: FilterPillProps) {
  return (
    <button
      type="button"
      className={`px-3 py-1.5 rounded-full text-xs font-semibold border cursor-pointer transition-colors ${
        active
          ? 'bg-brand border-brand text-white'
          : 'bg-surface border-black/[0.18] text-slate-600 hover:bg-gray-50'
      } ${className}`}
      {...rest}
    />
  );
}

export function BadgePill({ className = '', ...rest }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${className}`}
      {...rest}
    />
  );
}

export function CountPill({ className = '', ...rest }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={`min-w-[24px] h-6 px-1.5 rounded-full bg-brand text-white text-xs font-bold flex items-center justify-center ${className}`}
      {...rest}
    />
  );
}
