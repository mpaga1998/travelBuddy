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
  likesCount: number;
  dislikesCount: number;
  tips?: string[];
  imageUrls?: string[];
  createdAt: string;
};