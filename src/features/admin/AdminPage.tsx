import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useConfirm } from '../../components/ConfirmDialog';
import { imgThumbnail } from '../../lib/imageTransforms';
import {
  applyAdminAction,
  fetchAdminPins,
  type AdminAction,
  type AdminPin,
  type AdminPinsResponse,
} from './adminApi';

/**
 * 4.5: Admin moderation dashboard at /admin.
 *
 * Two sections side-by-side:
 *   - Reported (visible) — pins with report_count > 0 still visible. Action: Hide.
 *   - Hidden — pins currently hidden. Actions: Restore, Delete (permanent).
 *
 * Visibility of this route is gated upstream in App.tsx via isCurrentUserAdmin().
 * Non-admins see a generic "Not found" page (rendered by App, not this file)
 * so the URL doesn't reveal admin tooling exists.
 *
 * After every action we re-fetch — the queue is small enough (200/200 cap)
 * that a full reload is simpler than reasoning about local state diffs.
 */

interface AdminPageProps {
  onBack: () => void;
}

export function AdminPage({ onBack }: AdminPageProps) {
  const confirm = useConfirm();
  const [data, setData] = useState<AdminPinsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await fetchAdminPins();
      setData(next);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const handleAction = useCallback(
    async (pin: AdminPin, action: AdminAction) => {
      // Confirm-gate destructive ones. "Hide" is reversible so we let it
      // through without a prompt to keep the queue snappy.
      if (action !== 'hide') {
        const labels: Record<Exclude<AdminAction, 'hide'>, { title: string; confirm: string; destructive: boolean }> = {
          restore: { title: `Restore "${pin.title}"?`, confirm: 'Restore', destructive: false },
          delete: { title: `Delete "${pin.title}" permanently?`, confirm: 'Delete', destructive: true },
        };
        const { title, confirm: confirmLabel, destructive } = labels[action];
        const ok = await confirm({
          title,
          message:
            action === 'delete'
              ? 'This cannot be undone. The pin row, its reports, reactions, and bookmarks will all be removed.'
              : 'The pin will be visible on the map again. Reports stay on file.',
          confirmLabel,
          destructive,
        });
        if (!ok) return;
      }

      try {
        await applyAdminAction(pin.id, action);
        toast.success(
          action === 'hide'
            ? 'Pin hidden'
            : action === 'restore'
              ? 'Pin restored'
              : 'Pin deleted'
        );
        await reload();
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Action failed';
        toast.error(message);
      }
    },
    [confirm, reload]
  );

  return (
    <div className="min-h-screen bg-gray-50 text-[#111]">
      <header className="sticky top-0 z-10 flex items-center gap-3 px-5 py-3 bg-white border-b border-black/[0.08]">
        <button
          type="button"
          onClick={onBack}
          className="px-3 py-1.5 rounded-md border border-black/15 bg-white text-sm font-medium hover:bg-gray-50"
        >
          ← Back
        </button>
        <h1 className="text-lg font-bold">🛡️ Moderation</h1>
        <div className="ml-auto flex items-center gap-2 text-xs text-gray-500">
          {data && (
            <>
              <span>{data.reported.length} reported</span>
              <span>·</span>
              <span>{data.hidden.length} hidden</span>
            </>
          )}
          <button
            type="button"
            onClick={reload}
            disabled={loading}
            className="ml-2 px-3 py-1.5 rounded-md border border-black/15 bg-white text-xs font-medium disabled:opacity-50"
          >
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </header>

      <main className="px-5 py-6 max-w-6xl mx-auto">
        {error && (
          <div className="mb-4 px-3.5 py-3 rounded-[10px] bg-red-100 text-red-900 text-sm border border-red-200">
            ❌ {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Section
            title="Reported"
            empty="No reported pins right now."
            pins={data?.reported ?? []}
            loading={loading && !data}
            renderActions={(pin) => (
              <button
                type="button"
                onClick={() => handleAction(pin, 'hide')}
                className="px-3 py-1.5 rounded-md bg-amber-500 text-white text-xs font-semibold hover:bg-amber-600"
              >
                Hide
              </button>
            )}
          />

          <Section
            title="Hidden"
            empty="No hidden pins."
            pins={data?.hidden ?? []}
            loading={loading && !data}
            renderActions={(pin) => (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleAction(pin, 'restore')}
                  className="px-3 py-1.5 rounded-md bg-green-600 text-white text-xs font-semibold hover:bg-green-700"
                >
                  Restore
                </button>
                <button
                  type="button"
                  onClick={() => handleAction(pin, 'delete')}
                  className="px-3 py-1.5 rounded-md bg-red-600 text-white text-xs font-semibold hover:bg-red-700"
                >
                  Delete
                </button>
              </div>
            )}
          />
        </div>
      </main>
    </div>
  );
}

interface SectionProps {
  title: string;
  empty: string;
  pins: AdminPin[];
  loading: boolean;
  renderActions: (pin: AdminPin) => React.ReactNode;
}

function Section({ title, empty, pins, loading, renderActions }: SectionProps) {
  return (
    <section>
      <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500 mb-3">
        {title} {pins.length > 0 && <span className="text-gray-400">({pins.length})</span>}
      </h2>
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-32 rounded-xl bg-gray-200 animate-pulse" />
          ))}
        </div>
      ) : pins.length === 0 ? (
        <p className="text-sm text-gray-500 italic">{empty}</p>
      ) : (
        <div className="space-y-3">
          {pins.map((pin) => (
            <PinCard key={pin.id} pin={pin} actions={renderActions(pin)} />
          ))}
        </div>
      )}
    </section>
  );
}

interface PinCardProps {
  pin: AdminPin;
  actions: React.ReactNode;
}

function PinCard({ pin, actions }: PinCardProps) {
  const thumb = pin.imageUrls[0] ? imgThumbnail(pin.imageUrls[0]) : null;
  return (
    <article className="bg-white rounded-xl border border-black/[0.08] p-3 flex gap-3 shadow-sm">
      {thumb ? (
        <img
          src={thumb}
          alt=""
          loading="lazy"
          decoding="async"
          className="w-20 h-20 rounded-lg object-cover bg-gray-100 flex-shrink-0"
        />
      ) : (
        <div className="w-20 h-20 rounded-lg bg-gray-100 flex items-center justify-center text-2xl flex-shrink-0">
          📍
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-semibold text-sm truncate">{pin.title}</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {pin.category} · by {pin.authorLabel} · {pin.reportCount} report
              {pin.reportCount === 1 ? '' : 's'}
            </p>
          </div>
          <div className="flex-shrink-0">{actions}</div>
        </div>
        {pin.description && (
          <p className="text-xs text-gray-700 mt-1.5 line-clamp-2">{pin.description}</p>
        )}
        {pin.recentReports.length > 0 && (
          <ul className="mt-2 space-y-1">
            {pin.recentReports.map((r, i) => (
              <li
                key={i}
                className="text-xs text-gray-600 italic before:content-['—_'] before:text-gray-400"
              >
                {r.reason || '(no reason given)'}
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}
