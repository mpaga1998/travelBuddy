export type PinCategory =
  | "food"
  | "nightlife"
  | "sight"
  | "shop"
  | "beach"
  | "other";

export type Pin = {
  id: string;
  title: string;
  description: string;
  category: PinCategory;
  lat: number;
  lng: number;
  createdByLabel: string;
  createdByType: "traveler" | "hostel";
  createdById: string; // User ID of the creator
  createdByAge: number | null; // Age of the creator
  // 5.1: handle used to link the author label to /u/:handle. Null when the
  // creator hasn't picked a handle yet — the popup falls back to a plain
  // (non-clickable) label in that case.
  createdByHandle: string | null;
  likesCount: number;
  dislikesCount: number;
  bookmarkCount: number;
  reportCount: number;
  tips?: string[];
  imageUrls?: string[];
  createdAt: string;
};