/**
 * Shared Tailwind class strings for the profile modal's tabbed subcomponents.
 *
 * Extracted in 2.4 when profileModal.tsx was split into ProfileInfoTab,
 * BookmarkedPinsTab, and SavedItinerariesTab. Migrated to Tailwind classes in
 * 2.5 — callsites use className={inputClass} / className={primaryBtn(saving)}.
 */

export const inputClass =
  'w-full px-3.5 py-3 rounded-lg border border-black/20 outline-none text-slate-900 bg-white min-h-[44px]';

export const smallBtn =
  'px-3.5 py-2.5 rounded-lg border border-black/[0.18] bg-white text-slate-900 cursor-pointer font-extrabold min-h-[44px]';

export function primaryBtn(disabled: boolean): string {
  return [
    'px-4 py-3 rounded-lg border-none text-white font-black min-h-[44px] w-full',
    disabled ? 'bg-black/25 cursor-not-allowed' : 'bg-slate-900 cursor-pointer',
  ].join(' ');
}

export const dangerBtn =
  'px-4 py-3 rounded-lg border border-red-600/35 bg-red-600/10 text-red-900 cursor-pointer font-black min-h-[44px] w-full';

/** Alias for migration compatibility; prefer `inputClass`. */
export const inputStyle = inputClass;
