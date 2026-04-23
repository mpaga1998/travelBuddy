import type { ReactNode } from 'react';

/** Labeled input wrapper used throughout ProfileInfoTab. */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <div className="text-xs opacity-80">{label}</div>
      {children}
    </div>
  );
}
