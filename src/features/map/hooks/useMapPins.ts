import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import type { Pin, PinCategory } from "../../pins/pinTypes";
import { listPins, type PinBounds } from "../../pins/pinApi";
import { isAgeInSelectedRanges, type MapType } from "../mapConstants";

/**
 * Owns the pin list + all the filter knobs. `filteredPins` is derived so no
 * component downstream has to reimplement the rules.
 *
 * Step 3.1: viewport-bounded fetching.
 *   - When a map instance is provided, pins are fetched only for the visible
 *     bbox plus a 20% buffer. Re-fetches on moveend with a 400ms debounce.
 *   - When mapType === "bookmarked", bounds are ignored so every bookmarked
 *     pin (regardless of position) is included.
 *   - Results are capped at 500; `limitReached` signals a "zoom in" nudge.
 */

const VIEWPORT_BUFFER = 0.2; // fraction of visible span to pad on each edge
const DEBOUNCE_MS = 400;

function getBoundsWithBuffer(map: MapboxMap): PinBounds {
  const b = map.getBounds();
  const west = b.getWest();
  const east = b.getEast();
  const south = b.getSouth();
  const north = b.getNorth();
  const dLat = (north - south) * VIEWPORT_BUFFER;
  const dLng = (east - west) * VIEWPORT_BUFFER;
  return {
    west: west - dLng,
    east: east + dLng,
    south: south - dLat,
    north: north + dLat,
  };
}

export function useMapPins(bookmarkedPinIds: Set<string>, map: MapboxMap | null) {
  const [pins, setPins] = useState<Pin[]>([]);
  const [loading, setLoading] = useState(true);
  const [limitReached, setLimitReached] = useState(false);

  const [mapType, setMapType] = useState<MapType>("travelers");
  const [activeCategory, setActiveCategory] = useState<PinCategory | "all">("all");
  const [selectedAgeRanges, setSelectedAgeRanges] = useState<string[]>([]);

  // Keep a ref so the moveend closure always reads the latest mapType without
  // re-registering the listener on every filter change.
  const mapTypeRef = useRef(mapType);
  useEffect(() => { mapTypeRef.current = mapType; }, [mapType]);

  const reload = useCallback(async (bounds?: PinBounds) => {
    setLoading(true);
    try {
      const { pins: data, limitReached: lr } = await listPins(bounds);
      setPins(data);
      setLimitReached(lr);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load + reload when mapType or map instance changes.
  useEffect(() => {
    if (mapType === "bookmarked" || !map) {
      // Bookmarked mode: fetch without bounds so off-screen bookmarks appear.
      // Also runs before the map is ready (map === null) so the list isn't empty.
      reload();
      return;
    }
    reload(getBoundsWithBuffer(map));
  }, [reload, mapType, map]);

  // Debounced moveend listener — only active when map is available and not in
  // bookmarked mode (bookmarked pins must always be fully visible).
  useEffect(() => {
    if (!map) return;

    let timer: ReturnType<typeof setTimeout> | null = null;

    const onMoveEnd = () => {
      if (mapTypeRef.current === "bookmarked") return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        reload(getBoundsWithBuffer(map));
      }, DEBOUNCE_MS);
    };

    map.on("moveend", onMoveEnd);
    return () => {
      map.off("moveend", onMoveEnd);
      if (timer) clearTimeout(timer);
    };
  }, [map, reload]);

  const filteredPins = useMemo(() => {
    return pins.filter((p) => {
      if (mapType === "bookmarked") return bookmarkedPinIds.has(p.id);

      const okCat = activeCategory === "all" ? true : p.category === activeCategory;
      const okAge = isAgeInSelectedRanges(p.createdByAge, selectedAgeRanges);
      const okType = mapType === "travelers"
        ? p.createdByType === "traveler"
        : p.createdByType === "hostel";
      return okCat && okAge && okType;
    });
  }, [pins, activeCategory, selectedAgeRanges, mapType, bookmarkedPinIds]);

  return {
    pins,
    filteredPins,
    loading,
    limitReached,
    reload,

    // filter state
    mapType,
    setMapType,
    activeCategory,
    setActiveCategory,
    selectedAgeRanges,
    setSelectedAgeRanges,
  };
}

