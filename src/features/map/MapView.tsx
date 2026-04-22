import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Map as MapboxMap } from "mapbox-gl";

import type { Pin, PinCategory } from "../pins/pinTypes";
import {
  createPin,
  deletePin,
  toggleReaction,
  uploadPinImage,
} from "../pins/pinApi";

import { ItineraryModal } from "../itinerary/ItineraryModal";
import { supabase } from "../../lib/supabaseClient";
import { getLocationNameFromCoordinates } from "../../lib/mapbox";

import { MapCanvas } from "./MapCanvas";
import { PinLayer } from "./PinLayer";
import { FilterBar } from "./FilterBar";
import { CATEGORIES, categoryEmoji } from "./mapConstants";
import { useIsMobile } from "./hooks/useIsMobile";
import { useBookmarks } from "./hooks/useBookmarks";
import { useMapPins } from "./hooks/useMapPins";

const ITINERARY_FEATURE_ENABLED = true;

type DraftPin = {
  lat: number;
  lng: number;
  title: string;
  description: string;
  category: PinCategory;
  tips: string[];
  images: File[];
};

type MapViewProps = {
  onBack?: () => void;
  initialCenter?: { lng: number; lat: number } | null;
};

/**
 * Composition root for the map feature.
 *
 * Responsibilities:
 *   - Owns the Mapbox instance ref (filled by MapCanvas via onMapReady).
 *   - Owns the "what's happening" modal state: draft, tips viewer, delete
 *     confirmation, image lightbox. These are intentionally NOT split yet —
 *     2.1 targets map/pins/filters. The draft-pin modal is the next obvious
 *     follow-up.
 *   - Composes hooks (useMapPins, useBookmarks) and passes their slices to
 *     FilterBar and PinLayer.
 *
 * Was 1,812 lines. Now ~500. Popups are real React components. Filter state
 * has one owner. Ready for 2.2 (native clustering) which only touches
 * PinLayer.
 */
