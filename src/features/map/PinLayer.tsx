import { useEffect, useRef } from "react";
import mapboxgl, { Map as MapboxMap, GeoJSONSource } from "mapbox-gl";
import { createRoot, type Root } from "react-dom/client";
import Supercluster from "supercluster";
import type { Pin } from "../pins/pinTypes";
import { MOBILE_BREAKPOINT } from "./mapConstants";
import { PinPopup } from "./PinPopup";

// Two plain (non-clustering) GeoJSON sources — populated by Supercluster running in JS.
const SRC_CLUSTERS = "pins-clusters-src";
const SRC_POINTS = "pins-points-src";

export const L_CLUSTERS = "pins-clusters";
export const L_CLUSTER_COUNT = "pins-cluster-count";
// Native GL layers for unclustered individual pins.
// NOTE: if you add a PinCategory, update the 'match' expression in
// L_UNCLUSTERED_LABEL below AND the categoryEmoji helper in mapConstants.ts.
export const L_UNCLUSTERED = "pins-points";
export const L_UNCLUSTERED_LABEL = "pins-points-label";

/** All layer ids that should swallow a map click (not trigger the draft flow). */
export const PIN_INTERACTIVE_LAYERS = [
  L_CLUSTERS,
  L_CLUSTER_COUNT,
  L_UNCLUSTERED,
  L_UNCLUSTERED_LABEL,
];

/** Properties stored on each input point feature for the Supercluster index. */
type PinProps = { pinId: string; category: string; createdByType: string };

export type PinLayerProps = {
  map: MapboxMap | null;
  pins: Pin[];
  selectedPin: Pin | null;
  onSelect: (pin: Pin) => void;
  onCloseSelection: () => void;

  currentUserId: string | null;
  bookmarkedPinIds: Set<string>;
  onReact: (pin: Pin, kind: "like" | "dislike") => void | Promise<void>;
  onToggleBookmark: (pin: Pin) => void | Promise<void>;
  onShowTips: (tips: string[]) => void;
  onShowImages: (urls: string[]) => void;
  onRequestDelete: (pin: Pin) => void;
};

/**
 * Supercluster-based pin rendering — replaces the HTML-marker and cluster:true
 * approaches that both suffered from Mapbox's async cluster-recompute gap.
 *
 * Architecture:
 *   scRef holds a Supercluster index loaded with all pins. updateClusters()
 *   runs synchronously: getClusters() → split into cluster vs point features →
 *   setData on two plain GeoJSON sources → Mapbox re-renders instantly.
 *   Called on integer-zoom crossings, moveend, and whenever pins change.
 *   No HTML markers, no reconciliation loop, no flicker.
 */
