import type { ButtonHTMLAttributes } from 'react';

/** B2: the one button. Variants map to the B1 tokens — no raw hex, ever. */
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

const VARIANT: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary:   'bg-brand hover:bg-brand-600 text-white border-none',
  secondary: 'bg-surface hover:bg-gray-100 text-ink border border-black/[0.18]',
  ghost:     'bg-transparent hover:bg-black/[0.05] text-ink border-none',
  danger:    'bg-red-600 hover:bg-red-700 text-white border-none',
};

const SIZE: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'px-3 py-1.5 text-xs min-h-[36px]',
  md: 'px-4 py-2 text-sm min-h-[40px]',
  lg: 'px-4 py-3 text-base min-h-[44px]',
};

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`rounded-field font-semibold cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${VARIANT[variant]} ${SIZE[size]} ${className}`}
      {...rest}
    />
  );
}
