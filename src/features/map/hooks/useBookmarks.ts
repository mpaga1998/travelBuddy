import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { toggleBookmark as toggleBookmarkApi } from "../../pins/pinApi";

/**
 * Owns the set of pin IDs the current user has bookmarked.
 *
 * - Fetches the initial set once on mount (and again when userId changes).
 * - Exposes `toggle(pinId)` that calls the pin API and updates the set.
 *   Updates are optimistic-on-success: we trust the server's returned boolean
 *   rather than racing the UI. If the API throws, the set is unchanged.
 */
export function useBookmarks(userId: string | null) {
  const [bookmarkedPinIds, setBookmarkedPinIds] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!userId) {
      setBookmarkedPinIds(new Set());
      setLoaded(true);
      return;
    }

    (async () => {
      const { data, error } = await supabase
        .from("pin_bookmarks")
        .select("pin_id")
        .eq("user_id", userId);

      if (cancelled) return;
      if (!error && data) {
        setBookmarkedPinIds(new Set(data.map((b) => b.pin_id)));
      }
      setLoaded(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const toggle = useCallback(async (pinId: string): Promise<boolean> => {
    const nowBookmarked = await toggleBookmarkApi(pinId);
    setBookmarkedPinIds((prev) => {
      const next = new Set(prev);
      if (nowBookmarked) next.add(pinId);
      else next.delete(pinId);
      return next;
    });
    return nowBookmarked;
  }, []);

  return { bookmarkedPinIds, toggle, loaded };
}
