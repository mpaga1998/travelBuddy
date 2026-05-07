import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  fetchNotifications,
  markAllAsRead,
  markOneAsRead,
  type AppNotification,
  type NotificationKind,
} from './notificationsApi';
import { imgAvatar } from '../../lib/imageTransforms';

/**
 * 5.4: /notifications inbox.
 *
 * Renders the recipient's most recent notifications (newest first), with a
 * "Mark all read" button when there's anything unread. Each row shows the
 * actor's avatar, a sentence describing what happened, the relative time,
 * and an unread indicator. Clicking a row navigates to the relevant
 * resource (the pin's author profile for pin-related notifications, the
 * follower's profile for follow notifications).
 *
 * Mark-all-read is a deliberate choice over per-row "mark read" — it
 * matches the inbox affordance and keeps the read state simple. Auto-mark-
 * on-open is tempting but would let users miss the unread state entirely.
 * The button is one tap and sets a clear "I've reviewed these" intent.
 */

interface NotificationsPageProps {
  onBack: () => void;
  /** Open the map view, optionally centred on a specific pin location. */
  onOpenMap: (center?: { lat: number; lng: number }) => void;
}

export function NotificationsPage({ onBack, onOpenMap }: NotificationsPageProps) {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [marking, setMarking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchNotifications();
      setItems(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const unreadCount = items.filter((n) => n.readAt === null).length;

  const handleMarkAllRead = useCallback(async () => {
    if (marking || unreadCount === 0) return;
    // Optimistic — flip everything in local state, revert if the call throws.
    const now = new Date().toISOString();
    const prev = items;
    setItems(items.map((n) => (n.readAt === null ? { ...n, readAt: now } : n)));
    setMarking(true);
    try {
      await markAllAsRead();
    } catch (e) {
      setItems(prev);
      const message = e instanceof Error ? e.message : 'Failed to mark as read';
      toast.error(message);
    } finally {
      setMarking(false);
    }
  }, [items, marking, unreadCount]);

  /**
   * Click target depends on the notification kind:
   *   - like / bookmark / comment: open the map centred on the pin.
   *   - follow: navigate to the actor's public profile.
   * Either way, mark the notification as read immediately (optimistic).
   */
  const handleClick = useCallback(
    (n: AppNotification) => {
      // Optimistic mark-as-read for the clicked row.
      if (n.readAt === null) {
        const now = new Date().toISOString();
        setItems((prev) =>
          prev.map((item) => (item.id === n.id ? { ...item, readAt: now } : item))
        );
        // Fire-and-forget — failure is non-critical (user already sees it as read).
        markOneAsRead(n.id).catch((e) =>
          console.warn('[notifications] markOneAsRead failed:', e)
        );
      }

      if (n.kind === 'follow') {
        if (!n.actorHandle) return;
        window.history.pushState({}, '', `/u/${n.actorHandle}`);
        window.dispatchEvent(new PopStateEvent('popstate'));
        return;
      }

      // like, bookmark, or comment — navigate to the map centred on the pin.
      const center =
        n.pinLat != null && n.pinLng != null
          ? { lat: n.pinLat, lng: n.pinLng }
          : undefined;
      onOpenMap(center);
    },
    [onOpenMap]
  );

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
        <h1 className="text-base font-semibold text-gray-700">
          Notifications
          {unreadCount > 0 && (
            <span className="ml-2 inline-block px-2 py-0.5 rounded-full bg-red-500 text-white text-[11px] font-bold">
              {unreadCount}
            </span>
          )}
        </h1>
        <div className="ml-auto flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              disabled={marking}
              className="px-3 py-1.5 rounded-md border border-black/15 bg-white text-xs font-medium hover:bg-gray-50 disabled:opacity-50"
            >
              {marking ? 'Marking…' : 'Mark all read'}
            </button>
          )}
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="px-3 py-1.5 rounded-md border border-black/15 bg-white text-xs font-medium disabled:opacity-50"
          >
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
        {error && (
          <div className="mb-4 px-3.5 py-3 rounded-[10px] bg-red-100 text-red-900 text-sm border border-red-200">
            ❌ {error}
          </div>
        )}

        {loading && items.length === 0 ? (
          <Skeleton />
        ) : items.length === 0 ? (
          <Empty />
        ) : (
          <ul className="bg-white rounded-2xl border border-black/[0.08] shadow-sm overflow-hidden divide-y divide-black/[0.05]">
            {items.map((n) => (
              <NotificationRow key={n.id} notification={n} onClick={handleClick} />
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

// ───────────────────────────── Sub-components ─────────────────────────────

function NotificationRow({
  notification,
  onClick,
}: {
  notification: AppNotification;
  onClick: (n: AppNotification) => void;
}) {
  const isUnread = notification.readAt === null;
  const actorDisplayName =
    notification.actorRole === 'hostel'
      ? notification.actorHostelName ?? notification.actorUsername
      : notification.actorUsername;

  return (
    <li>
      <button
        type="button"
        onClick={() => onClick(notification)}
        className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors ${
          isUnread ? 'bg-blue-50/60 hover:bg-blue-50' : 'bg-white hover:bg-gray-50'
        }`}
      >
        {notification.actorAvatarUrl ? (
          <img
            src={imgAvatar(notification.actorAvatarUrl) ?? undefined}
            alt=""
            loading="lazy"
            decoding="async"
            className="w-10 h-10 rounded-full object-cover bg-gray-100 flex-shrink-0"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-base flex-shrink-0">
            🙂
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="text-sm text-[#111]">
            <span className="font-semibold">{actorDisplayName}</span>{' '}
            <span className="text-gray-700">{describeAction(notification)}</span>
          </div>
          <div className="text-xs text-gray-500 mt-0.5">
            {formatRelativeTime(notification.createdAt)}
          </div>
        </div>

        {isUnread && (
          <span
            aria-label="Unread"
            className="w-2 h-2 rounded-full bg-blue-600 flex-shrink-0 mt-2"
          />
        )}
      </button>
    </li>
  );
}

function Skeleton() {
  return (
    <div className="bg-white rounded-2xl border border-black/[0.08] divide-y divide-black/[0.05]">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-start gap-3 px-4 py-3">
          <div className="w-10 h-10 rounded-full bg-gray-200 animate-pulse flex-shrink-0" />
          <div className="flex-1">
            <div className="h-3 w-3/4 bg-gray-200 rounded animate-pulse mb-1.5" />
            <div className="h-2 w-1/4 bg-gray-200 rounded animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

function Empty() {
  return (
    <div className="bg-white rounded-2xl border border-black/[0.08] p-8 text-center">
      <div className="text-4xl mb-3">🔔</div>
      <h2 className="text-lg font-bold mb-2">No notifications yet</h2>
      <p className="text-sm text-gray-600 max-w-sm mx-auto">
        When someone likes or bookmarks one of your pins, or follows you, it'll show up here.
      </p>
    </div>
  );
}

// ────────────────────────── Helpers ───────────────────────────────────────

function describeAction(n: AppNotification): string {
  // Verb per kind. Pin title is folded into the sentence when present.
  const verbForPin: Record<Exclude<NotificationKind, 'follow'>, string> = {
    like: 'liked',
    bookmark: 'bookmarked',
    comment: 'commented on',
  };

  switch (n.kind) {
    case 'follow':
      return 'started following you';
    case 'like':
    case 'bookmark':
    case 'comment': {
      const verb = verbForPin[n.kind];
      return n.pinTitle ? `${verb} your pin "${n.pinTitle}"` : `${verb} your pin`;
    }
  }
}

/** Same shape as feed/FeedPage helper; kept local to avoid a shared util. */
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
