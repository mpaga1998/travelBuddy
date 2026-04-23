import type { ReactNode } from 'react';

/** Labeled input wrapper used throughout ProfileInfoTab. */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <div style={{ fontSize: 12, opacity: 0.8 }}>{label}</div>
      {children}
    </div>
  );
}
