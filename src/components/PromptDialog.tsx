import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

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
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onCancel}
      onKeyDown={(e) => {
        if (e.key === "Escape") onCancel();
      }}
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-[2000] p-4"
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl shadow-[0_18px_48px_rgba(0,0,0,0.22)] max-w-md w-full p-5 flex flex-col gap-3"
      >
        <h3 className="text-lg font-bold text-slate-900 m-0">{title}</h3>
        {message && <p className="text-sm text-slate-600 m-0">{message}</p>}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          className="px-3 py-2 rounded-lg border border-black/[0.18] text-sm text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 min-h-[40px]"
        />
        <div className="flex gap-2 justify-end mt-1">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-lg border border-black/[0.18] bg-white hover:bg-gray-100 text-slate-900 font-semibold text-sm min-h-[40px] cursor-pointer"
          >
            {cancelLabel}
          </button>
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm min-h-[40px] cursor-pointer border-none"
          >
            {confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
