import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { Pin } from "../pins/pinTypes";
import { isBookmarked, reportPin } from "../pins/pinApi";
import { categoryEmoji, MOBILE_BREAKPOINT } from "./mapConstants";
import { getMapsUrl } from "../../lib/mapsUtils";
import { imgPopup } from "../../lib/imageTransforms";

export type PinPopupProps = {
  pin: Pin;
  currentUserId: string | null;
  /** True if the pin is in the user's bookmark set (parent's source of truth). */
  isBookmarkedByUser: boolean;
  /** Fired on heart/broken-heart. Parent handles the API call + count refresh. */
  onReact?: (kind: "like" | "dislike") => void | Promise<void>;
  /** Fired on bookmark button. Parent calls useBookmarks.toggle(pin.id). */
  onToggleBookmark?: () => void | Promise<void>;
  /** Fired when the user wants to see the tips popover. */
  onShowTips: (tips: string[]) => void;
  /** Fired on the main image click — parent opens the lightbox. */
  onShowImages: (urls: string[]) => void;
  /** Fired on Delete (only rendered when pin belongs to current user). */
  onRequestDelete?: () => void;
  /**
   * When true, shows a "From your itinerary" badge and hides social/bookmark/delete
   * actions. The pin is ephemeral — no server round-trips are needed.
   */
  isItineraryPin?: boolean;
};

// Shared pill-button class. Accepts an extra string to compose variants
// (e.g. tip button uses a yellow palette). Kept as a helper so the class
// list doesn't need to be repeated on every button.
function pillBtnClass(extra = "") {
  return `flex-[1_1_100px] px-2.5 py-2 rounded-[10px] border border-black/[0.18] bg-white cursor-pointer font-extrabold text-[#111] text-[13px] outline-none ${extra}`;
}

/**
 * React replacement for the old HTML-string popup. Same visual layout,
 * but buttons are real React handlers and the bookmark-loading state
 * is a normal useState instead of a DOM mutation dance.
 *
 * Parent is responsible for mounting this into the popup container via
 * createRoot().render() — see PinLayer.
 */
