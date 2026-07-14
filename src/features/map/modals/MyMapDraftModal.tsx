import { useEffect, useRef } from "react";
import { CATEGORIES, categoryEmoji } from "../mapConstants";
import { draftInputClass } from "./modalShared";

export type MyMapDraft = {
  lat: number;
  lng: number;
  title: string;
  note: string;
  category: string;
};

/** Draft form for saving a place to the personal My Map (saved_places). */
export function MyMapDraftModal({
  draft,
  isMobile,
  setDraft,
  onSubmit,
}: {
  draft: MyMapDraft;
  isMobile: boolean;
  setDraft: (d: MyMapDraft | null) => void;
  onSubmit: () => void | Promise<void>;
}) {
  const titleRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => { titleRef.current?.focus(); }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Save to My Map"
      onClick={() => setDraft(null)}
      onKeyDown={(e) => { if (e.key === "Escape") setDraft(null); }}
      tabIndex={-1}
      className={`fixed inset-0 bg-black/25 flex justify-center z-[1000] ${isMobile ? "items-end p-0" : "items-center p-4"}`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`bg-white shadow-[0_18px_48px_rgba(0,0,0,0.22)] ${
          isMobile
            ? "w-full rounded-t-2xl px-4 pt-4 pb-20 max-h-[80vh] overflow-auto"
            : "w-[min(420px,100%)] rounded-2xl p-4"
        }`}
      >
        <div className="flex justify-between gap-3 mb-3">
          <div className="font-bold text-base">⭐ Save to My Map</div>
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

        <div className="grid gap-2.5">
          <input
            ref={titleRef}
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            placeholder="Place name (required)"
            className={draftInputClass}
          />

          <textarea
            value={draft.note}
            onChange={(e) => setDraft({ ...draft, note: e.target.value })}
            placeholder="Note (optional)"
            rows={2}
            className={`${draftInputClass} resize-none font-[inherit] min-h-[80px]`}
          />

          <select
            value={draft.category}
            onChange={(e) => setDraft({ ...draft, category: e.target.value })}
            className={draftInputClass}
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {categoryEmoji(c.value)} {c.label}
              </option>
            ))}
            <option value="other">📍 Other</option>
          </select>

          <button
            onClick={onSubmit}
            disabled={!draft.title.trim()}
            className="mt-1 w-full py-3 rounded-xl border-none bg-[#45B4B9] text-white font-bold text-base cursor-pointer disabled:opacity-50 disabled:cursor-default"
          >
            Save place
          </button>
        </div>
      </div>
    </div>
  );
}