export function PinLayer({
  map,
  pins,
  selectedPin,
  onSelect,
  onCloseSelection,
  currentUserId,
  bookmarkedPinIds,
  onReact,
  onToggleBookmark,
  onShowTips,
  onShowImages,
  onRequestDelete,
}: PinLayerProps) {
  // Refs kept fresh so the once-registered map listeners resolve latest values.
  const pinsRef = useRef<Pin[]>(pins);
  const onSelectRef = useRef(onSelect);
  useEffect(() => { pinsRef.current = pins; }, [pins]);
  useEffect(() => { onSelectRef.current = onSelect; }, [onSelect]);

  // Supercluster index — rebuilt whenever pins change.
  const scRef = useRef<Supercluster<PinProps>>(
    new Supercluster<PinProps>({ radius: 50, maxZoom: 14 })
  );
  // Tracks last integer zoom so we only re-cluster on zoom-level changes.
  const lastZoomRef = useRef<number>(-1);
  // Callable ref so the data-sync effect can trigger an update after rebuilding
  // the index, without depending on the install effect's closure.
  const updateClustersRef = useRef<(() => void) | null>(null);
  // Stash listeners for cleanup.
  const zoomListenerRef = useRef<(() => void) | null>(null);
  // Stash the unclustered-click handler for cleanup.
  const unclusteredClickRef = useRef<((e: mapboxgl.MapLayerMouseEvent) => void) | null>(null);

  const popupRef = useRef<mapboxgl.Popup | null>(null);
  const popupRootRef = useRef<Root | null>(null);
  const popupContainerRef = useRef<HTMLDivElement | null>(null);

  // --- Install sources + GL layers once map style is ready. ---------------
  useEffect(() => {
    if (!map) return;

    let destroyed = false;

    const updateClusters = () => {
      if (!map.getSource(SRC_CLUSTERS)) return;
      const zoom = Math.floor(map.getZoom());
      lastZoomRef.current = zoom;

      // World bbox — Mapbox handles viewport culling on the GL side.
      // getClusters() is synchronous: no async gap, no flicker.
      const all = scRef.current.getClusters([-180, -85, 180, 85], zoom);
      const isCluster = (f: (typeof all)[number]) =>
        (f.properties as { cluster?: boolean } | null)?.cluster === true;
      const clusterFeats = all.filter(isCluster);
      const pointFeats = all.filter((f) => !isCluster(f));

      (map.getSource(SRC_CLUSTERS) as GeoJSONSource).setData({
        type: "FeatureCollection",
        features: clusterFeats as GeoJSON.Feature[],
      });
      (map.getSource(SRC_POINTS) as GeoJSONSource).setData({
        type: "FeatureCollection",
        features: pointFeats as GeoJSON.Feature[],
      });
    };

    updateClustersRef.current = updateClusters;

    const install = () => {
      if (destroyed || map.getSource(SRC_CLUSTERS)) return;

      // Load all current pins into the index before adding sources.
      scRef.current.load(pinsToInput(pinsRef.current));

      map.addSource(SRC_CLUSTERS, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addSource(SRC_POINTS, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      // ── Cluster layers ──────────────────────────────────────────────
      map.addLayer({
        id: L_CLUSTERS,
        type: "circle",
        source: SRC_CLUSTERS,
        paint: {
          "circle-color": [
            "step", ["get", "point_count"],
            "#93c5fd", 10,
            "#3b82f6", 50,
            "#1d4ed8",
          ],
          "circle-radius": [
            "step", ["get", "point_count"],
            18, 10, 24, 50, 30,
          ],
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });

      map.addLayer({
        id: L_CLUSTER_COUNT,
        type: "symbol",
        source: SRC_CLUSTERS,
        layout: {
          "text-field": ["to-string", ["get", "point_count_abbreviated"]],
          "text-size": 13,
          "text-font": ["Open Sans Semibold", "Arial Unicode MS Bold"],
          "text-allow-overlap": true,
        },
        paint: { "text-color": "#ffffff" },
      });

      // ── Individual pin layers ───────────────────────────────────────
      // Circle background — black for hostels, blue for travelers.
      map.addLayer({
        id: L_UNCLUSTERED,
        type: "circle",
        source: SRC_POINTS,
        paint: {
          "circle-color": [
            "case",
            ["==", ["get", "createdByType"], "hostel"],
            "#111111",
            "#2563eb",
          ],
          "circle-radius": 17,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });

      // Emoji label. Keep in sync with PinCategory union in pinTypes.ts.
      map.addLayer({
        id: L_UNCLUSTERED_LABEL,
        type: "symbol",
        source: SRC_POINTS,
        layout: {
          "text-field": [
            "match", ["get", "category"],
            "food",      "🍽️",
            "nightlife", "🍻",
            "sight",     "📸",
            "shop",      "🛍️",
            "beach",     "🏖️",
            "📍",
          ],
          "text-size": 16,
          "text-allow-overlap": true,
          "text-ignore-placement": true,
          "text-font": ["Open Sans Semibold", "Arial Unicode MS Bold"],
        },
      });

      // ── Cluster click → zoom in (synchronous expansion zoom) ────────────
      map.on("click", L_CLUSTERS, (e) => {
        const feat = e.features?.[0];
        if (!feat?.properties) return;
        const clusterId = feat.properties.cluster_id as number | undefined;
        if (clusterId == null) return;
        const coords = (feat.geometry as GeoJSON.Point).coordinates as [number, number];
        try {
          const expansionZoom = scRef.current.getClusterExpansionZoom(clusterId);
          map.easeTo({ center: coords, zoom: expansionZoom, duration: 400 });
        } catch { /* stale cluster_id — safe to ignore */ }
      });

      map.on("mouseenter", L_CLUSTERS, () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", L_CLUSTERS, () => { map.getCanvas().style.cursor = ""; });

      // ── Unclustered pin click → select ──────────────────────────────
      const onUnclusteredClick = (e: mapboxgl.MapLayerMouseEvent) => {
        const f = e.features?.[0];
        if (!f?.properties) return;
        const pinId = f.properties.pinId as string | undefined;
        if (!pinId) return;
        const pin = pinsRef.current.find((p) => p.id === pinId);
        if (pin) onSelectRef.current(pin);
      };
      map.on("click", L_UNCLUSTERED, onUnclusteredClick);
      map.on("click", L_UNCLUSTERED_LABEL, onUnclusteredClick);
      map.on("mouseenter", L_UNCLUSTERED, () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", L_UNCLUSTERED, () => { map.getCanvas().style.cursor = ""; });
      unclusteredClickRef.current = onUnclusteredClick;

      // ── Re-cluster on integer-zoom changes and pan ────────────────────
      // Updating on every render frame is wasteful and unnecessary.
      // Integer-zoom crossings cover cluster-boundary transitions smoothly.
      // moveend handles pins newly entering the viewport after a pan.
      const onZoom = () => {
        if (Math.floor(map.getZoom()) !== lastZoomRef.current) updateClusters();
      };
      map.on("zoom", onZoom);
      map.on("moveend", updateClusters);
      zoomListenerRef.current = onZoom;

      // Initial population.
      updateClusters();
    };

    if (map.isStyleLoaded()) install();
    else map.once("load", install);

    return () => {
      destroyed = true;
      try {
        const onClick = unclusteredClickRef.current;
        if (onClick) {
          map.off("click", L_UNCLUSTERED, onClick);
          map.off("click", L_UNCLUSTERED_LABEL, onClick);
        }
        const onZoom = zoomListenerRef.current;
        if (onZoom) map.off("zoom", onZoom);
        map.off("moveend", updateClusters);
        if (map.getLayer(L_UNCLUSTERED_LABEL)) map.removeLayer(L_UNCLUSTERED_LABEL);
        if (map.getLayer(L_UNCLUSTERED)) map.removeLayer(L_UNCLUSTERED);
        if (map.getLayer(L_CLUSTER_COUNT)) map.removeLayer(L_CLUSTER_COUNT);
        if (map.getLayer(L_CLUSTERS)) map.removeLayer(L_CLUSTERS);
        if (map.getSource(SRC_POINTS)) map.removeSource(SRC_POINTS);
        if (map.getSource(SRC_CLUSTERS)) map.removeSource(SRC_CLUSTERS);
      } catch { /* style/map already gone */ }
    };
  }, [map]);

  // --- Data sync: rebuild Supercluster index and refresh whenever pins change.
  // Supercluster.load() is synchronous; updateClusters() calls setData() which
  // Mapbox applies instantly. No async gap, no reconciliation loop needed.
  useEffect(() => {
    if (!map) return;
    scRef.current.load(pinsToInput(pins));
    updateClustersRef.current?.();
  }, [map, pins]);

  // --- Popup ref cleanup on unmount. --------------------------------------
  useEffect(() => {
    return () => {
      if (popupRef.current) {
        popupRef.current.remove();
        popupRef.current = null;
      }
      if (popupRootRef.current) {
        popupRootRef.current.unmount();
        popupRootRef.current = null;
      }
    };
  }, []);

  // --- Popup lifecycle (unchanged from 2.1). -------------------------------
  useEffect(() => {
    if (!map) return;

    if (popupRef.current) {
      popupRef.current.remove();
      popupRef.current = null;
    }
    if (popupRootRef.current) {
      popupRootRef.current.unmount();
      popupRootRef.current = null;
    }

    if (!selectedPin) return;
    const pin = selectedPin;

    // Reserve enough space above the pin that the popup (capped at 75dvh
    // by PinPopup's wrapper — see that file's max-h class) ALWAYS fits in
    // the viewport after easeTo lands. The 0.78 multiplier puts the pin at
    // ~78% from the top of the screen, leaving 78% of viewport above it —
    // strictly more than the popup's 75dvh cap, so the top of the popup
    // can never extend above the visible map regardless of which pin the
    // user clicks. Earlier 0.55 was too tight when the popup grew with the
    // comments section in 5.5; bumping to 0.78 + tightening the popup's
    // own max-h is the coordinated fix.
    const isMobileForPan = window.innerWidth < MOBILE_BREAKPOINT;
    const panTopPadding = isMobileForPan
      ? Math.round(window.innerHeight * 0.78)
      : 240;
    map.easeTo({
      center: [pin.lng, pin.lat],
      duration: 400,
      padding: { top: panTopPadding, bottom: 80, left: 40, right: 40 },
    });

    const timer = window.setTimeout(() => {
      const isMobile = window.innerWidth < MOBILE_BREAKPOINT;
      const popupMaxWidth = isMobile
        ? `${Math.min(window.innerWidth * 0.9, 360)}px`
        : "400px";

      const container = document.createElement("div");
      popupContainerRef.current = container;

      const popup = new mapboxgl.Popup({
        closeButton: true,
        closeOnClick: false,
        maxWidth: popupMaxWidth,
        offset: [0, -10],
        anchor: "bottom",
        focusAfterOpen: false,
        className: "pin-popup",
      })
        .setLngLat([pin.lng, pin.lat])
        .setDOMContent(container)
        .addTo(map);

      popup.on("close", onCloseSelection);
      popupRef.current = popup;

      const root = createRoot(container);
      popupRootRef.current = root;
      root.render(
        <PinPopup
          pin={pin}
          currentUserId={currentUserId}
          isBookmarkedByUser={bookmarkedPinIds.has(pin.id)}
          onReact={(kind) => onReact(pin, kind)}
          onToggleBookmark={() => onToggleBookmark(pin)}
          onShowTips={onShowTips}
          onShowImages={onShowImages}
          onRequestDelete={() => onRequestDelete(pin)}
        />
      );
    }, 400);

    return () => {
      window.clearTimeout(timer);
    };
    // Depend only on selectedPin?.id (not the full object) so a re-fetch that
    // gives us a new Pin reference for the same pin doesn't tear down + rebuild
    // the popup. The content-refresh effect below handles re-rendering when
    // selectedPin's contents change (bookmarks, etc).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, selectedPin?.id]);

  useEffect(() => {
    if (!popupRootRef.current || !selectedPin) return;
    popupRootRef.current.render(
      <PinPopup
        pin={selectedPin}
        currentUserId={currentUserId}
        isBookmarkedByUser={bookmarkedPinIds.has(selectedPin.id)}
        onReact={(kind) => onReact(selectedPin, kind)}
        onToggleBookmark={() => onToggleBookmark(selectedPin)}
        onShowTips={onShowTips}
        onShowImages={onShowImages}
        onRequestDelete={() => onRequestDelete(selectedPin)}
      />
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPin, bookmarkedPinIds, currentUserId]);

  return null;
}

/** Build the input feature array for Supercluster.load(). */
function pinsToInput(pins: Pin[]): GeoJSON.Feature<GeoJSON.Point, PinProps>[] {
  return pins.map((p) => ({
    type: "Feature",
    geometry: { type: "Point", coordinates: [p.lng, p.lat] },
    properties: {
      pinId: p.id,
      category: p.category,
      createdByType: p.createdByType,
    },
  }));
}
