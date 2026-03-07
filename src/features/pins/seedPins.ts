import type { Pin } from "./pinTypes";

export const seedPins: Pin[] = [
  {
    id: "seed-1",
    title: "Miradouro da Senhora do Monte",
    description: "Sunset top spot, molto backpacker-friendly.",
    category: "sight",
    lat: 38.7209,
    lng: -9.1336,
    createdByLabel: "Yes! Hostel Lisbon",
    createdByType: "hostel",
    createdById: "h1",
    createdByAge: null,
    likesCount: 12,
    dislikesCount: 0,
    createdAt: new Date().toISOString(),
  },
  {
    id: "seed-2",
    title: "Time Out Market",
    description: "Food court ottimo per provare tante cose.",
    category: "food",
    lat: 38.7082,
    lng: -9.1450,
    createdByLabel: "Marco",
    createdByType: "traveler",
    createdById: "u2",
    createdByAge: 28,
    likesCount: 5,
    dislikesCount: 0,
    createdAt: new Date().toISOString(),
  },
];