import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Modal, Button, Input } from "./ui";

/**
 * Reusable, promise-returning text-input dialog — the replacement for
 * window.prompt() so we don't rely on the browser's native prompt (which iOS
 * Safari PWA mode refuses outright and which looks awful on mobile anyway).
 *
 * Usage:
 *   const prompt = usePrompt();
 *   const title = await prompt({
 *     title: 'Name your itinerary',
 *     defaultValue: 'Lisbon Adventure',
 *     confirmLabel: 'Save',
 *   });
 *   if (!title) return; // user cancelled
 */

export type PromptOptions = {
  title: string;
  /** Optional helper text shown above the input. */
  message?: string;
  /** Pre-fill the input. */
  defaultValue?: string;
  /** Input placeholder. */
  placeholder?: string;
  /** Button label for the confirm action. Default: "OK". */
  confirmLabel?: string;
  /** Button label for the cancel action. Default: "Cancel". */
  cancelLabel?: string;
  /** Max length enforced on the input. */
  maxLength?: number;
};

type PromptFn = (opts: PromptOptions) => Promise<string | null>;

const PromptDialogContext = createContext<PromptFn | null>(null);

export function usePrompt(): PromptFn {
  const ctx = useContext(PromptDialogContext);
  if (!ctx) {
    throw new Error(
      "usePrompt must be used inside <PromptDialogProvider>. Check App.tsx."
    );
  }
  return ctx;
}

type PendingPrompt = {
  opts: PromptOptions;
};

export function PromptDialogProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingPrompt | null>(null);
  const resolverRef = useRef<((value: string | null) => void) | null>(null);

  const prompt: PromptFn = useCallback((opts) => {
    return new Promise<string | null>((resolve) => {
      resolverRef.current = resolve;
      setPending({ opts });
    });
  }, []);

  const close = useCallback((value: string | null) => {
    const resolver = resolverRef.current;
    resolverRef.current = null;
    setPending(null);
    resolver?.(value);
  }, []);

  return (
    <PromptDialogContext.Provider value={prompt}>
      {children}
      {pending && (
        <PromptDialog
          {...pending.opts}
          onSubmit={(value) => close(value)}
          onCancel={() => close(null)}
        />
      )}
    </PromptDialogContext.Provider>
  );
}

function PromptDialog({
  title,
  message,
  defaultValue = "",
  placeholder,
  confirmLabel = "OK",
  cancelLabel = "Cancel",
  maxLength,
  onSubmit,
  onCancel,
}: PromptOptions & {
  onSubmit: (value: string) => void;
  onCancel: () => void;
}) {
  const titleId = useId();
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Focus + select on open so the user can overwrite the default in one keystroke.
  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) {
      // Empty input = cancel. Matches window.prompt behavior when the user
      // clears the field and hits OK.
      onCancel();
      return;
    }
    onSubmit(trimmed);
  };

  return (
    <Modal
      onClose={onCancel}
      labelledBy={titleId}
      zClassName="z-[2000]"
      as="form"
      onSubmit={handleSubmit}
      panelClassName="max-w-md w-full p-5 flex flex-col gap-3"
    >
      <h3 id={titleId} className="text-lg font-bold text-slate-900 m-0">{title}</h3>
      {message && <p className="text-sm text-slate-600 m-0">{message}</p>}
      <Input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
      />
      <div className="flex gap-2 justify-end mt-1">
        <Button variant="secondary" onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button variant="primary" type="submit">
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
