import { useCallback, useEffect, useState } from 'react';
import { fetchFeed, type FeedPin } from './feedApi';
import { imgAvatar, imgPopup } from '../../lib/imageTransforms';
import { categoryEmoji } from '../map/mapConstants';
import type { PinCategory } from '../pins/pinTypes';

/**
 * 5.3: /feed — chronological timeline of pins from people the current user
 * follows. Cursor pagination via fetchFeed; "Load more" button at the
 * bottom appears only when the API returns a nextCursor.
 *
 * Empty states diverge so the user always knows what to do next:
 *   - noFollows: explain how the feed works and point at the map
 *   - follows but no pins: "Your feed is empty — your follows haven't
 *     pinned anything yet." (no CTA, just patience)
 *
 * Card design: author header (avatar + name + relative time), optional
 * image, title, description (clamped to 3 lines), action row. Author header
 * is clickable when the author has a handle — uses pushState + manual
 * popstate dispatch to bridge the home-grown router in App.tsx.
 */

interface FeedPageProps {
  onBack: () => void;
  /** Open the map view (no specific pin centering yet). */
  onOpenMap: () => void;
}

export function FeedPage({ onBack, onOpenMap }: FeedPageProps) {
  const [pins, setPins] = useState<FeedPin[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noFollows, setNoFollows] = useState(false);

  const loadInitial = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await fetchFeed();
      setPins(page.pins);
      setCursor(page.nextCursor);
      setNoFollows(page.noFollows);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load feed');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await fetchFeed(cursor);
      setPins((prev) => [...prev, ...page.pins]);
      setCursor(page.nextCursor);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load more');
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, loadingMore]);

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  return (
    <div className="min-h-screen bg-gray-50 text-[#111]">
      <header className="sticky top-0 z-10 flex items-center gap-3 px-4 sm:px-6 py-3 bg-white border-b border-black/[0.08]">
        <button
          type="button"
          onClick={onBack}
          className="px-3 py-1.5 rounded-md border border-black/15 bg-white text-sm font-medium hover:bg-gray-50"
        >
          ← Back
        </button>
        <h1 className="text-base font-semibold text-gray-700">Feed</h1>
        <button
          type="button"
          onClick={loadInitial}
          disabled={loading}
          className="ml-auto px-3 py-1.5 rounded-md border border-black/15 bg-white text-xs font-medium disabled:opacity-50"
        >
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
        {error && (
          <div className="mb-4 px-3.5 py-3 rounded-[10px] bg-red-100 text-red-900 text-sm border border-red-200">
            ❌ {error}
          </div>
        )}

        {loading && pins.length === 0 ? (
          <FeedSkeleton />
        ) : noFollows ? (
          <NoFollowsEmpty onOpenMap={onOpenMap} />
        ) : pins.length === 0 ? (
          <EmptyFeed />
        ) : (
          <>
            <div className="flex flex-col gap-4">
              {pins.map((pin) => (
                <FeedCard key={pin.id} pin={pin} onOpenMap={onOpenMap} />
              ))}
            </div>

            {cursor && (
              <div className="flex justify-center mt-6">
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="px-5 py-2 rounded-full border border-black/15 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  {loadingMore ? 'Loading…' : 'Load more'}
                </button>
              </div>
            )}

            {!cursor && pins.length > 0 && (
              <p className="text-center text-xs text-gray-400 mt-6">You're all caught up.</p>
            )}
          </>
        )}
      </main>
    </div>
  );
}

// ───────────────────────────── Sub-components ─────────────────────────────