export function PinPopup({
  pin,
  currentUserId,
  isBookmarkedByUser,
  onReact,
  onToggleBookmark,
  onShowTips,
  onShowImages,
  onRequestDelete,
  isItineraryPin = false,
}: PinPopupProps) {
  const isMobile = typeof window !== "undefined" && window.innerWidth < MOBILE_BREAKPOINT;

  // Confirm bookmark state against server once — the parent's set is an
  // optimistic cache; if it disagrees with reality (e.g. bookmarked in
  // another tab), we want the button to reflect truth.
  const [bookmarkedConfirmed, setBookmarkedConfirmed] = useState<boolean | null>(null);
  const [bookmarkBusy, setBookmarkBusy] = useState(false);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportBusy, setReportBusy] = useState(false);

  useEffect(() => {
    // Itinerary pins are ephemeral — skip the server round-trip.
    if (isItineraryPin) {
      setBookmarkedConfirmed(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const truth = await isBookmarked(pin.id);
        if (!cancelled) setBookmarkedConfirmed(truth);
      } catch {
        if (!cancelled) setBookmarkedConfirmed(isBookmarkedByUser);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pin.id, isItineraryPin]);

  const bookmarked = bookmarkedConfirmed ?? isBookmarkedByUser;

  // Stop map clicks from bubbling — popup must feel isolated.
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  const isOwnPin = pin.createdById === currentUserId;

  return (
    <div
      onClick={stop}
      onMouseDown={stop}
      onTouchStart={stop}
      className={`w-full max-w-full text-[#111] font-sans flex flex-col overflow-hidden ${isMobile ? "min-w-0 text-[13px]" : "min-w-[360px] text-sm"}`}
    >
      {pin.imageUrls && pin.imageUrls.length > 0 && (
        <div
          className="relative w-full overflow-hidden rounded-t-lg shrink-0 cursor-pointer"
          onClick={(e) => { e.stopPropagation(); onShowImages(pin.imageUrls ?? []); }}
        >
          <img
            src={imgPopup(pin.imageUrls[0])}
            loading="lazy"
            decoding="async"
            className={`w-full object-cover block ${isMobile ? "h-[120px]" : "h-[140px]"}`}
          />
          {pin.imageUrls.length > 1 && (
            <div className="absolute bottom-2 right-2 bg-black/70 text-white px-2 py-1 rounded-md font-bold text-xs">
              +{pin.imageUrls.length - 1}
            </div>
          )}
        </div>
      )}

      <div className="p-3 overflow-y-auto flex-1 break-words">
        <div className={`font-extrabold mb-1.5 ${isMobile ? "text-[15px]" : "text-base"}`}>
          {categoryEmoji(pin.category)} {pin.title}
        </div>

        <div className="text-[13px] opacity-90 mb-2.5">
          {pin.description?.trim() ? (
            pin.description
          ) : (
            <i className="opacity-70">No description</i>
          )}
        </div>

        <div className="flex gap-2 flex-wrap mb-2.5">
          {isItineraryPin ? (
            <span className="px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-800 text-xs font-semibold">
              📋 From your itinerary
            </span>
          ) : (
            <span className="px-2 py-1 rounded-full bg-blue-600/[0.12] text-xs">
              {pin.createdByType === "hostel"
                ? `Recommended by ${pin.createdByLabel}`
                : `Pinned by ${pin.createdByLabel}`}
            </span>
          )}
        </div>

        <div className="flex gap-1.5 flex-wrap mt-2">
          {!isItineraryPin && (
            <button
              onClick={(e) => { e.stopPropagation(); onReact?.("like"); }}
              className={pillBtnClass()}
            >
              ❤️ <span className="ml-1">{pin.likesCount}</span>
            </button>
          )}

          {!isItineraryPin && (
            <button
              onClick={(e) => { e.stopPropagation(); onReact?.("dislike"); }}
              className={pillBtnClass()}
            >
              💔 <span className="ml-1">{pin.dislikesCount}</span>
            </button>
          )}

          {pin.tips && pin.tips.length > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); onShowTips(pin.tips ?? []); }}
              className={pillBtnClass("!bg-[#fffaeb] !text-[#b8860b] flex-[1_1_140px]")}
            >
              💡 Tips ({pin.tips.length})
            </button>
          )}

          {!isItineraryPin && (
            <button
              onClick={async (e) => {
                e.stopPropagation();
                if (bookmarkBusy) return;
                setBookmarkBusy(true);
                try {
                  await onToggleBookmark?.();
                  // Flip the confirmed state optimistically — parent will have
                  // updated its set by now, but we drive our button off this.
                  setBookmarkedConfirmed((prev) => !(prev ?? isBookmarkedByUser));
                } finally {
                  setBookmarkBusy(false);
                }
              }}
              disabled={bookmarkBusy || bookmarkedConfirmed === null}
              className={`flex-[1_1_100px] px-2.5 py-2 rounded-[10px] border-2 border-green-600 font-extrabold text-[13px] outline-none transition-all ${bookmarkBusy ? "cursor-wait" : "cursor-pointer"} ${bookmarked ? "bg-green-600 text-white" : "bg-white text-[#111]"}`}
            >
              {bookmarkedConfirmed === null
                ? "⏳ Loading..."
                : bookmarked
                  ? "🔖 Bookmarked"
                  : "🔖 Bookmark"}
            </button>
          )}

          <button
            onClick={(e) => {
              e.stopPropagation();
              window.open(getMapsUrl(pin.lat, pin.lng, pin.title), "_blank");
            }}
            className={pillBtnClass("flex-[1_1_120px]")}
          >
            📍 Maps
          </button>

          {!isItineraryPin && isOwnPin && (
            <button
              onClick={(e) => { e.stopPropagation(); onRequestDelete?.(); }}
              className="px-2.5 py-2 rounded-[10px] border-none bg-red-600 text-white cursor-pointer font-extrabold outline-none"
            >
              Delete
            </button>
          )}

          {/* Report — only shown to other users, not to the pin's author */}
          {!isItineraryPin && !isOwnPin && (
            <button
              onClick={(e) => { e.stopPropagation(); setReportDialogOpen(true); }}
              disabled={reportBusy}
              className="px-2.5 py-2 rounded-[10px] border border-black/[0.12] bg-white text-slate-400 hover:text-slate-600 cursor-pointer text-[12px] font-semibold outline-none flex-none"
              title="Report this pin"
            >
              🚩 Report
            </button>
          )}
        </div>
      </div>

      {reportDialogOpen && (
        <ReportDialog
          onCancel={() => setReportDialogOpen(false)}
          onSubmit={async (reason) => {
            setReportBusy(true);
            try {
              await reportPin(pin.id, reason);
              setReportDialogOpen(false);
              toast.success("Report submitted — thanks for keeping the map safe.");
            } catch (err) {
              const msg =
                (err as { code?: string })?.code === "23505"
                  ? "You've already reported this pin."
                  : err instanceof Error
                    ? err.message
                    : "Failed to submit report.";
              toast.error(msg);
            } finally {
              setReportBusy(false);
            }
          }}
        />
      )}
    </div>
  );
}

// ─── ReportDialog ────────────────────────────────────────────────────────────
// Self-contained modal rendered inside PinPopup's isolated React tree
// (PinPopup is mounted via createRoot in PinLayer — no Context providers from
// the main app tree are available here).

function ReportDialog({
  onSubmit,
  onCancel,
}: {
  onSubmit: (reason: string) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(reason.trim());
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Report pin"
      onClick={onCancel}
      onKeyDown={(e) => { if (e.key === "Escape") onCancel(); }}
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-[9999] p-4"
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl shadow-[0_18px_48px_rgba(0,0,0,0.22)] max-w-md w-full p-5 flex flex-col gap-3"
      >
        <h3 className="text-lg font-bold text-slate-900 m-0">Report this pin</h3>
        <p className="text-sm text-slate-600 m-0">
          Tell us what's wrong — this helps keep the map safe for everyone.
        </p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Spam, inaccurate location, inappropriate content…"
          maxLength={500}
          rows={3}
          className="px-3 py-2 rounded-lg border border-black/[0.18] text-sm text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 resize-none"
        />
        <div className="flex gap-2 justify-end mt-1">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-lg border border-black/[0.18] bg-white hover:bg-gray-100 text-slate-900 font-semibold text-sm min-h-[40px] cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-semibold text-sm min-h-[40px] cursor-pointer border-none"
          >
            Submit report
          </button>
        </div>
      </form>
    </div>
  );
}
