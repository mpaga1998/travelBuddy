import { useCallback, useEffect, useMemo, useState } from "react";
import type { Pin, PinCategory } from "../../pins/pinTypes";
import { listPins } from "../../pins/pinApi";
import { isAgeInSelectedRanges, type MapType } from "../mapConstants";

/**
 * Owns the pin list + all the filter knobs. `filteredPins` is derived so no
 * component downstream has to reimplement the rules.
 *
 * Kept deliberately dumb about how pins are CREATED / DELETED — the caller
 * mutates via `pinApi` directly then calls `reload()`. We keep that boundary
 * here because pin creation involves an image-upload side-channel that
 * doesn't fit naturally inside a data hook.
 *
 * Future step 3.1 will add viewport-bounded fetching here; the API surface
 * stays the same, `reload()` just takes bounds.
 */
export function useMapPins(bookmarkedPinIds: Set<string>) {
  const [pins, setPins] = useState<Pin[]>([]);
  const [loading, setLoading] = useState(true);

  const [mapType, setMapType] = useState<MapType>("travelers");
  const [activeCategory, setActiveCategory] = useState<PinCategory | "all">("all");
  const [selectedAgeRanges, setSelectedAgeRanges] = useState<string[]>([]);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listPins();
      setPins(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

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
