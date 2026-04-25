import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import type { Pin, PinCategory } from "../../pins/pinTypes";
import { listPins, type PinBounds, type PinFilters } from "../../pins/pinApi";
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

function getBoundsWithBuffer(map: MapboxMap): PinBounds | null {
  const b = map.getBounds();
  if (!b) return null;
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

  // Refs so the moveend/debounce closures always read the latest filter values
  // without needing to re-register listeners on every state change.
  const mapTypeRef = useRef(mapType);
  useEffect(() => { mapTypeRef.current = mapType; }, [mapType]);

  const activeCategoryRef = useRef(activeCategory);
  useEffect(() => { activeCategoryRef.current = activeCategory; }, [activeCategory]);

  // Monotonic counter so older overlapping fetches (e.g. mount-time + map-ready
  // races, rapid pan/filter changes) can't overwrite newer state. Each call
  // bumps the counter; the result is dropped if a newer call has started.
  const reqIdRef = useRef(0);

  const reload = useCallback(async (bounds?: PinBounds) => {
    const reqId = ++reqIdRef.current;
    setLoading(true);
    try {
      const mt = mapTypeRef.current;
      const cat = activeCategoryRef.current;

      const filters: PinFilters = { bounds };
      if (mt !== "bookmarked") {
        // Push category and creatorType to the SQL query to reduce data transfer.
        // Age ranges are intentionally excluded here — there is no created_by_age
        // column in the database; age is derived from profiles.dob in the mapping
        // layer. Age filtering remains in the client-side useMemo below.
        if (cat !== "all") filters.category = cat;
        if (mt === "travelers") filters.creatorType = "traveler";
        else if (mt === "hostels") filters.creatorType = "hostel";
      }

      const { pins: data, limitReached: lr } = await listPins(filters);
      // Stale response — a newer reload() has been dispatched. Drop silently
      // so the newer one's setPins is the last writer.
      if (reqId !== reqIdRef.current) return;
      setPins(data);
      setLimitReached(lr);
    } finally {
      // Only clear loading if we're still the latest request.
      if (reqId === reqIdRef.current) setLoading(false);
    }
  }, []);

  // Re-fetch when mapType, activeCategory, or map instance changes.
  // activeCategory is listed so the effect re-runs when the category chip
  // changes; by the time reload() executes, activeCategoryRef has been synced
  // (React runs effects in declaration order within the same render).
  useEffect(() => {
    // Bookmarked mode: fetch without bounds so off-screen bookmarks appear.
    // For traveler/hostel modes, wait for the map to mount before fetching —
    // otherwise we kick off an unbounded query that races the bounded one
    // dispatched milliseconds later when onMapReady fires, causing flicker.
    if (mapType === "bookmarked") {
      reload();
      return;
    }
    if (!map) return;
    reload(getBoundsWithBuffer(map) ?? undefined);
  }, [reload, mapType, activeCategory, map]);

  // Debounced moveend listener — only active when map is available and not in
  // bookmarked mode (bookmarked pins must always be fully visible).
  useEffect(() => {
    if (!map) return;

    let timer: ReturnType<typeof setTimeout> | null = null;

    const onMoveEnd = () => {
      if (mapTypeRef.current === "bookmarked") return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        reload(getBoundsWithBuffer(map) ?? undefined);
      }, DEBOUNCE_MS);
    };

    map.on("moveend", onMoveEnd);
    return () => {
      map.off("moveend", onMoveEnd);
      if (timer) clearTimeout(timer);
    };
  }, [map, reload]);

  // category and creatorType are now applied server-side in listPins.
  // This memo only handles:
  //   • bookmarked mode (pin-id set membership, purely client-side)
  //   • age ranges (no DB column — derived from profiles.dob at query time)
  const filteredPins = useMemo(() => {
    return pins.filter((p) => {
      if (mapType === "bookmarked") return bookmarkedPinIds.has(p.id);
      return isAgeInSelectedRanges(p.createdByAge, selectedAgeRanges);
    });
  }, [pins, selectedAgeRanges, mapType, bookmarkedPinIds]);

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

