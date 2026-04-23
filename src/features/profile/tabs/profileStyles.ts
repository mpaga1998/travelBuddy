/**
 * Shared style tokens for the profile modal's tabbed subcomponents.
 *
 * Extracted in 2.4 when profileModal.tsx was split into ProfileInfoTab,
 * BookmarkedPinsTab, and SavedItinerariesTab. Kept as plain CSSProperties
 * rather than Tailwind classes so the tabs render correctly before Phase 2.5's
 * Tailwind migration lands.
 */
import type { CSSProperties } from 'react';

export const inputStyle: CSSProperties = {
  padding: '12px 14px',
  borderRadius: 10,
  border: '1px solid rgba(0,0,0,0.2)',
  outline: 'none',
  color: '#111',
  background: 'white',
  minHeight: 44,
};

export const smallBtn: CSSProperties = {
  padding: '10px 14px',
  borderRadius: 10,
  border: '1px solid rgba(0,0,0,0.18)',
  background: 'white',
  color: '#111',
  cursor: 'pointer',
  fontWeight: 800,
  minHeight: 44,
};

export function primaryBtn(disabled: boolean): CSSProperties {
  return {
    padding: '12px 16px',
    borderRadius: 10,
    border: 'none',
    background: disabled ? 'rgba(0,0,0,0.25)' : '#111',
    color: 'white',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontWeight: 900,
    minHeight: 44,
    width: '100%',
  };
}

export const dangerBtn: CSSProperties = {
  padding: '12px 16px',
  borderRadius: 10,
  border: '1px solid rgba(220,38,38,0.35)',
  background: 'rgba(220,38,38,0.08)',
  color: '#991b1b',
  cursor: 'pointer',
  fontWeight: 900,
  minHeight: 44,
  width: '100%',
};
