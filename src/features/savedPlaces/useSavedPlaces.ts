import { useCallback, useEffect, useState } from 'react';
import {
  listSavedPlaces,
  addSavedPlace,
  updateSavedPlace,
  deleteSavedPlace,
  saveCommunityPin,
  type SavedPlace,
  type AddSavedPlaceInput,
} from './savedPlacesApi';
import type { Pin } from '../pins/pinTypes';

export function useSavedPlaces(userId: string | null) {
  const [places, setPlaces] = useState<SavedPlace[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Load ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    if (!userId) {
      setPlaces([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    listSavedPlaces()
      .then((data) => {
        if (!cancelled) setPlaces(data);
      })
      .catch(console.error)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  // ── Mutations ─────────────────────────────────────────────────────────────

  const add = useCallback(async (input: AddSavedPlaceInput): Promise<SavedPlace> => {
    const place = await addSavedPlace(input);
    setPlaces((prev) => [place, ...prev]);
    return place;
  }, []);

  const savePin = useCallback(async (pin: Pin): Promise<SavedPlace> => {
    const place = await saveCommunityPin(pin);
    setPlaces((prev) => [place, ...prev]);
    return place;
  }, []);

  const update = useCallback(
    async (id: string, patch: { title?: string; note?: string; visited?: boolean; category?: string }) => {
      await updateSavedPlace(id, patch);
      setPlaces((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ...patch } : p))
      );
    },
    []
  );

  const toggleVisited = useCallback(async (id: string) => {
    const place = places.find((p) => p.id === id);
    if (!place) return;
    const next = !place.visited;
    // Optimistic update first
    setPlaces((prev) => prev.map((p) => (p.id === id ? { ...p, visited: next } : p)));
    try {
      await updateSavedPlace(id, { visited: next });
    } catch (err) {
      // Roll back on failure
      setPlaces((prev) => prev.map((p) => (p.id === id ? { ...p, visited: place.visited } : p)));
      throw err;
    }
  }, [places]);

  const remove = useCallback(async (id: string) => {
    // Optimistic remove
    setPlaces((prev) => prev.filter((p) => p.id !== id));
    try {
      await deleteSavedPlace(id);
    } catch (err) {
      // Roll back: reload from server
      listSavedPlaces().then(setPlaces).catch(console.error);
      throw err;
    }
  }, []);

  // ── Derived helpers ───────────────────────────────────────────────────────

  /** Set of community pin IDs the user has already saved — used for the ★ button state. */
  const savedPinIds = new Set(
    places.filter((p) => p.pinId != null).map((p) => p.pinId as string)
  );

  return { places, loading, add, savePin, update, toggleVisited, remove, savedPinIds };
}