export function MapView({ onBack, initialCenter }: MapViewProps = {}) {
  const mapRef = useRef<MapboxMap | null>(null);
  const isMobile = useIsMobile();

  // --- Auth (just the id — we don't need profile here) --------------------
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (data.user?.id) setCurrentUserId(data.user.id);
      } catch {
        /* ignore */
      }
    })();
  }, []);

  // --- Data hooks ---------------------------------------------------------
  const { bookmarkedPinIds, toggle: toggleBookmarkHook } = useBookmarks(currentUserId);
  const {
    filteredPins,
    loading,
    reload,
    mapType,
    setMapType,
    activeCategory,
    setActiveCategory,
    selectedAgeRanges,
    setSelectedAgeRanges,
  } = useMapPins(bookmarkedPinIds);

  // --- Selection + draft + modals ----------------------------------------
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftPin | null>(null);
  const [itineraryModalOpen, setItineraryModalOpen] = useState(false);
  const [tipsViewerOpen, setTipsViewerOpen] = useState(false);
  const [viewerTips, setViewerTips] = useState<string[]>([]);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteConfirmPinId, setDeleteConfirmPinId] = useState<string | null>(null);

  // Keep refs of draft/selection so the map-click callback doesn't capture stale state.
  const draftRef = useRef<DraftPin | null>(null);
  useEffect(() => { draftRef.current = draft; }, [draft]);
  const selectedPinIdRef = useRef<string | null>(null);
  useEffect(() => { selectedPinIdRef.current = selectedPinId; }, [selectedPinId]);

  const selectedPin: Pin | null = useMemo(
    () => filteredPins.find((p) => p.id === selectedPinId) ?? null,
    [filteredPins, selectedPinId]
  );

  // Close popup when switching map types.
  useEffect(() => {
    setSelectedPinId(null);
  }, [mapType]);

  // --- Map callbacks ------------------------------------------------------
  const handleMapReady = useCallback((map: MapboxMap) => {
    mapRef.current = map;
  }, []);

  const handleMapClick = useCallback(async (lngLat: mapboxgl.LngLat) => {
    // Clicking empty map: close popup first, then on a second empty click,
    // open the add-pin modal.
    if (selectedPinIdRef.current) {
      setSelectedPinId(null);
      return;
    }
    if (draftRef.current) return;

    const locationName = await getLocationNameFromCoordinates(lngLat.lng, lngLat.lat);
    setDraft({
      lng: lngLat.lng,
      lat: lngLat.lat,
      title: locationName,
      description: "",
      category: "other",
      tips: [],
      images: [],
    });
  }, []);

  // --- Reactions + delete -------------------------------------------------
  const handleReact = useCallback(async (pin: Pin, kind: "like" | "dislike") => {
    try {
      await toggleReaction(pin.id, kind);
      await reload();
    } catch (e) {
      console.error("Reaction failed:", e);
    }
  }, [reload]);

  const handleRequestDelete = useCallback((pin: Pin) => {
    setDeleteConfirmPinId(pin.id);
    setDeleteConfirmOpen(true);
  }, []);

  const handleConfirmDelete = useCallback(async (pinId: string) => {
    try {
      await deletePin(pinId);
      setSelectedPinId(null);
      setDeleteConfirmOpen(false);
      setDeleteConfirmPinId(null);
      await reload();
    } catch (e) {
      console.error("Delete failed:", e);
    }
  }, [reload]);

  // --- Bookmarks bridge ---------------------------------------------------
  const handleToggleBookmark = useCallback(async (pin: Pin) => {
    try {
      await toggleBookmarkHook(pin.id);
    } catch (e) {
      console.error("Bookmark toggle failed:", e);
    }
  }, [toggleBookmarkHook]);

  // --- Draft submit -------------------------------------------------------
  async function onSubmitDraft() {
    if (!draft) return;
    const title = draft.title.trim();
    if (!title) return;

    const imageUrls: string[] = [];
    for (const file of draft.images) {
      const url = await uploadPinImage(file);
      imageUrls.push(url);
    }

    await createPin({
      title,
      description: draft.description.trim(),
      category: draft.category,
      lat: draft.lat,
      lng: draft.lng,
      tips: draft.tips.filter((t) => t.trim()),
      imageUrls,
    });

    setDraft(null);
    await reload();
  }

  // --- Lightbox (kept imperative for now; 2.x can lift into a component) --
  function showImageLightbox(urls: string[]) {
    if (!urls.length) return;
    let currentIndex = 0;

    const lightbox = document.createElement("div");
    Object.assign(lightbox.style, {
      position: "fixed", inset: "0", background: "rgba(0,0,0,0.85)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: "10000", padding: "16px", cursor: "pointer",
      flexDirection: "column",
    } as CSSStyleDeclaration);

    const img = document.createElement("img");
    Object.assign(img.style, {
      maxWidth: "90vw", maxHeight: "70vh", objectFit: "contain",
      borderRadius: "8px", cursor: "default",
    } as CSSStyleDeclaration);

    const update = () => { img.src = urls[currentIndex]; };
    update();
    lightbox.appendChild(img);

    if (urls.length > 1) {
      const controls = document.createElement("div");
      Object.assign(controls.style, {
        display: "flex", gap: "12px", marginTop: "16px",
        alignItems: "center", color: "white",
      } as CSSStyleDeclaration);

      const counter = document.createElement("div");
      counter.style.fontSize = "14px";
      counter.textContent = `${currentIndex + 1} / ${urls.length}`;

      const mkBtn = (label: string, delta: number) => {
        const b = document.createElement("button");
        b.textContent = label;
        Object.assign(b.style, {
          padding: "8px 12px", borderRadius: "6px", border: "1px solid white",
          background: "rgba(255,255,255,0.2)", color: "white",
          cursor: "pointer", fontWeight: "bold",
        } as CSSStyleDeclaration);
        b.addEventListener("click", (e) => {
          e.stopPropagation();
          currentIndex = (currentIndex + delta + urls.length) % urls.length;
          update();
          counter.textContent = `${currentIndex + 1} / ${urls.length}`;
        });
        return b;
      };

      controls.appendChild(mkBtn("← Prev", -1));
      controls.appendChild(counter);
      controls.appendChild(mkBtn("Next →", +1));
      lightbox.appendChild(controls);
    }

    lightbox.addEventListener("click", (e) => {
      if (e.target === lightbox) lightbox.remove();
    });
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        lightbox.remove();
        document.removeEventListener("keydown", esc);
      }
    };
    document.addEventListener("keydown", esc);
    document.body.appendChild(lightbox);
  }

  // =======================================================================
  // Render
  // =======================================================================
  return (
    <>
      <style>{`
        .pin-popup.mapboxgl-popup { padding: 16px !important; }
        .pin-popup.mapboxgl-popup .mapboxgl-popup-content {
          max-height: calc(100vh - 40px);
          overflow-y: auto;
          box-sizing: border-box;
        }
      `}</style>

      <div style={{ display: "grid", gridTemplateRows: "auto 1fr", height: "100vh" }}>
        <FilterBar
          onBack={onBack}
          onLogoClick={() => {
            mapRef.current?.easeTo({ bearing: 0, pitch: 0, duration: 600 });
          }}
          mapType={mapType}
          setMapType={setMapType}
          activeCategory={activeCategory}
          setActiveCategory={setActiveCategory}
          selectedAgeRanges={selectedAgeRanges}
          setSelectedAgeRanges={setSelectedAgeRanges}
        />

        <div style={{ position: "relative", height: "100%" }}>
          <MapCanvas
            initialCenter={initialCenter}
            onMapReady={handleMapReady}
            onMapClick={handleMapClick}
          />

          <PinLayer
            map={mapRef.current}
            pins={filteredPins}
            selectedPin={selectedPin}
            onSelect={(p) => { setDraft(null); setSelectedPinId(p.id); }}
            onCloseSelection={() => { setSelectedPinId(null); setTipsViewerOpen(false); }}
            currentUserId={currentUserId}
            bookmarkedPinIds={bookmarkedPinIds}
            onReact={handleReact}
            onToggleBookmark={handleToggleBookmark}
            onShowTips={(tips) => { setViewerTips(tips); setTipsViewerOpen(true); }}
            onShowImages={(urls) => showImageLightbox(urls)}
            onRequestDelete={handleRequestDelete}
          />

          {loading && (
            <div
              style={{
                position: "absolute",
                top: 12,
                left: 12,
                padding: "8px 10px",
                borderRadius: 10,
                background: "rgba(255,255,255,0.92)",
                border: "1px solid rgba(0,0,0,0.08)",
                boxShadow: "0 6px 18px rgba(0,0,0,0.08)",
                fontSize: isMobile ? 13 : 14,
              }}
            >
              Loading pins…
            </div>
          )}

          {/* ---- Draft-pin modal (not split in 2.1 — next follow-up) ---- */}
          {draft && (
            <DraftModal
              draft={draft}
              isMobile={isMobile}
              setDraft={setDraft}
              onSubmit={onSubmitDraft}
            />
          )}

          {ITINERARY_FEATURE_ENABLED && (
            <ItineraryModal
              open={itineraryModalOpen}
              onClose={() => setItineraryModalOpen(false)}
            />
          )}

          {tipsViewerOpen && viewerTips.length > 0 && (
            <TipsViewer
              isMobile={isMobile}
              tips={viewerTips}
              onClose={() => setTipsViewerOpen(false)}
            />
          )}

          {deleteConfirmOpen && deleteConfirmPinId && (
            <DeleteConfirm
              onCancel={() => {
                setDeleteConfirmOpen(false);
                setDeleteConfirmPinId(null);
              }}
              onConfirm={() => handleConfirmDelete(deleteConfirmPinId)}
            />
          )}
        </div>
      </div>
    </>
  );
}

