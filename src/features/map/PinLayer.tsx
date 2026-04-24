import { useEffect, useRef } from "react";
import mapboxgl, { Map as MapboxMap, Marker, GeoJSONSource } from "mapbox-gl";
import { createRoot, type Root } from "react-dom/client";
import type { Pin } from "../pins/pinTypes";
import { categoryEmoji, MOBILE_BREAKPOINT } from "./mapConstants";
import { PinPopup } from "./PinPopup";

// Source + layer ids. Exported so MapCanvas can skip empty-map clicks that
// landed on the cluster bubble (see handleMapClick logic).
const SRC = "pins";
export const L_CLUSTERS = "pins-clusters";
export const L_CLUSTER_COUNT = "pins-cluster-count";

/** Layers whose clicks should NOT trigger the empty-map draft flow. */
export const PIN_INTERACTIVE_LAYERS = [L_CLUSTERS, L_CLUSTER_COUNT];

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
 * Hybrid clustering (2.2):
 *   - GeoJSON source with cluster:true handles aggregation.
 *   - Clusters render as native GL layers (circle + count)  scales to 10k+ pins.
 *   - Unclustered points render as HTML markers, synced from source features.
 *     Keeps emoji glyphs + lets DOM click handlers stopPropagation so the
 *     map's empty-click draft flow doesn't fire underneath.
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

  // HTML marker bookkeeping: markers by id (persisted), and those currently in DOM.
  const markersRef = useRef<globalThis.Map<string, Marker>>(new globalThis.Map());
  const markersOnScreenRef = useRef<globalThis.Map<string, Marker>>(new globalThis.Map());

  const popupRef = useRef<mapboxgl.Popup | null>(null);
  const popupRootRef = useRef<Root | null>(null);
  const popupContainerRef = useRef<HTMLDivElement | null>(null);

  // --- Install source + cluster GL layers once the style is ready. --------
  useEffect(() => {
    if (!map) return;

    const updateMarkers = () => {
      if (!map.getSource(SRC)) return;
      if (!map.isSourceLoaded(SRC)) return;

      const features = map.querySourceFeatures(SRC);
      const next = new globalThis.Map<string, Marker>();

      for (const feat of features) {
        const props = feat.properties;
        if (!props) continue;
        if (props.cluster) continue; // clusters handled by GL layer
        const pinId = props.pinId as string;
        if (!pinId) continue;
        const coords = (feat.geometry as GeoJSON.Point).coordinates as [number, number];

        let marker = markersRef.current.get(pinId);
        if (!marker) {
          const pin = pinsRef.current.find((p) => p.id === pinId);
          if (!pin) continue;
          const el = buildMarkerElement(pin);
          el.addEventListener("click", (ev) => {
            // Block the map's general click so handleMapClick doesn't open a draft.
            ev.stopPropagation();
            onSelectRef.current(pin);
          });
          marker = new mapboxgl.Marker({ element: el }).setLngLat(coords);
          markersRef.current.set(pinId, marker);
        } else {
          marker.setLngLat(coords);
        }

        next.set(pinId, marker);
        if (!markersOnScreenRef.current.has(pinId)) marker.addTo(map);
      }

      // Remove markers no longer on screen (clustered or viewport-culled).
      for (const [id, marker] of markersOnScreenRef.current) {
        if (!next.has(id)) marker.remove();
      }
      markersOnScreenRef.current = next;
    };

    const install = () => {
      if (map.getSource(SRC)) return;

      map.addSource(SRC, {
        type: "geojson",
        data: pinsToFc(pinsRef.current),
        cluster: true,
        clusterRadius: 50,
        clusterMaxZoom: 14,
      });

      map.addLayer({
        id: L_CLUSTERS,
        type: "circle",
        source: SRC,
        filter: ["has", "point_count"],
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
        source: SRC,
        filter: ["has", "point_count"],
        layout: {
          "text-field": ["get", "point_count_abbreviated"],
          "text-size": 13,
          "text-font": ["Open Sans Semibold", "Arial Unicode MS Bold"],
          "text-allow-overlap": true,
        },
        paint: { "text-color": "#ffffff" },
      });

      // Cluster click  zoom in to the expansion level.
      map.on("click", L_CLUSTERS, (e) => {
        const feat = e.features?.[0];
        if (!feat) return;
        const clusterId = feat.properties?.cluster_id;
        const src = map.getSource(SRC) as GeoJSONSource | undefined;
        if (!src || clusterId == null) return;
        src.getClusterExpansionZoom(clusterId, (err, zoom) => {
          if (err) return;
          const coords = (feat.geometry as GeoJSON.Point).coordinates as [number, number];
          map.easeTo({ center: coords, zoom: zoom ?? map.getZoom() + 2, duration: 400 });
        });
      });

      map.on("mouseenter", L_CLUSTERS, () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", L_CLUSTERS, () => { map.getCanvas().style.cursor = ""; });

      // Sync HTML markers every frame (guarded by isSourceLoaded). This matches
      // the Mapbox "cluster-html" example  cheap because the guard short-circuits.
      map.on("render", updateMarkers);
      // Run once now in case source is already loaded (HMR etc).
      updateMarkers();
    };

    if (map.isStyleLoaded()) install();
    else map.once("load", install);

    return () => {
      try {
        map.off("render", updateMarkers);
        for (const m of markersOnScreenRef.current.values()) m.remove();
        markersOnScreenRef.current.clear();
        markersRef.current.clear();
        if (map.getLayer(L_CLUSTER_COUNT)) map.removeLayer(L_CLUSTER_COUNT);
        if (map.getLayer(L_CLUSTERS)) map.removeLayer(L_CLUSTERS);
        if (map.getSource(SRC)) map.removeSource(SRC);
      } catch {
        // style/map already gone
      }
    };
  }, [map]);

  // --- Data sync: push pins into the source whenever they change. ---------
  useEffect(() => {
    if (!map) return;
    const src = map.getSource(SRC) as GeoJSONSource | undefined;
    if (src) src.setData(pinsToFc(pins));
    // Drop cached markers whose pin is gone  prevents stale DOM when a pin is deleted.
    const alive = new Set(pins.map((p) => p.id));
    for (const [id, marker] of markersRef.current) {
      if (!alive.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
        markersOnScreenRef.current.delete(id);
      }
    }
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

    // On mobile the popup (hero image + title + 3 button rows) can be
    // ~600px tall, so reserve most of the viewport above the pin. 180px was
    // fine on desktop but clipped the popup against the FilterBar on phones.
    const isMobileForPan = window.innerWidth < MOBILE_BREAKPOINT;
    const panTopPadding = isMobileForPan
      ? Math.min(window.innerHeight * 0.55, 520)
      : 180;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, selectedPin]);

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

/** Flatten pins into a GeoJSON FeatureCollection for the clustering source. */
function pinsToFc(pins: Pin[]): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: "FeatureCollection",
    features: pins.map((p) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [p.lng, p.lat] },
      properties: {
        pinId: p.id,
        category: p.category,
      },
    })),
  };
}

/** Original 2.1 marker  34px circle, emoji badge, black for hostels. */
function buildMarkerElement(pin: Pin): HTMLDivElement {
  const el = document.createElement("div");
  el.style.width = "34px";
  el.style.height = "34px";
  el.style.borderRadius = "999px";
  el.style.display = "flex";
  el.style.alignItems = "center";
  el.style.justifyContent = "center";
  el.style.cursor = "pointer";
  el.style.boxShadow = "0 6px 18px rgba(0,0,0,0.18)";
  el.style.border = "2px solid white";
  el.style.background = pin.createdByType === "hostel" ? "#111" : "#2563eb";
  el.style.color = "white";
  el.style.userSelect = "none";

  const badge = document.createElement("div");
  badge.setAttribute("data-badge", "1");
  badge.textContent = categoryEmoji(pin.category);
  badge.style.fontSize = "16px";
  el.appendChild(badge);

  return el;
}
