// Shared primitives pulled out of MapView so the split components can import
// them without creating a circular dependency through MapView.

import type { PinCategory } from "../pins/pinTypes";

export const DEFAULT_CENTER = { lng: -9.142685, lat: 38.736946 }; // Lisbon
export const DEFAULT_ZOOM = 12;
export const MOBILE_BREAKPOINT = 768;

export const CATEGORIES: { value: PinCategory; label: string }[] = [
  { value: "food", label: "Food" },
  { value: "nightlife", label: "Nightlife" },
  { value: "sight", label: "Sight" },
  { value: "shop", label: "Shop" },
  { value: "beach", label: "Beach" },
  { value: "other", label: "Other" },
];

export const AGE_RANGES = [
  { value: "18-24", label: "18-24", min: 18, max: 24 },
  { value: "25-34", label: "25-34", min: 25, max: 34 },
  { value: "35-49", label: "35-49", min: 35, max: 49 },
  { value: "50+", label: "50+", min: 50, max: 200 },
];

export function categoryEmoji(cat: PinCategory) {
  switch (cat) {
    case "food": return "\u{1F35C}";
    case "nightlife": return "\u{1F3A7}";
    case "sight": return "\u{1F4F8}";
    case "shop": return "\u{1F6CD}\uFE0F";
    case "beach": return "\u{1F3D6}\uFE0F";
    default: return "\u{1F4CD}";
  }
}

/**
 * Per-category accent color. Used by the droplet marker + (future) legend
 * and filter chips. Picked for contrast on both outdoors-v12 (warm beige)
 * and light-v11 (near-white), and to stay distinct when clustered.
 */
export function categoryColor(cat: PinCategory): string {
  switch (cat) {
    case "food":      return "#f59e0b"; // amber
    case "nightlife": return "#8b5cf6"; // violet
    case "sight":     return "#0ea5e9"; // sky
    case "shop":      return "#ec4899"; // pink
    case "beach":     return "#06b6d4"; // cyan
    default:          return "#64748b"; // slate
  }
}

export function isAgeInSelectedRanges(age: number | null, selectedRanges: string[]): boolean {
  if (!age || selectedRanges.length === 0) return true;
  return selectedRanges.some((rangeValue) => {
    const range = AGE_RANGES.find((r) => r.value === rangeValue);
    if (!range) return false;
    return age >= range.min && age <= range.max;
  });
}

export type MapType = "travelers" | "hostels" | "bookmarked";
