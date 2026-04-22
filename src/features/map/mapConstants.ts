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
    case "food": return "🍜";
    case "nightlife": return "🎧";
    case "sight": return "📸";
    case "shop": return "🛍️";
    case "beach": return "🏖️";
    default: return "📍";
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
