import { useEffect, useRef, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';

/**
 * B2: the ONE modal shell. Owns the behavior every dialog used to hand-roll:
 *   - role="dialog" + aria-modal + accessible name (label or labelledBy)
 *   - Escape key → onClose
 *   - backdrop click → onClose (clicks inside the panel don't bubble out)
 *   - focus safety net: if nothing inside claimed focus on mount (autoFocus /
 *     refs in children win), the panel itself receives focus so keyboard
 *     events land inside the dialog
 *
 * Visuals stay composable: `sheet` switches to a mobile bottom-sheet layout,
 * `panelClassName` extends (or with `panelBase={false}` replaces) the default
 * card, and `backdropClassName`/`zClassName` cover the app's existing stacking
 * quirks. Exotic panels (TipsViewer's sticky note) opt out of the base style.
 */
export interface ModalProps {
  onClose: () => void;
  children: ReactNode;
  /** Accessible name. Pass exactly one of label / labelledBy. */
  label?: string;
  labelledBy?: string;
  /** Bottom-sheet layout (mobile). Default: centered card. */
  sheet?: boolean;
  /** Tailwind z-index class — dialogs across the app stack at set depths. */
  zClassName?: string;
  /** Backdrop tint. Default bg-black/40. */
  backdropClassName?: string;
  /** Appended to (or replacing, see panelBase) the default panel style. */
  panelClassName?: string;
  /** Set false to fully replace the default panel style. */
  panelBase?: boolean;
  /** Extra overlay keydown (e.g. Enter-to-confirm). Escape is built in. */
  onKeyDown?: (e: KeyboardEvent<HTMLDivElement>) => void;
  /** Render the panel as a <form> and wire onSubmit. */
  as?: 'div' | 'form';
  onSubmit?: (e: FormEvent<HTMLFormElement>) => void;
}

export function Modal({
  onClose,
  children,
  label,
  labelledBy,
  sheet = false,
  zClassName = 'z-[1000]',
  backdropClassName = 'bg-black/40',
  panelClassName = '',
  panelBase = true,
  onKeyDown,
  as = 'div',
  onSubmit,
}: ModalProps) {
  const panelRef = useRef<HTMLElement | null>(null);

  // Focus safety net — children with autoFocus/refs win (they run first).
  useEffect(() => {
    const panel = panelRef.current;
    if (panel && !panel.contains(document.activeElement)) {
      panel.focus();
    }
  }, []);

  const base = panelBase
    ? `bg-surface shadow-modal ${sheet ? 'w-full rounded-t-2xl max-h-[90vh] overflow-auto' : 'rounded-2xl'}`
    : '';

  const panelProps = {
    ref: panelRef as never,
    tabIndex: -1,
    onClick: (e: React.MouseEvent) => e.stopPropagation(),
    className: `${base} ${panelClassName}`.trim(),
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      {...(label ? { 'aria-label': label } : {})}
      {...(labelledBy ? { 'aria-labelledby': labelledBy } : {})}
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
        onKeyDown?.(e);
      }}
      tabIndex={-1}
      className={`fixed inset-0 ${backdropClassName} ${zClassName} flex justify-center ${
        sheet ? 'items-end p-0' : 'items-center p-4'
      }`}
    >
      {as === 'form' ? (
        <form {...panelProps} onSubmit={onSubmit}>{children}</form>
      ) : (
        <div {...panelProps}>{children}</div>
      )}
    </div>
  );
}