function FeedCard({ pin, onOpenMap }: { pin: FeedPin; onOpenMap: () => void }) {
  const displayName =
    pin.authorRole === 'hostel' ? pin.authorHostelName ?? pin.authorUsername : pin.authorUsername;
  const heroImage = pin.imageUrls[0] ? imgPopup(pin.imageUrls[0]) : null;

  /**
   * Navigate to /u/<handle> via the home-grown router. PinPopup uses the
   * same pushState + manual popstate dispatch trick because both run
   * inside the main React tree but App.tsx watches pathname changes
   * through window listeners — pushing the URL without dispatching
   * popstate would leave App's state stale.
   */
  const goToAuthor = () => {
    if (!pin.authorHandle) return;
    window.history.pushState({}, '', `/u/${pin.authorHandle}`);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  return (
    <article className="bg-white rounded-2xl border border-black/[0.08] shadow-sm overflow-hidden">
      {/* Author header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          type="button"
          onClick={goToAuthor}
          disabled={!pin.authorHandle}
          className={`flex items-center gap-3 min-w-0 ${
            pin.authorHandle ? 'cursor-pointer hover:opacity-80' : 'cursor-default'
          }`}
          aria-label={pin.authorHandle ? `View @${pin.authorHandle}` : displayName}
        >
          {pin.authorAvatarUrl ? (
            <img
              src={imgAvatar(pin.authorAvatarUrl) ?? undefined}
              alt=""
              loading="lazy"
              decoding="async"
              className="w-9 h-9 rounded-full object-cover bg-gray-100 flex-shrink-0"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-base flex-shrink-0">
              🙂
            </div>
          )}
          <div className="min-w-0 text-left">
            <div className="text-sm font-semibold truncate">{displayName}</div>
            <div className="text-xs text-gray-500">
              {pin.authorHandle && <span>@{pin.authorHandle} · </span>}
              {formatRelativeTime(pin.createdAt)}
            </div>
          </div>
        </button>
      </div>

      {/* Optional image */}
      {heroImage && (
        <img
          src={heroImage}
          alt=""
          loading="lazy"
          decoding="async"
          className="w-full max-h-[420px] object-cover bg-gray-100"
        />
      )}

      {/* Body */}
      <div className="px-4 py-3">
        <h2 className="text-base font-bold text-[#111] mb-1.5">
          <span className="mr-1.5">{categoryEmoji(pin.category as PinCategory)}</span>
          {pin.title}
        </h2>
        {pin.description && (
          <p
            className="text-sm text-gray-700 leading-snug overflow-hidden"
            style={{
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {pin.description}
          </p>
        )}
      </div>

      {/* Footer actions */}
      <div className="flex items-center gap-2 px-4 py-3 border-t border-black/[0.06] bg-gray-50">
        <span className="text-xs text-gray-500 mr-auto">
          {pin.bookmarkCount > 0 && <>🔖 {pin.bookmarkCount}</>}
        </span>
        <button
          type="button"
          onClick={onOpenMap}
          className="px-3 py-1.5 rounded-md border border-black/15 bg-white text-xs font-semibold hover:bg-gray-100"
        >
          🗺️ View on map
        </button>
      </div>
    </article>
  );
}

function FeedSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="bg-white rounded-2xl border border-black/[0.08] overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="w-9 h-9 rounded-full bg-gray-200 animate-pulse" />
            <div className="flex-1">
              <div className="h-3 w-1/3 bg-gray-200 rounded animate-pulse mb-1.5" />
              <div className="h-2 w-1/4 bg-gray-200 rounded animate-pulse" />
            </div>
          </div>
          <div className="w-full h-48 bg-gray-200 animate-pulse" />
          <div className="px-4 py-3">
            <div className="h-4 w-2/3 bg-gray-200 rounded animate-pulse mb-2" />
            <div className="h-3 w-full bg-gray-200 rounded animate-pulse mb-1" />
            <div className="h-3 w-4/5 bg-gray-200 rounded animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

function NoFollowsEmpty({ onOpenMap }: { onOpenMap: () => void }) {
  return (
    <div className="bg-white rounded-2xl border border-black/[0.08] p-8 text-center">
      <div className="text-4xl mb-3">🧭</div>
      <h2 className="text-lg font-bold mb-2">Your feed is waiting</h2>
      <p className="text-sm text-gray-600 mb-5 max-w-sm mx-auto">
        Follow other travelers and hostels to see their pins here as they share new spots. Browse
        the map to find people whose recommendations you trust, then tap their name on any pin.
      </p>
      <button
        type="button"
        onClick={onOpenMap}
        className="px-5 py-2 rounded-full bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700"
      >
        Explore the map
      </button>
    </div>
  );
}

function EmptyFeed() {
  return (
    <div className="bg-white rounded-2xl border border-black/[0.08] p-8 text-center">
      <div className="text-4xl mb-3">🌅</div>
      <h2 className="text-lg font-bold mb-2">Nothing new yet</h2>
      <p className="text-sm text-gray-600 max-w-sm mx-auto">
        The travelers you follow haven't pinned anything recently. Check back later, or follow a
        few more people to make your feed livelier.
      </p>
    </div>
  );
}

// ────────────────────────── Helpers ───────────────────────────────────────

/**
 * Pretty-print a timestamp relative to now: "just now", "5m ago", "3h ago",
 * "2d ago". Falls back to "Mon 12 Apr" once we cross a week, since after
 * that "8 days ago" stops being intuitive. No deps — Intl.RelativeTimeFormat
 * would be overkill for five branches.
 */
function formatRelativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return '';
  const sec = Math.max(0, Math.round(ms / 1000));
  if (sec < 60) return 'just now';
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d ago`;
  const date = new Date(iso);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
