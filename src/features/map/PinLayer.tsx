import { useEffect, useRef } from "react";
import mapboxgl, { Map as MapboxMap, GeoJSONSource } from "mapbox-gl";
import { createRoot, type Root } from "react-dom/client";
import type { Pin } from "../pins/pinTypes";
import { categoryEmoji, MOBILE_BREAKPOINT } from "./mapConstants";
import { PinPopup } from "./PinPopup";

// Source + layer ids  one place, no magic strings scattered.
const SRC = "pins";
const L_CLUSTERS = "pins-clusters";
const L_CLUSTER_COUNT = "pins-cluster-count";
const L_POINT = "pins-point";
const L_POINT_LABEL = "pins-point-label";

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
 * Native Mapbox clustering (2.2).
 *
 * Before: one HTMLElement marker per pin  dies past ~2k pins.
 * Now: a single GeoJSON source with cluster:true. Mapbox tiles the clusters
 * at render time; we only ship coordinates + a few flat properties per pin.
 *
 * Click semantics are unchanged from the upstream perspective  onSelect
 * still fires with a full Pin object, and the popup lifecycle effect below
 * is identical to 2.1.
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
  // Refs hold always-current versions of pins/onSelect so the Mapbox click
  // handlers (registered once at install-time) resolve against fresh values.
  const pinsRef = useRef<Pin[]>(pins);
  const onSelectRef = useRef(onSelect);
  useEffect(() => { pinsRef.current = pins; }, [pins]);
  useEffect(() => { onSelectRef.current = onSelect; }, [onSelect]);

  const popupRef = useRef<mapboxgl.Popup | null>(null);
  const popupRootRef = useRef<Root | null>(null);
  const popupContainerRef = useRef<HTMLDivElement | null>(null);

  // --- Install source + layers once the style is ready. -------------------
  useEffect(() => {
    if (!map) return;

    const install = () => {
      if (map.getSource(SRC)) return;

      map.addSource(SRC, {
        type: "geojson",
        data: pinsToFc(pinsRef.current),
        cluster: true,
        clusterRadius: 50,      // px  generous so dense areas aggregate
        clusterMaxZoom: 14,     // stop clustering past this (street-level)
      });

      // Cluster bubble  graduated by count, same hue family as unclustered.
      map.addLayer({
        id: L_CLUSTERS,
        type: "circle",
        source: SRC,
        filter: ["has", "point_count"],
        paint: {
          "circle-color": [
            "step", ["get", "point_count"],
            "#93c5fd", 10,   // <10  light blue
            "#3b82f6", 50,   // 10-49  blue
            "#1d4ed8",       // 50+  dark blue
          ],
          "circle-radius": [
            "step", ["get", "point_count"],
            18, 10, 24, 50, 30,
          ],
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });

      // Cluster count label. Mapbox ships Open Sans in every base style.
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

      // Unclustered point  mirrors the old 34px circle, black for hostels.
      map.addLayer({
        id: L_POINT,
        type: "circle",
        source: SRC,
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": [
            "case",
            ["==", ["get", "isHostel"], 1], "#111111",
            "#2563eb",
          ],
          "circle-radius": 14,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });

      // Emoji glyph on top of the unclustered circle.
      map.addLayer({
        id: L_POINT_LABEL,
        type: "symbol",
        source: SRC,
        filter: ["!", ["has", "point_count"]],
        layout: {
          "text-field": ["get", "emoji"],
          "text-size": 16,
          "text-allow-overlap": true,
          "text-ignore-placement": true,
        },
      });

      // Cluster click  zoom to expansion level.
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

      // Point click  resolve id to Pin and delegate to parent.
      map.on("click", L_POINT, (e) => {
        const feat = e.features?.[0];
        if (!feat) return;
        const pinId = feat.properties?.pinId as string | undefined;
        if (!pinId) return;
        const pin = pinsRef.current.find((p) => p.id === pinId);
        if (pin) onSelectRef.current(pin);
      });

      // Also handle the emoji label layer on top  clicks can land there.
      map.on("click", L_POINT_LABEL, (e) => {
        const feat = e.features?.[0];
        if (!feat) return;
        const pinId = feat.properties?.pinId as string | undefined;
        if (!pinId) return;
        const pin = pinsRef.current.find((p) => p.id === pinId);
        if (pin) onSelectRef.current(pin);
      });

      // Cursor affordances.
      for (const lyr of [L_CLUSTERS, L_POINT, L_POINT_LABEL]) {
        map.on("mouseenter", lyr, () => { map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", lyr, () => { map.getCanvas().style.cursor = ""; });
      }
    };

    if (map.isStyleLoaded()) install();
    else map.once("load", install);

    // Teardown on unmount / map swap. Guard each op  style may already be torn down.
    return () => {
      try {
        for (const l of [L_POINT_LABEL, L_POINT, L_CLUSTER_COUNT, L_CLUSTERS]) {
          if (map.getLayer(l)) map.removeLayer(l);
        }
        if (map.getSource(SRC)) map.removeSource(SRC);
      } catch {
        // style/map already gone  nothing to clean.
      }
    };
  }, [map]);

  // --- Data sync: push pins into the source whenever they change. ---------
  useEffect(() => {
    if (!map) return;
    const src = map.getSource(SRC) as GeoJSONSource | undefined;
    // If source isn't installed yet (style still loading), the install effect
    // will seed from pinsRef  nothing to do here.
    if (src) src.setData(pinsToFc(pins));
  }, [map, pins]);

  // --- Full teardown on unmount (popup ref cleanup). -----------------------
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

    map.easeTo({
      center: [pin.lng, pin.lat],
      duration: 400,
      padding: { top: 180, bottom: 80, left: 40, right: 40 },
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
        offset: [0, -18],        // lift clear of the 14px circle + stroke
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

  // Re-render popup content on count/bookmark changes without rebuilding popup.
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
        emoji: categoryEmoji(p.category),
        // Mapbox filter expressions cant compare strings cleanly, use 0/1.
        isHostel: p.createdByType === "hostel" ? 1 : 0,
      },
    })),
  };
}
