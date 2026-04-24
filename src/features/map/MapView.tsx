import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type Map as MapboxMap } from "mapbox-gl";

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
import { FeatureErrorBoundary } from "../../components/FeatureErrorBoundary";

import { MapCanvas } from "./MapCanvas";
import { PinLayer, PIN_INTERACTIVE_LAYERS } from "./PinLayer";
import { FilterBar } from "./FilterBar";
import { CATEGORIES, categoryEmoji } from "./mapConstants";
import { useIsMobile } from "./hooks/useIsMobile";
import { useBookmarks } from "./hooks/useBookmarks";
import { useMapPins } from "./hooks/useMapPins";

const ITINERARY_FEATURE_ENABLED = true;

// Shared input class for text/textarea/select in the draft modal.
const draftInputClass =
  "px-3.5 py-3 rounded-xl border border-black/[0.18] text-base min-h-[44px]";

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
  // Separate state so useMapPins can react when the map becomes available.
  const [mapInstance, setMapInstance] = useState<MapboxMap | null>(null);
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
    limitReached,
    reload,
    mapType,
    setMapType,
    activeCategory,
    setActiveCategory,
    selectedAgeRanges,
    setSelectedAgeRanges,
  } = useMapPins(bookmarkedPinIds, mapInstance);

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
    setMapInstance(map);
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
  // NOTE: uses DOM elements with Object.assign(el.style, …), not JSX style props.
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
      {/* Global styles targeting Mapbox's popup wrapper — we can't reach those
          nodes with Tailwind since they're created by mapbox-gl itself. */}
      <style>{`
        .pin-popup.mapboxgl-popup { padding: 16px !important; }
        .pin-popup.mapboxgl-popup .mapboxgl-popup-content {
          max-height: calc(100vh - 40px);
          overflow-y: auto;
          box-sizing: border-box;
        }
      `}</style>

      <div className="flex flex-col h-screen">
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

        {/* min-h-0 is required — without it a flex child refuses to shrink
            below its content's intrinsic size, and the absolute/inset-0 map
            container below ends up 0px tall on mobile. */}
        <div className="relative flex-1 min-h-0">
          <MapCanvas
            initialCenter={initialCenter}
            onMapReady={handleMapReady}
            onMapClick={handleMapClick}
            interactiveLayers={PIN_INTERACTIVE_LAYERS}
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

          {!loading && limitReached && (
            <div
              className={`absolute top-3 left-3 px-2.5 py-2 rounded-[10px] bg-white/90 border border-black/[0.08] shadow-[0_6px_18px_rgba(0,0,0,0.08)] ${isMobile ? "text-[13px]" : "text-sm"} text-gray-600`}
            >
              Showing 500 nearest pins — zoom in to see more
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

          {ITINERARY_FEATURE_ENABLED && itineraryModalOpen && (
            <FeatureErrorBoundary featureName="Itinerary">
              <ItineraryModal
                open={itineraryModalOpen}
                onClose={() => setItineraryModalOpen(false)}
              />
            </FeatureErrorBoundary>
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
      className={`fixed inset-0 bg-black/25 flex justify-center z-[1000] ${isMobile ? "items-end p-0" : "items-center p-4"}`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`bg-white shadow-[0_18px_48px_rgba(0,0,0,0.22)] ${
          isMobile
            ? "w-full rounded-t-2xl px-4 pt-4 pb-20 max-h-[90vh] overflow-auto"
            : "w-[min(520px,100%)] rounded-2xl p-4 overflow-visible"
        }`}
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
                    title="Remove this tip"
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
                className="p-3 rounded-xl border border-black/[0.18] bg-gray-100 text-[#111] cursor-pointer font-semibold w-full text-sm min-h-[44px]"
              >
                + Add another tip
              </button>
            )}
          </div>

          <div>
            <label className="flex items-center justify-center px-3.5 py-3 rounded-xl border border-black/[0.18] bg-[#e8e8e8] cursor-pointer font-semibold select-none text-[#111] text-sm w-full box-border min-h-[44px]">
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
                      title="Remove image"
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
                ? "cursor-pointer bg-[#111]"
                : "cursor-not-allowed bg-black/25"
            }`}
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
      className="fixed inset-0 flex items-center justify-center z-[10000] p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`bg-[#fff9e6] shadow-[0_10px_40px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.6)] rounded p-5 w-full relative -rotate-2 font-['Segoe_UI',Arial,sans-serif] text-[#333] ${
          isMobile ? "max-w-[85vw]" : "max-w-[380px]"
        }`}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-2 right-2 border-none bg-transparent text-xl cursor-pointer px-2 py-1 text-[#999] font-bold"
        >
          ✕
        </button>

        <div className="font-bold text-base mb-3.5 pr-6 text-[#222]">
          💡 Tips
        </div>

        <ul className="list-none p-0 m-0 flex flex-col gap-2.5">
          {tips.map((tip, idx) => (
            <li key={idx} className="flex gap-2.5 text-[13px] leading-normal text-[#333]">
              <span className="font-bold shrink-0">•</span>
              <span className="break-words">{tip}</span>
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
      className="fixed inset-0 bg-black/35 flex items-center justify-center p-4 z-[9999]"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[min(400px,100%)] bg-white rounded-2xl p-6 shadow-[0_18px_48px_rgba(0,0,0,0.22)] text-[#111] text-center"
      >
        <div className="text-[32px] mb-3">🗑️</div>
        <div className="font-extrabold text-base mb-2 leading-snug">
          Are you sure you want to delete your pin? 😢
        </div>
        <div className="text-sm opacity-85 mb-6">
          It looked like a great place!
        </div>
        <div className="flex gap-2.5 justify-center">
          <button
            onClick={onCancel}
            className="px-4 py-2.5 rounded-[10px] border border-black/[0.18] bg-white text-[#111] cursor-pointer font-extrabold"
          >
            No
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2.5 rounded-[10px] border-none bg-red-600 text-white cursor-pointer font-extrabold"
          >
            Yes, delete
          </button>
        </div>
      </div>
    </div>
  );
}
