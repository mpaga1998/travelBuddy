import { useEffect, useRef } from "react";
import mapboxgl, { Map as MapboxMap, Marker } from "mapbox-gl";
import { createRoot, type Root } from "react-dom/client";
import type { Pin } from "../pins/pinTypes";
import { categoryColor, categoryEmoji, MOBILE_BREAKPOINT } from "./mapConstants";
import { PinPopup } from "./PinPopup";

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
 * Renders markers for every pin + a Mapbox popup for the selected pin.
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

  // 1) Marker sync
  useEffect(() => {
    if (!map) return;
    const cache = markersRef.current;
    const keep = new Set(pins.map((p) => p.id));

    for (const [id, marker] of cache.entries()) {
      if (!keep.has(id)) {
        marker.remove();
        cache.delete(id);
      }
    }

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

      const marker = new mapboxgl.Marker({ element: el, anchor: "bottom" })
        .setLngLat([pin.lng, pin.lat])
        .addTo(map);
      cache.set(pin.id, marker);
    }

    return () => {
      // intentionally NOT clearing here on every pins update  we only diff.
    };
  }, [map, pins, onSelect]);

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

  // 2) Popup lifecycle
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

/**
 * Build a single marker DOM element  36x46 SVG teardrop droplet.
 */
function buildMarkerElement(pin: Pin): HTMLDivElement {
  const color = categoryColor(pin.category);
  const isHostel = pin.createdByType === "hostel";

  const wrapper = document.createElement("div");
  wrapper.style.width = "36px";
  wrapper.style.height = "46px";
  wrapper.style.position = "relative";
  wrapper.style.cursor = "pointer";
  wrapper.style.userSelect = "none";
  wrapper.style.filter = isHostel
    ? "drop-shadow(0 4px 6px rgba(0,0,0,0.35))"
    : "drop-shadow(0 3px 4px rgba(0,0,0,0.28))";
  wrapper.style.transition = "transform 0.15s ease";

  wrapper.addEventListener("mouseenter", () => {
    wrapper.style.transform = "translateY(-2px) scale(1.05)";
  });
  wrapper.addEventListener("mouseleave", () => {
    wrapper.style.transform = "";
  });

  const outerStroke = isHostel ? "#0f172a" : "rgba(255,255,255,0)";

  wrapper.innerHTML = `
    <svg width="36" height="46" viewBox="0 0 36 46" xmlns="http://www.w3.org/2000/svg" style="display:block;">
      ${isHostel ? `
        <path d="M18 1.5
                 C 9.5 1.5, 2.5 8.5, 2.5 17
                 C 2.5 26.5, 12 35, 18 44.5
                 C 24 35, 33.5 26.5, 33.5 17
                 C 33.5 8.5, 26.5 1.5, 18 1.5 Z"
              fill="${outerStroke}" />
      ` : ""}
      <path d="M18 ${isHostel ? 3 : 1}
               C ${isHostel ? "10.5 3, 4 9.5, 4 17" : "9 1, 2 8, 2 17"}
               C ${isHostel ? "4 26, 13 33.5, 18 43" : "2 26.5, 11.5 34, 18 44"}
               C ${isHostel ? "23 33.5, 32 26, 32 17" : "24.5 34, 34 26.5, 34 17"}
               C ${isHostel ? "32 9.5, 25.5 3, 18 3 Z" : "34 8, 27 1, 18 1 Z"}"
            fill="${color}"
            stroke="white"
            stroke-width="2"
            stroke-linejoin="round" />
    </svg>
    <div data-badge
         style="position:absolute; top:0; left:0; width:36px; height:36px;
                display:flex; align-items:center; justify-content:center;
                font-size:17px; line-height:1; pointer-events:none;
                filter: drop-shadow(0 1px 1px rgba(0,0,0,0.4));">
      ${categoryEmoji(pin.category)}
    </div>
  `;

  return wrapper;
}