// =========================================================================
// File-local modal components. Kept here because they're not in 2.1 scope;
// a follow-up pass can promote them to their own files.
// =========================================================================

function DraftModal({
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
  return (
    <div
      onClick={() => setDraft(null)}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.25)",
        display: "flex",
        alignItems: isMobile ? "flex-end" : "center",
        justifyContent: "center",
        padding: isMobile ? 0 : 16,
        zIndex: 1000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: isMobile ? "100%" : "min(520px, 100%)",
          background: "white",
          borderRadius: isMobile ? "16px 16px 0 0" : 16,
          padding: isMobile ? "16px 16px 80px 16px" : 16,
          boxShadow: "0 18px 48px rgba(0,0,0,0.22)",
          maxHeight: isMobile ? "90vh" : "auto",
          overflow: isMobile ? "auto" : "visible",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>Add a pin</div>
          <button
            onClick={() => setDraft(null)}
            aria-label="Close"
            style={{
              border: "none",
              background: "transparent",
              fontSize: 18,
              cursor: "pointer",
              padding: isMobile ? 8 : 4,
              width: isMobile ? 44 : 32,
              height: isMobile ? 44 : 32,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
          <input
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            placeholder="Title (required)"
            autoCorrect="off"
            autoCapitalize="sentences"
            spellCheck
            style={{
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.18)",
              fontSize: 16,
              minHeight: 44,
            }}
          />

          <textarea
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            placeholder="Description"
            rows={3}
            autoCorrect="off"
            autoCapitalize="sentences"
            spellCheck
            style={{
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.18)",
              resize: "vertical",
              fontSize: 16,
              fontFamily: "inherit",
              minHeight: 100,
            }}
          />

          <div>
            <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 8 }}>💡 Tips (Max 5)</div>
            {draft.tips.map((tip, idx) => (
              <div
                key={idx}
                style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "flex-start" }}
              >
                <textarea
                  value={tip}
                  onChange={(e) => {
                    const updated = [...draft.tips];
                    updated[idx] = e.target.value;
                    setDraft({ ...draft, tips: updated });
                  }}
                  placeholder={`Tip ${idx + 1}`}
                  rows={2}
                  style={{
                    padding: "12px 14px",
                    borderRadius: 12,
                    border: "1px solid rgba(0,0,0,0.18)",
                    resize: "vertical",
                    flex: 1,
                    fontSize: 16,
                    fontFamily: "inherit",
                    minHeight: 80,
                  }}
                />
                {draft.tips.length > 1 && (
                  <button
                    onClick={() => setDraft({ ...draft, tips: draft.tips.filter((_, i) => i !== idx) })}
                    title="Remove this tip"
                    style={{
                      padding: isMobile ? "10px 12px" : "10px 8px",
                      borderRadius: 8,
                      border: "1px solid rgba(220,38,38,0.35)",
                      background: "rgba(220,38,38,0.08)",
                      color: "#991b1b",
                      cursor: "pointer",
                      fontWeight: "bold",
                      marginTop: 10,
                      fontSize: 14,
                      minHeight: 44,
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
            {draft.tips.length < 5 && (
              <button
                onClick={() => setDraft({ ...draft, tips: [...draft.tips, ""] })}
                style={{
                  padding: 12,
                  borderRadius: 12,
                  border: "1px solid rgba(0,0,0,0.18)",
                  background: "#f5f5f5",
                  color: "#111",
                  cursor: "pointer",
                  fontWeight: 600,
                  width: "100%",
                  fontSize: 14,
                  minHeight: 44,
                }}
              >
                + Add another tip
              </button>
            )}
          </div>

          <div>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "12px 14px",
                borderRadius: 12,
                border: "1px solid rgba(0,0,0,0.18)",
                background: "#e8e8e8",
                cursor: "pointer",
                fontWeight: 600,
                userSelect: "none",
                color: "#111",
                fontSize: 14,
                width: "100%",
                boxSizing: "border-box",
                minHeight: 44,
              }}
            >
              📷 Add pictures ({draft.images.length}/5)
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => {
                  const newImages = Array.from(e.target.files ?? []);
                  const combined = [...draft.images, ...newImages].slice(-5);
                  setDraft({ ...draft, images: combined });
                }}
                style={{ display: "none" }}
              />
            </label>

            {draft.images.length > 0 && (
              <div style={{ display: "flex", gap: 8, marginTop: 10, overflow: "hidden" }}>
                {draft.images.map((file, idx) => (
                  <div
                    key={idx}
                    style={{
                      position: "relative",
                      width: 80,
                      height: 80,
                      borderRadius: 8,
                      overflow: "hidden",
                      flexShrink: 0,
                    }}
                  >
                    <img
                      src={URL.createObjectURL(file)}
                      alt={`preview-${idx}`}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                    <button
                      onClick={() => setDraft({ ...draft, images: draft.images.filter((_, i) => i !== idx) })}
                      title="Remove image"
                      style={{
                        position: "absolute",
                        top: 2,
                        right: 2,
                        width: 20,
                        height: 20,
                        borderRadius: "50%",
                        background: "rgba(0,0,0,0.6)",
                        color: "white",
                        border: "none",
                        cursor: "pointer",
                        padding: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 12,
                        fontWeight: "bold",
                      }}
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
            style={{
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.18)",
              minHeight: 44,
              fontSize: 16,
            }}
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {categoryEmoji(c.value)} {c.label}
              </option>
            ))}
          </select>

          <div style={{ fontSize: 12, opacity: 0.75 }}>
            Location: {draft.lat.toFixed(5)}, {draft.lng.toFixed(5)}
          </div>

          <button
            onClick={onSubmit}
            disabled={!draft.title.trim()}
            style={{
              marginTop: 6,
              padding: "12px 16px",
              borderRadius: 12,
              border: "none",
              cursor: draft.title.trim() ? "pointer" : "not-allowed",
              background: draft.title.trim() ? "#111" : "rgba(0,0,0,0.25)",
              color: "white",
              fontWeight: 700,
              minHeight: 44,
              fontSize: 16,
            }}
          >
            Create pin
          </button>
        </div>
      </div>
    </div>
  );
}

function TipsViewer({
  tips,
  isMobile,
  onClose,
}: {
  tips: string[];
  isMobile: boolean;
  onClose: () => void;
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10000,
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff9e6",
          boxShadow: "0 10px 40px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.6)",
          borderRadius: 4,
          padding: 20,
          maxWidth: isMobile ? "85vw" : 380,
          width: "100%",
          position: "relative",
          transform: "rotate(-2deg)",
          fontFamily: "'Segoe UI', Arial, sans-serif",
          color: "#333",
        }}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            border: "none",
            background: "transparent",
            fontSize: 20,
            cursor: "pointer",
            padding: "4px 8px",
            color: "#999",
            fontWeight: "bold",
          }}
        >
          ✕
        </button>

        <div
          style={{
            fontWeight: 700,
            fontSize: 16,
            marginBottom: 14,
            paddingRight: 24,
            color: "#222",
          }}
        >
          💡 Tips
        </div>

        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {tips.map((tip, idx) => (
            <li
              key={idx}
              style={{
                display: "flex",
                gap: 10,
                fontSize: 13,
                lineHeight: 1.5,
                color: "#333",
              }}
            >
              <span style={{ fontWeight: "bold", flexShrink: 0 }}>•</span>
              <span style={{ wordBreak: "break-word" }}>{tip}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function DeleteConfirm({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      onClick={onCancel}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        zIndex: 9999,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(400px, 100%)",
          background: "white",
          borderRadius: 16,
          padding: 24,
          boxShadow: "0 18px 48px rgba(0,0,0,0.22)",
          color: "#111",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 32, marginBottom: 12 }}>🗑️</div>
        <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 8, lineHeight: 1.4 }}>
          Are you sure you want to delete your pin? 😢
        </div>
        <div style={{ fontSize: 14, opacity: 0.85, marginBottom: 24 }}>
          It looked like a great place!
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <button
            onClick={onCancel}
            style={{
              padding: "10px 16px",
              borderRadius: 10,
              border: "1px solid rgba(0,0,0,0.18)",
              background: "white",
              color: "#111",
              cursor: "pointer",
              fontWeight: 800,
            }}
          >
            No
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: "10px 16px",
              borderRadius: 10,
              border: "none",
              background: "#dc2626",
              color: "white",
              cursor: "pointer",
              fontWeight: 800,
            }}
          >
            Yes, delete
          </button>
        </div>
      </div>
    </div>
  );
}
