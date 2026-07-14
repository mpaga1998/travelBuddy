import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type Map as MapboxMap } from "mapbox-gl";
import { track } from '../../lib/analytics';

import type { Pin, PinCategory } from "../pins/pinTypes";
import {
  createPin,
  deletePin,
  toggleReaction,
  uploadPinImage,
} from "../pins/pinApi";
import { compressImage } from "../../lib/imageCompress";
import { checkContentAllowed, MODERATION_REJECTION_MESSAGE } from "../../lib/moderation";
import { toast } from "sonner";

import { ItineraryModal } from "../itinerary/ItineraryModal";
import { ImportFromLinkModal } from "../import/ImportFromLinkModal";
import type { SocialCandidate, SocialAttribution } from "../import/socialImportApi";
import { supabase } from "../../lib/supabaseClient";
import { getLocationNameFromCoordinates } from "../../lib/mapbox";
import { FeatureErrorBoundary } from "../../components/FeatureErrorBoundary";

import { MapCanvas } from "./MapCanvas";
import { PinLayer, PIN_INTERACTIVE_LAYERS } from "./PinLayer";
import { FilterBar } from "./FilterBar";
import { MapEmptyState } from "./MapEmptyState";
import { CompassButton } from "./CompassButton";
import { showImageLightbox } from "./lightbox";
import { DraftModal, type DraftPin } from "./modals/DraftModal";
import { MyMapDraftModal, type MyMapDraft } from "./modals/MyMapDraftModal";
import { TipsViewer } from "./modals/TipsViewer";
import { DeleteConfirm } from "./modals/DeleteConfirm";
import { useIsMobile } from "./hooks/useIsMobile";
import { useMapPins } from "./hooks/useMapPins";
import { useSavedPlaces } from "../savedPlaces/useSavedPlaces";
import type { SavedPlace } from "../savedPlaces/savedPlacesApi";

const ITINERARY_FEATURE_ENABLED = true;

function savedPlaceToPin(sp: SavedPlace): Pin {
  return {
    id: sp.id,
    title: sp.title,
    description: sp.note ?? '',
    category: (sp.category as PinCategory) ?? 'other',
    lat: sp.lat,
    lng: sp.lng,
    createdByLabel: sp.visited ? '✓ Visited' : 'Want to visit',
    createdByType: 'traveler',
    createdById: sp.userId,
    createdByAge: null,
    createdByHandle: null,
    likesCount: 0,
    dislikesCount: 0,
    bookmarkCount: 0,
    reportCount: 0,
    commentCount: 0,
    tips: [],
    imageUrls: [],
    createdAt: sp.createdAt,
  };
}

type MapViewProps = {
  onBack?: () => void;
  initialCenter?: { lng: number; lat: number } | null;
};

