import { useEffect, useRef } from "react";
import { toast } from "sonner";
import type { PinCategory } from "../../pins/pinTypes";
import { validateImageFile } from "../../../lib/imageCompress";
import { CATEGORIES, categoryEmoji } from "../mapConstants";
import { Modal } from "../../../components/ui";
import { draftInputClass } from "./modalShared";

export type DraftPin = {
  lat: number;
  lng: number;
  title: string;
  description: string;
  category: PinCategory;
  tips: string[];
  images: File[];
};

/** Draft form for creating a public community pin. */
export function DraftModal({
  draft,
  isMobile,
  setDraft,
  onSubmit,
}: {
  draft: DraftPin;
  isMobile: boolean;
  setDraft: (d: DraftPin | null) => void;
  onSubmit: () => void | Promise<void>;
}) {
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => { titleInputRef.current?.focus(); }, []);

  return (
    <Modal
      onClose={() => setDraft(null)}
      label="Add a pin"
      sheet={isMobile}
      backdropClassName="bg-black/25"
      panelClassName={isMobile ? "px-4 pt-4 pb-20" : "w-[min(520px,100%)] p-4 overflow-visible"}
    >
        <div className="flex justify-between gap-3">
          <div className="font-bold text-base">Add a pin</div>
          <button
            onClick={() => setDraft(null)}
            aria-label="Close"
            className={`border-none bg-transparent text-lg cursor-pointer flex items-center justify-center ${
              isMobile ? "p-2 w-11 h-11" : "p-1 w-8 h-8"
            }`}
          >
            ✕
          </button>
        </div>

        <div className="mt-2.5 grid gap-2.5">
          <input
            ref={titleInputRef}
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            placeholder="Title (required)"
            autoCorrect="off"
            autoCapitalize="sentences"
            spellCheck
            className={draftInputClass}
          />

          <textarea
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            placeholder="Description"
            rows={3}
            autoCorrect="off"
            autoCapitalize="sentences"
            spellCheck
            className={`${draftInputClass} resize-y font-[inherit] min-h-[100px]`}
          />

          <div>
            <div className="text-xs opacity-80 mb-2">💡 Tips (Max 5)</div>
            {draft.tips.map((tip, idx) => (
              <div key={idx} className="flex gap-2 mb-2 items-start">
                <textarea
                  value={tip}
                  onChange={(e) => {
                    const updated = [...draft.tips];
                    updated[idx] = e.target.value;
                    setDraft({ ...draft, tips: updated });
                  }}
                  placeholder={`Tip ${idx + 1}`}
                  rows={2}
                  className={`${draftInputClass} resize-y flex-1 font-[inherit] min-h-[80px]`}
                />
                {draft.tips.length > 1 && (
                  <button
                    onClick={() => setDraft({ ...draft, tips: draft.tips.filter((_, i) => i !== idx) })}
                    aria-label={`Remove tip ${idx + 1}`}
                    className={`rounded-lg border border-red-600/[0.35] bg-red-600/[0.08] text-red-900 cursor-pointer font-bold mt-2.5 text-sm min-h-[44px] ${
                      isMobile ? "px-3 py-2.5" : "px-2 py-2.5"
                    }`}
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
            {draft.tips.length < 5 && (
              <button
                onClick={() => setDraft({ ...draft, tips: [...draft.tips, ""] })}
                className="p-3 rounded-xl border border-black/[0.18] bg-gray-100 text-ink cursor-pointer font-semibold w-full text-sm min-h-[44px]"
              >
                + Add another tip
              </button>
            )}
          </div>

          <div>
            <label className="flex items-center justify-center px-3.5 py-3 rounded-xl border border-black/[0.18] bg-gray-200 cursor-pointer font-semibold select-none text-ink text-sm w-full box-border min-h-[44px]">
              📷 Add pictures ({draft.images.length}/5)
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => {
                  const picked = Array.from(e.target.files ?? []);
                  const valid: File[] = [];
                  for (const f of picked) {
                    const err = validateImageFile(f);
                    if (err) {
                      toast.error(`${f.name}: ${err}`);
                    } else {
                      valid.push(f);
                    }
                  }
                  const combined = [...draft.images, ...valid].slice(-5);
                  setDraft({ ...draft, images: combined });
                  // Reset so picking the same file again still fires onChange.
                  e.target.value = '';
                }}
                className="hidden"
              />
            </label>

            {draft.images.length > 0 && (
              <div className="flex gap-2 mt-2.5 overflow-hidden">
                {draft.images.map((file, idx) => (
                  <div key={idx} className="relative w-20 h-20 rounded-lg overflow-hidden shrink-0">
                    <img
                      src={URL.createObjectURL(file)}
                      alt={`preview-${idx}`}
                      className="w-full h-full object-cover"
                    />
                    <button
                      onClick={() => setDraft({ ...draft, images: draft.images.filter((_, i) => i !== idx) })}
                      aria-label={`Remove image ${idx + 1}`}
                      className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 text-white border-none cursor-pointer p-0 flex items-center justify-center text-xs font-bold"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <select
            value={draft.category}
            onChange={(e) => setDraft({ ...draft, category: e.target.value as PinCategory })}
            className={draftInputClass}
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {categoryEmoji(c.value)} {c.label}
              </option>
            ))}
          </select>

          <div className="text-xs opacity-75">
            Location: {draft.lat.toFixed(5)}, {draft.lng.toFixed(5)}
          </div>

          <button
            onClick={onSubmit}
            disabled={!draft.title.trim()}
            className={`mt-1.5 px-4 py-3 rounded-xl border-none text-white font-bold min-h-[44px] text-base ${
              draft.title.trim()
                ? "cursor-pointer bg-ink"
                : "cursor-not-allowed bg-black/25"
            }`}
          >
            Create pin
          </button>
        </div>
    </Modal>
  );
}
