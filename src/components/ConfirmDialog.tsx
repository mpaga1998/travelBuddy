import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";

/**
 * Reusable, promise-returning confirm dialog — the replacement for
 * window.confirm() so destructive actions don't rely on the browser's ugly
 * native dialog (which is also blocked inside some mobile PWAs).
 *
 * Usage:
 *   const confirm = useConfirm();
 *   if (await confirm({ title: 'Delete?', confirmLabel: 'Delete', destructive: true })) { ... }
 */

export type ConfirmOptions = {
  title: string;
  /** Optional body text shown under the title. */
  message?: string;
  /** Button label for the confirm action. Default: "Confirm". */
  confirmLabel?: string;
  /** Button label for the cancel action. Default: "Cancel". */
  cancelLabel?: string;
  /** Style the confirm button as destructive (red). Default: false. */
  destructive?: boolean;
};

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmDialogContext = createContext<ConfirmFn | null>(null);

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmDialogContext);
  if (!ctx) {
    throw new Error(
      "useConfirm must be used inside <ConfirmDialogProvider>. Check App.tsx."
    );
  }
  return ctx;
}

type PendingConfirm = {
  opts: ConfirmOptions;
  resolve: (value: boolean) => void;
};

export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  // Keep the latest resolver in a ref so stray keydown handlers that fire
  // after state resets don't resolve a stale promise.
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm: ConfirmFn = useCallback((opts) => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setPending({ opts, resolve });
    });
  }, []);

  const close = useCallback((value: boolean) => {
    const resolver = resolverRef.current;
    resolverRef.current = null;
    setPending(null);
    resolver?.(value);
  }, []);

  return (
    <ConfirmDialogContext.Provider value={confirm}>
      {children}
      {pending && (
        <ConfirmDialog
          {...pending.opts}
          onConfirm={() => close(true)}
          onCancel={() => close(false)}
        />
      )}
    </ConfirmDialogContext.Provider>
  );
}

function ConfirmDialog({
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmOptions & { onConfirm: () => void; onCancel: () => void }) {
  // Esc cancels, Enter confirms. Attach at window level while mounted.
  const confirmBtnClass = destructive
    ? "px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold text-sm min-h-[40px] cursor-pointer border-none"
    : "px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm min-h-[40px] cursor-pointer border-none";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onCancel}
      onKeyDown={(e) => {
        if (e.key === "Escape") onCancel();
        if (e.key === "Enter") onConfirm();
      }}
      tabIndex={-1}
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-[2000] p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-[0_18px_48px_rgba(0,0,0,0.22)] max-w-md w-full p-5 flex flex-col gap-3"
      >
        <h3 className="text-lg font-bold text-slate-900 m-0">{title}</h3>
        {message && <p className="text-sm text-slate-600 m-0">{message}</p>}
        <div className="flex gap-2 justify-end mt-2">
          <button
            onClick={onCancel}
            autoFocus
            className="px-4 py-2 rounded-lg border border-black/[0.18] bg-white hover:bg-gray-100 text-slate-900 font-semibold text-sm min-h-[40px] cursor-pointer"
          >
            {cancelLabel}
          </button>
          <button onClick={onConfirm} className={confirmBtnClass}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
