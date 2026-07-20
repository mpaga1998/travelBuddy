import {
  createContext,
  useCallback,
  useContext,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Modal, Button } from "./ui";

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
  const titleId = useId();

  return (
    <Modal
      onClose={onCancel}
      labelledBy={titleId}
      zClassName="z-[2000]"
      onKeyDown={(e) => { if (e.key === "Enter") onConfirm(); }}
      panelClassName="max-w-md w-full p-5 flex flex-col gap-3"
    >
      <h3 id={titleId} className="text-lg font-bold text-slate-900 m-0">{title}</h3>
      {message && <p className="text-sm text-slate-600 m-0">{message}</p>}
      <div className="flex gap-2 justify-end mt-2">
        <Button variant="secondary" onClick={onCancel} autoFocus>
          {cancelLabel}
        </Button>
        <Button variant={destructive ? "danger" : "primary"} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
