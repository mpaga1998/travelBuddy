import type { Pin } from "./pinTypes";
import { seedPins } from "./seedPins";

const STORAGE_KEY = "backpack_demo_pins_v1";

// Inizializza LocalStorage se vuoto
function ensureInitialized() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seedPins));
  }
}

function readAll(): Pin[] {
  ensureInitialized();
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as Pin[];
  } catch {
    // se si corrompe, reset seed
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seedPins));
    return seedPins;
  }
}

function writeAll(pins: Pin[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(pins));
}

// (opzionale) Simula latenza di rete per rendere la demo più realistica
function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

export async function listPins(): Promise<Pin[]> {
  await sleep(200);
  return readAll();
}

export type CreatePinInput = Omit<
  Pin,
  "id" | "likesCount" | "likedBy" | "createdAt"
> & { id?: string }; // id opzionale

export async function createPin(input: CreatePinInput): Promise<Pin> {
  await sleep(200);

  const pins = readAll();
  const newPin: Pin = {
    ...input,
    id: input.id ?? crypto.randomUUID(),
    likesCount: 0,
    dislikesCount: 0,
    createdAt: new Date().toISOString(),
  };

  pins.unshift(newPin);
  writeAll(pins);
  return newPin;
}

export async function toggleLike(pinId: string, _userId: string): Promise<Pin> {
  await sleep(150);

  const pins = readAll();
  const idx = pins.findIndex((p) => p.id === pinId);
  if (idx === -1) throw new Error("Pin not found");

  const pin = pins[idx];

  const updated: Pin = {
    ...pin,
    likesCount: pin.likesCount + 1,
  };

  pins[idx] = updated;
  writeAll(pins);
  return updated;
}

// Utile per demo/debug: reset al seed
export function resetPinsToSeed() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(seedPins));
}