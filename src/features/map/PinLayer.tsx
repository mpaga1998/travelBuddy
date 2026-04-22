import { useEffect, useRef } from "react";
import mapboxgl, { Map as MapboxMap, Marker } from "mapbox-gl";
import { createRoot, type Root } from "react-dom/client";
import type { Pin } from "../pins/pinTypes";
import { categoryEmoji, MOBILE_BREAKPOINT } from "./mapConstants";
import { PinPopup } from "./PinPopup";

export type PinLayerProps = {
  map: MapboxMap | null;
  pins: Pin[];
  /** Currently selected pin (for popup). `null` = no popup. */
  selectedPin: Pin | null;
  /** Fired when a marker is clicked. Parent decides what "selected" means. */
  onSelect: (pin: Pin) => void;
  /** Fired when the popup's close button or background is dismissed. */
  onCloseSelection: () => void;

  // Popup-content props (forwarded to PinPopup).
  currentUserId: string | null;
  bookmarkedPinIds: Set<string>;
  onReact: (pin: Pin, kind: "like" | "dislike") => void | Promise<void>;
  onToggleBookmark: (pin: Pin) => void | Promise<void>;
  onShowTips: (tips: string[]) => void;
  onShowImages: (urls: string[]) => void;
  onRequestDelete: (pin: Pin) => void;
};

/**
 * Renders markers for every pin + a Mapbox popup for the selected pin.
 *
 * Two effects here:
 *   1. Marker sync — diffs `pins` against a Map<pinId, Marker> cache.
 *      Old approach; kept for 2.1. Native clustering lands in 2.2 and will
 *      replace this effect with a GeoJSON source + cluster layers.
 *   2. Popup lifecycle — when `selectedPin` changes, tear down the old popup
 *      and build a new one. The popup's DOM content is a React tree rendered
 *      via createRoot(), so the heart/bookmark buttons are real components.
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
  const markersRef = useRef<Map<string, Marker>>(new Map());
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  const popupRootRef = useRef<Root | null>(null);
  const popupContainerRef = useRef<HTMLDivElement | null>(null);

  // --- 1) Marker sync -----------------------------------------------------
  useEffect(() => {
    if (!map) return;
    const cache = markersRef.current;
    const keep = new Set(pins.map((p) => p.id));

    // Remove markers for pins that filtered out.
    for (const [id, marker] of cache.entries()) {
      if (!keep.has(id)) {
        marker.remove();
        cache.delete(id);
      }
    }

    // Add/update markers.
    for (const pin of pins) {
      const existing = cache.get(pin.id);
      if (existing) {
        existing.setLngLat([pin.lng, pin.lat]);
        const badge = existing.getElement().querySelector<HTMLDivElement>("[data-badge]");
        if (badge) badge.textContent = categoryEmoji(pin.category);
        continue;
      }

      const el = buildMarkerElement(pin);
      el.addEventListener("click", (ev) => {
        ev.stopPropagation();
        onSelect(pin);
      });

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([pin.lng, pin.lat])
        .addTo(map);
      cache.set(pin.id, marker);
    }

    // Cleanup on full unmount.
    return () => {
      // intentionally NOT clearing here on every pins update — we only diff.
    };
  }, [map, pins, onSelect]);

  // Full teardown when the component unmounts or the map goes away.
  useEffect(() => {
    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current.clear();
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

  // --- 2) Popup lifecycle -------------------------------------------------
  useEffect(() => {
    if (!map) return;

    // Always tear down the previous popup first — keeps state clean.
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

    // Pan so the pin sits comfortably below popup area.
    map.easeTo({
      center: [pin.lng, pin.lat],
      duration: 400,
      padding: { top: 180, bottom: 80, left: 40, right: 40 },
    });

    // Build after pan completes — matches prior behavior.
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

      // Render the React tree INTO the popup's container.
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
    // We intentionally omit the callback props from the dep array: they
    // change every render (they close over parent state) and we don't
    // want to rebuild the popup each time. The callbacks inside PinPopup
    // read through the latest pin via closure in the render() above,
    // which is fine because selectedPin DOES trigger rebuilds.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, selectedPin]);

  // Re-render the popup's React tree when bookmark state or counts change
  // (so the popup UI stays in sync without rebuilding the Mapbox popup).
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

  return null; // all work happens via Mapbox side-effects
}

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