/**
 * Composition root for the map feature.
 *
 * Responsibilities:
 *   - Owns the Mapbox instance ref (filled by MapCanvas via onMapReady).
 *   - Owns the "what's happening" modal state: draft, My Map draft, tips
 *     viewer, delete confirmation. The modals themselves live in ./modals/
 *     and ./CompassButton.tsx / ./lightbox.ts (split out in F2.3) — this
 *     file only owns the state and wires callbacks.
 *   - Composes hooks (useMapPins, useSavedPlaces) and passes their slices to
 *     FilterBar and PinLayer.
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
  } = useMapPins(mapInstance);

  const savedPlacesHook = useSavedPlaces(currentUserId);

  // Pins to render — community pins when in a public mode, saved places in My Map mode.
  const displayPins = useMemo(
    () =>
      mapType === 'my_map'
        ? savedPlacesHook.places.map(savedPlaceToPin)
        : filteredPins,
    [mapType, savedPlacesHook.places, filteredPins]
  );

  // IDs of saved places that are already visited (drives gray marker).
  const visitedSavedIds = useMemo(
    () => new Set(savedPlacesHook.places.filter((p) => p.visited).map((p) => p.id)),
    [savedPlacesHook.places]
  );

  // --- Selection + draft + modals ----------------------------------------
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftPin | null>(null);
  const [myMapDraft, setMyMapDraft] = useState<MyMapDraft | null>(null);
  const [itineraryModalOpen, setItineraryModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [tipsViewerOpen, setTipsViewerOpen] = useState(false);
  const [viewerTips, setViewerTips] = useState<string[]>([]);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteConfirmPinId, setDeleteConfirmPinId] = useState<string | null>(null);
  const [emptyStateDismissed, setEmptyStateDismissed] = useState(false);

  // Keep refs of draft/selection so the map-click callback doesn't capture stale state.
  const draftRef = useRef<DraftPin | null>(null);
  useEffect(() => { draftRef.current = draft; }, [draft]);
  const myMapDraftRef = useRef<MyMapDraft | null>(null);
  useEffect(() => { myMapDraftRef.current = myMapDraft; }, [myMapDraft]);
  const selectedPinIdRef = useRef<string | null>(null);
  useEffect(() => { selectedPinIdRef.current = selectedPinId; }, [selectedPinId]);
  const mapTypeRef = useRef(mapType);
  useEffect(() => { mapTypeRef.current = mapType; }, [mapType]);

  const selectedPin: Pin | null = useMemo(
    () => displayPins.find((p) => p.id === selectedPinId) ?? null,
    [displayPins, selectedPinId]
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
    if (draftRef.current || myMapDraftRef.current) return;

    if (mapTypeRef.current === 'my_map') {
      const locationName = await getLocationNameFromCoordinates(lngLat.lng, lngLat.lat);
      setMyMapDraft({ lat: lngLat.lat, lng: lngLat.lng, title: locationName, note: '', category: 'other' });
      return;
    }

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

  // --- Social import (C4.1 — persist confirmed places to saved_places) -----
  // A1: the modal stays OPEN after selection so it can offer "share as a
  // public pin" — it closes itself via its Done button.
  const handlePlaceSelected = useCallback(
    async (candidate: SocialCandidate, attribution: SocialAttribution) => {
      mapRef.current?.flyTo({
        center: [candidate.lng, candidate.lat],
        zoom: 15,
        duration: 900,
      });
      try {
        const src = attribution.sourceUrl.includes('tiktok')
          ? 'tiktok'
          : attribution.sourceUrl.includes('pinterest')
          ? 'pinterest'
          : 'manual';
        await savedPlacesHook.add({
          title: candidate.name,
          lat: candidate.lat,
          lng: candidate.lng,
          category: candidate.type,
          city: candidate.city,
          source: src,
          sourceUrl: attribution.sourceUrl,
          sourceAuthor: attribution.author,
        });
        toast.success(`⭐ ${candidate.name} saved to My Map!`);
      } catch {
        toast.success(`📍 Showing ${candidate.name} on the map`);
      }
    },
    [savedPlacesHook]
  );

  // --- A1: publish an imported place as a public community pin --------------
  const handleShareAsPin = useCallback(
    async (candidate: SocialCandidate, attribution: SocialAttribution, platform: string) => {
      // Same moderation pre-flight as the draft-pin flow. The caption was
      // already moderated server-side during extraction, but the pin title +
      // context become standalone public content — check them as such.
      const allowed = await checkContentAllowed(
        [candidate.name, candidate.context].filter(Boolean).join('\n')
      );
      if (!allowed) {
        toast.error(MODERATION_REJECTION_MESSAGE);
        throw new Error('moderation rejected');
      }

      const CATEGORY_MAP: Record<string, PinCategory> = {
        food: 'food',
        sight: 'sight',
        nightlife: 'nightlife',
        shop: 'shop',
      };
      const category = CATEGORY_MAP[candidate.type] ?? 'other';
      const sourcePlatform = (['tiktok', 'pinterest', 'instagram'] as const).find(
        (p) => p === platform
      );

      await createPin({
        title: candidate.name,
        description: candidate.context,
        category,
        lat: candidate.lat,
        lng: candidate.lng,
        sourceUrl: attribution.sourceUrl,
        sourceAuthor: attribution.author,
        sourcePlatform,
      });
      track('pin_created', { category, via: 'social_import' });
      toast.success('📌 Shared as a public pin!');
      await reload();
    },
    [reload]
  );

  // --- Save community pin to My Map (C3.3) ---------------------------------
  const handleSaveToMyMap = useCallback(
    async (pin: Pin) => {
      try {
        await savedPlacesHook.savePin(pin);
        toast.success(`⭐ Saved to My Map!`);
      } catch (e) {
        toast.error('Failed to save to My Map.');
        console.error(e);
      }
    },
    [savedPlacesHook]
  );

  // --- My Map draft submit (C3.2) -----------------------------------------
  async function onSubmitMyMapDraft() {
    if (!myMapDraft) return;
    const title = myMapDraft.title.trim();
    if (!title) return;
    try {
      await savedPlacesHook.add({
        title,
        note: myMapDraft.note.trim() || undefined,
        category: myMapDraft.category,
        lat: myMapDraft.lat,
        lng: myMapDraft.lng,
        source: 'manual',
      });
      setMyMapDraft(null);
      toast.success('⭐ Place saved to My Map!');
    } catch (e) {
      console.error('My Map save failed:', e);
      toast.error('Failed to save place.');
    }
  }

  // --- Draft submit -------------------------------------------------------
  async function onSubmitDraft() {
    if (!draft) return;
    const title = draft.title.trim();
    if (!title) return;

    // 🛡️ 4.4: Pre-flight title + description + tips through OpenAI moderation
    // BEFORE we burn cycles on image compression / Supabase Storage uploads.
    // Fails open inside checkContentAllowed — see src/lib/moderation.ts.
    const moderationInput = [
      title,
      draft.description.trim(),
      ...draft.tips.map((t) => t.trim()).filter(Boolean),
    ]
      .filter(Boolean)
      .join('\n');
    const allowed = await checkContentAllowed(moderationInput);
    if (!allowed) {
      toast.error(MODERATION_REJECTION_MESSAGE);
      return;
    }

    const imageUrls: string[] = [];
    for (const file of draft.images) {
      // Client-side downscale before upload — same rationale as avatar.
      const compressed = await compressImage(file);
      const url = await uploadPinImage(compressed);
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
    track('pin_created', { category: draft.category });

    setDraft(null);
    await reload();
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
          onImportLink={() => setImportModalOpen(true)}
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
            pins={displayPins}
            selectedPin={selectedPin}
            onSelect={(p) => { setDraft(null); setSelectedPinId(p.id); }}
            onCloseSelection={() => { setSelectedPinId(null); setTipsViewerOpen(false); }}
            currentUserId={currentUserId}
            onReact={handleReact}
            onShowTips={(tips) => { setViewerTips(tips); setTipsViewerOpen(true); }}
            onShowImages={(urls) => showImageLightbox(urls)}
            onRequestDelete={handleRequestDelete}
            isMyMapMode={mapType === 'my_map'}
            visitedSavedIds={visitedSavedIds}
            savedPinIds={savedPlacesHook.savedPinIds}
            onSaveToMyMap={handleSaveToMyMap}
          />

          <CompassButton map={mapInstance} />

          {!loading && !savedPlacesHook.loading && mapRef.current && displayPins.length === 0 && !emptyStateDismissed && (
            <MapEmptyState
              onPlanTrip={() => setItineraryModalOpen(true)}
              onDropPin={() => setEmptyStateDismissed(true)}
            />
          )}

          {!loading && limitReached && (
            <div
              className={`absolute top-3 left-3 px-2.5 py-2 rounded-[10px] bg-white/90 border border-black/[0.08] shadow-[0_6px_18px_rgba(0,0,0,0.08)] ${isMobile ? "text-[13px]" : "text-sm"} text-gray-600`}
            >
              Showing 500 nearest pins — zoom in to see more
            </div>
          )}

          {/* ---- Draft-pin modal (public pins) ---- */}
          {draft && (
            <DraftModal
              draft={draft}
              isMobile={isMobile}
              setDraft={setDraft}
              onSubmit={onSubmitDraft}
            />
          )}

          {/* ---- My Map draft modal (saved_places) ---- */}
          {myMapDraft && (
            <MyMapDraftModal
              draft={myMapDraft}
              isMobile={isMobile}
              setDraft={setMyMapDraft}
              onSubmit={onSubmitMyMapDraft}
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

          {importModalOpen && (
            <FeatureErrorBoundary featureName="Import">
              <ImportFromLinkModal
                onClose={() => setImportModalOpen(false)}
                onPlaceSelected={handlePlaceSelected}
                onShareAsPin={handleShareAsPin}
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
