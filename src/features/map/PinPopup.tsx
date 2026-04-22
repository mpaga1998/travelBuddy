import { useEffect, useState } from "react";
import type { Pin } from "../pins/pinTypes";
import { isBookmarked } from "../pins/pinApi";
import { categoryEmoji, MOBILE_BREAKPOINT } from "./mapConstants";
import { getMapsUrl } from "../../lib/mapsUtils";

export type PinPopupProps = {
  pin: Pin;
  currentUserId: string | null;
  /** True if the pin is in the user's bookmark set (parent's source of truth). */
  isBookmarkedByUser: boolean;
  /** Fired on heart/broken-heart. Parent handles the API call + count refresh. */
  onReact: (kind: "like" | "dislike") => void | Promise<void>;
  /** Fired on bookmark button. Parent calls useBookmarks.toggle(pin.id). */
  onToggleBookmark: () => void | Promise<void>;
  /** Fired when the user wants to see the tips popover. */
  onShowTips: (tips: string[]) => void;
  /** Fired on the main image click — parent opens the lightbox. */
  onShowImages: (urls: string[]) => void;
  /** Fired on Delete (only rendered when pin belongs to current user). */
  onRequestDelete: () => void;
};

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
}: PinPopupProps) {
  const isMobile = typeof window !== "undefined" && window.innerWidth < MOBILE_BREAKPOINT;

  // Confirm bookmark state against server once — the parent's set is an
  // optimistic cache; if it disagrees with reality (e.g. bookmarked in
  // another tab), we want the button to reflect truth.
  const [bookmarkedConfirmed, setBookmarkedConfirmed] = useState<boolean | null>(null);
  const [bookmarkBusy, setBookmarkBusy] = useState(false);

  useEffect(() => {
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
  }, [pin.id]);

  const bookmarked = bookmarkedConfirmed ?? isBookmarkedByUser;

  // Stop map clicks from bubbling — popup must feel isolated.
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  const isOwnPin = pin.createdById === currentUserId;

  return (
    <div
      onClick={stop}
      onMouseDown={stop}
      onTouchStart={stop}
      style={{
        width: "100%",
        maxWidth: "100%",
        minWidth: isMobile ? 0 : 360,
        color: "#111",
        fontFamily: "system-ui, Arial",
        fontSize: isMobile ? 13 : 14,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {pin.imageUrls && pin.imageUrls.length > 0 && (
        <div
          style={{
            position: "relative",
            width: "100%",
            overflow: "hidden",
            borderRadius: "8px 8px 0 0",
            flexShrink: 0,
            cursor: "pointer",
          }}
          onClick={(e) => { e.stopPropagation(); onShowImages(pin.imageUrls ?? []); }}
        >
          <img
            src={pin.imageUrls[0]}
            style={{
              width: "100%",
              height: isMobile ? 120 : 140,
              objectFit: "cover",
              display: "block",
            }}
          />
          {pin.imageUrls.length > 1 && (
            <div
              style={{
                position: "absolute",
                bottom: 8,
                right: 8,
                background: "rgba(0,0,0,0.7)",
                color: "white",
                padding: "4px 8px",
                borderRadius: 6,
                fontWeight: "bold",
                fontSize: 12,
              }}
            >
              +{pin.imageUrls.length - 1}
            </div>
          )}
        </div>
      )}

      <div style={{ padding: 12, overflowY: "auto", flex: 1, wordWrap: "break-word" }}>
        <div style={{ fontWeight: 800, marginBottom: 6, fontSize: isMobile ? 15 : 16 }}>
          {categoryEmoji(pin.category)} {pin.title}
        </div>

        <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 10 }}>
          {pin.description?.trim() ? (
            pin.description
          ) : (
            <i style={{ opacity: 0.7 }}>No description</i>
          )}
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          <span
            style={{
              padding: "4px 8px",
              borderRadius: 999,
              background: "rgba(37,99,235,0.12)",
              fontSize: 12,
            }}
          >
            {pin.createdByType === "hostel"
              ? `Recommended by ${pin.createdByLabel}`
              : `Pinned by ${pin.createdByLabel}`}
          </span>
        </div>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
          <button
            onClick={(e) => { e.stopPropagation(); onReact("like"); }}
            style={pillButtonStyle({ flex: "1 1 100px" })}
          >
            ❤️ <span style={{ marginLeft: 4 }}>{pin.likesCount}</span>
          </button>

          <button
            onClick={(e) => { e.stopPropagation(); onReact("dislike"); }}
            style={pillButtonStyle({ flex: "1 1 100px" })}
          >
            💔 <span style={{ marginLeft: 4 }}>{pin.dislikesCount}</span>
          </button>

          {pin.tips && pin.tips.length > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); onShowTips(pin.tips ?? []); }}
              style={pillButtonStyle({
                flex: "1 1 140px",
                background: "#fffaeb",
                color: "#b8860b",
              })}
            >
              💡 Tips ({pin.tips.length})
            </button>
          )}

          <button
            onClick={async (e) => {
              e.stopPropagation();
              if (bookmarkBusy) return;
              setBookmarkBusy(true);
              try {
                await onToggleBookmark();
                // Flip the confirmed state optimistically — parent will have
                // updated its set by now, but we drive our button off this.
                setBookmarkedConfirmed((prev) => !(prev ?? isBookmarkedByUser));
              } finally {
                setBookmarkBusy(false);
              }
            }}
            disabled={bookmarkBusy || bookmarkedConfirmed === null}
            style={{
              flex: "1 1 100px",
              padding: "8px 10px",
              borderRadius: 10,
              border: "2px solid #16a34a",
              background: bookmarked ? "#16a34a" : "white",
              color: bookmarked ? "white" : "#111",
              cursor: bookmarkBusy ? "wait" : "pointer",
              fontWeight: 800,
              fontSize: 13,
              outline: "none",
              transition: "all 0.2s",
            }}
          >
            {bookmarkedConfirmed === null
              ? "⏳ Loading..."
              : bookmarked
                ? "🔖 Bookmarked"
                : "🔖 Bookmark"}
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              window.open(getMapsUrl(pin.lat, pin.lng, pin.title), "_blank");
            }}
            style={pillButtonStyle({ flex: "1 1 120px" })}
          >
            📍 Maps
          </button>

          {isOwnPin && (
            <button
              onClick={(e) => { e.stopPropagation(); onRequestDelete(); }}
              style={{
                padding: "8px 10px",
                borderRadius: 10,
                border: "none",
                background: "#dc2626",
                color: "white",
                cursor: "pointer",
                fontWeight: 800,
                outline: "none",
              }}
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function pillButtonStyle(override: React.CSSProperties = {}): React.CSSProperties {
  return {
    flex: 1,
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid rgba(0,0,0,0.18)",
    background: "white",
    cursor: "pointer",
    fontWeight: 800,
    color: "#111",
    fontSize: 13,
    outline: "none",
    ...override,
  };
}
