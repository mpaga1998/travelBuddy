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
  likesCount: number;
  dislikesCount: number;
  tips?: string[];
  imageUrls?: string[];
  createdAt: string;
};