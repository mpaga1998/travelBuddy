import { useEffect, useRef } from "react";
import { CATEGORIES, categoryEmoji } from "../mapConstants";
import { Modal, Button } from "../../../components/ui";
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
    <Modal
      onClose={() => setDraft(null)}
      label="Save to My Map"
      sheet={isMobile}
      backdropClassName="bg-black/25"
      panelClassName={isMobile ? "px-4 pt-4 pb-20" : "w-[min(420px,100%)] p-4"}
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

          <Button
            variant="primary"
            size="lg"
            onClick={onSubmit}
            disabled={!draft.title.trim()}
            className="mt-1 w-full font-bold"
          >
            Save place
          </Button>
        </div>
    </Modal>
  );
}
