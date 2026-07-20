/** B2: avatar with initial fallback — replaces three ad-hoc implementations. */
export interface AvatarProps {
  src?: string | null;
  /** Used for the alt text and the fallback initial. */
  name?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE: Record<NonNullable<AvatarProps['size']>, string> = {
  sm: 'w-8 h-8 text-sm',
  md: 'w-12 h-12 text-lg',
  lg: 'w-24 h-24 text-3xl',
};

export function Avatar({ src, name, size = 'md', className = '' }: AvatarProps) {
  const shared = `${SIZE[size]} rounded-full shrink-0 ${className}`;
  if (src) {
    return (
      <img
        src={src}
        alt={name ?? 'avatar'}
        loading="lazy"
        decoding="async"
        className={`${shared} object-cover`}
      />
    );
  }
  return (
    <div
      aria-hidden
      className={`${shared} bg-brand-100 text-brand-700 font-bold flex items-center justify-center select-none`}
    >
      {(name ?? '?').trim().charAt(0).toUpperCase() || '?'}
    </div>
  );
}
