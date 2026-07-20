import { forwardRef } from 'react';
import type {
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';

/**
 * B2: the one field style — replaces draftInputClass and the half-dozen
 * per-file input class strings. forwardRef because several call sites focus
 * or select programmatically (PromptDialog, draft modals).
 */
export const fieldClass =
  'w-full box-border px-3 py-2.5 rounded-field border border-black/[0.18] bg-surface text-sm text-ink min-h-[44px] ' +
  'focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className = '', ...rest }, ref) {
    return <input ref={ref} className={`${fieldClass} ${className}`} {...rest} />;
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className = '', ...rest }, ref) {
    return <textarea ref={ref} className={`${fieldClass} font-[inherit] ${className}`} {...rest} />;
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className = '', ...rest }, ref) {
    return <select ref={ref} className={`${fieldClass} ${className}`} {...rest} />;
  },
);
