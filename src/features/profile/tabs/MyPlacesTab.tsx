import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { getMapsUrl } from '../../../lib/mapsUtils';
import { Skeleton } from '../../../components/Skeleton';
import {
  listSavedPlaces,
  updateSavedPlace,
  deleteSavedPlace,
  type SavedPlace,
} from '../../savedPlaces/savedPlacesApi';
import { categoryEmoji } from '../../map/mapConstants';
import type { PinCategory } from '../../pins/pinTypes';

const SOURCE_LABEL: Record<string, string> = {
  manual: 'Added manually',
  tiktok: 'TikTok',
  pinterest: 'Pinterest',
  instagram: 'Instagram',
  community_pin: 'Community pin',
  itinerary: 'Itinerary',
};

function PlaceCard({
  place,
  isMobile,
  onClick,
}: {
  place: SavedPlace;
  isMobile: boolean;
  onClick: () => void;
}) {
  return (
    <div
      className={`flex flex-col rounded-xl border border-black/[0.08] overflow-hidden bg-white cursor-pointer transition-all shadow-[0_2px_8px_rgba(0,0,0,0.08)] ${isMobile ? 'min-h-[100px]' : 'min-h-[120px]'} touch-manipulation`}
      onClick={onClick}
      role="button"
      tabIndex={0}
    >
      <div
        className={`flex-1 bg-[#45B4B9]/10 flex items-center justify-center ${isMobile ? 'text-[28px]' : 'text-[32px]'} ${place.visited ? 'opacity-50' : ''}`}
      >
        {categoryEmoji((place.category as PinCategory) ?? 'other')}
      </div>

      <div className={`${isMobile ? 'p-2' : 'p-2.5'} flex flex-col gap-0.5`}>
        <div
          className={`${isMobile ? 'text-xs' : 'text-[13px]'} font-semibold text-slate-900 overflow-hidden text-ellipsis whitespace-nowrap`}
        >
          {place.title}
        </div>

        {place.city && (
          <div className="text-[10px] text-slate-400 overflow-hidden text-ellipsis whitespace-nowrap">
            {place.city}
          </div>
        )}

        <div className="flex items-center gap-1.5 mt-0.5">
          {place.visited && (
            <span className="text-[10px] bg-emerald-100 text-emerald-700 font-semibold px-1.5 py-0.5 rounded">
              ✓ Visited
            </span>
          )}
          <span className="text-[10px] text-slate-400">
            {SOURCE_LABEL[place.source] ?? place.source}
          </span>
        </div>
      </div>
    </div>
  );
}

function PlaceDetail({
  place: initial,
  isMobile,
  onBack,
  onDeleted,
}: {
  place: SavedPlace;
  isMobile: boolean;
  onBack: () => void;
  onDeleted: (id: string) => void;
}) {
  const [place, setPlace] = useState(initial);
  const [editingNote, setEditingNote] = useState(false);
  const [noteDraft, setNoteDraft] = useState(place.note ?? '');
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    const next = !place.visited;
    setPlace((p) => ({ ...p, visited: next }));
    try {
      await updateSavedPlace(place.id, { visited: next });
    } catch {
      setPlace((p) => ({ ...p, visited: !next }));
      toast.error('Failed to update.');
    }
  };

  const saveNote = async () => {
    setBusy(true);
    try {
      await updateSavedPlace(place.id, { note: noteDraft.trim() || undefined });
      setPlace((p) => ({ ...p, note: noteDraft.trim() || null }));
      setEditingNote(false);
      toast.success('Note saved.');
    } catch {
      toast.error('Failed to save note.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirm(`Remove "${place.title}" from My Map?`)) return;
    setBusy(true);
    try {
      await deleteSavedPlace(place.id);
      onDeleted(place.id);
      onBack();
    } catch {
      toast.error('Failed to delete.');
      setBusy(false);
    }
  };

  return (
    <div className="flex-1 overflow-auto p-4 flex flex-col gap-3">
      <button
        onClick={onBack}
        className="bg-transparent border-none cursor-pointer text-base text-blue-600 font-semibold p-0 text-left"
      >
        ← Back
      </button>

      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="text-4xl shrink-0">
          {categoryEmoji((place.category as PinCategory) ?? 'other')}
        </div>
        <div className="flex flex-col gap-1 min-w-0">
          <div className={`${isMobile ? 'text-lg' : 'text-xl'} font-bold text-slate-900 break-words`}>
            {place.title}
          </div>
          {place.city && (
            <div className="text-sm text-slate-400">{place.city}</div>
          )}
        </div>
      </div>

      {/* Visited toggle */}
      <button
        onClick={toggle}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-[10px] border-2 font-semibold text-sm cursor-pointer transition-all w-full ${
          place.visited
            ? 'border-emerald-600 bg-emerald-600 text-white'
            : 'border-emerald-600 bg-white text-emerald-700'
        }`}
      >
        {place.visited ? '✓ Visited' : '○ Mark as visited'}
      </button>

      {/* Note */}
      <div className="flex flex-col gap-1.5">
        <div className="text-xs font-semibold text-slate-500 uppercase">Note</div>
        {editingNote ? (
          <div className="flex flex-col gap-2">
            <textarea
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              rows={3}
              placeholder="Add a note…"
              className="px-3 py-2 rounded-lg border border-black/[0.18] text-sm resize-none"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={saveNote}
                disabled={busy}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold cursor-pointer border-none"
              >
                Save
              </button>
              <button
                onClick={() => { setEditingNote(false); setNoteDraft(place.note ?? ''); }}
                className="px-4 py-2 rounded-lg border border-black/[0.18] bg-white text-sm font-semibold cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div
            onClick={() => setEditingNote(true)}
            className="px-3 py-2 rounded-lg border border-black/[0.08] bg-gray-50 text-sm text-slate-600 cursor-pointer min-h-[40px] hover:bg-gray-100 transition-colors"
          >
            {place.note || <span className="text-slate-400 italic">Tap to add a note…</span>}
          </div>
        )}
      </div>

      {/* Source attribution */}
      {place.sourceUrl && (
        <div className="flex flex-col gap-1">
          <div className="text-xs font-semibold text-slate-500 uppercase">Source</div>
          <div className="text-xs text-slate-500">
            {SOURCE_LABEL[place.source] ?? place.source}
            {place.sourceAuthor && ` · @${place.sourceAuthor}`}
          </div>
          <a
            href={place.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 underline break-all"
          >
            View original
          </a>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-2 mt-auto pt-3 border-t border-black/[0.08]">
        <button
          onClick={() => window.open(getMapsUrl(place.lat, place.lng, place.title), '_blank')}
          className="w-full px-4 py-2.5 rounded-[10px] border-2 border-blue-600 bg-white text-blue-600 font-semibold text-sm cursor-pointer"
        >
          📍 Open in Maps
        </button>
        <button
          onClick={remove}
          disabled={busy}
          className="w-full px-4 py-2.5 rounded-[10px] border border-red-200 bg-white text-red-600 font-semibold text-sm cursor-pointer hover:bg-red-50 transition-colors"
        >
          Remove from My Map
        </button>
      </div>
    </div>
  );
}

export function MyPlacesTab({ isMobile }: { isMobile: boolean }) {
  const [places, setPlaces] = useState<SavedPlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SavedPlace | null>(null);
  const [filter, setFilter] = useState<'all' | 'want' | 'visited'>('all');

  useEffect(() => {
    (async () => {
      try {
        const data = await listSavedPlaces();
        setPlaces(data);
      } catch {
        setPlaces([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const onDeleted = (id: string) => setPlaces((prev) => prev.filter((p) => p.id !== id));

  if (selected) {
    return (
      <PlaceDetail
        place={selected}
        isMobile={isMobile}
        onBack={() => setSelected(null)}
        onDeleted={onDeleted}
      />
    );
  }

  const filtered =
    filter === 'want'
      ? places.filter((p) => !p.visited)
      : filter === 'visited'
      ? places.filter((p) => p.visited)
      : places;

  if (loading) {
    const n = isMobile ? 4 : 6;
    return (
      <div className="flex-1 overflow-auto p-4">
        <div className={`grid ${isMobile ? 'grid-cols-2 gap-3' : 'grid-cols-3 gap-4'}`}>
          {Array.from({ length: n }).map((_, i) => (
            <div key={i} className="rounded-xl border border-black/[0.08] overflow-hidden bg-white min-h-[120px]">
              <Skeleton className="h-[70px] rounded-none" />
              <div className="p-2.5 flex flex-col gap-1.5">
                <Skeleton className="h-3.5 w-3/4 rounded" />
                <Skeleton className="h-3 w-1/2 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto flex flex-col">
      {/* Filter bar */}
      <div className="px-4 pt-3 pb-2 flex gap-2">
        {(['all', 'want', 'visited'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border cursor-pointer transition-colors ${
              filter === f
                ? 'bg-[#45B4B9] border-[#45B4B9] text-white'
                : 'bg-white border-black/[0.18] text-slate-600'
            }`}
          >
            {f === 'all' ? 'All' : f === 'want' ? 'Want to visit' : 'Visited'}
          </button>
        ))}
        <span className="ml-auto text-xs text-slate-400 self-center">
          {places.length} place{places.length !== 1 ? 's' : ''}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-400 p-8 text-center">
          <div className="text-4xl">⭐</div>
          <div className="text-sm font-medium text-slate-500">
            {places.length === 0
              ? 'No places saved yet'
              : filter === 'visited'
              ? 'No visited places yet'
              : 'No want-to-visit places'}
          </div>
          {places.length === 0 && (
            <div className="text-xs opacity-75">
              Tap ⭐ on any pin, or tap the map in My Map mode
            </div>
          )}
        </div>
      ) : (
        <div className={`p-4 grid ${isMobile ? 'grid-cols-2 gap-3' : 'grid-cols-3 gap-4'}`}>
          {filtered.map((place) => (
            <PlaceCard
              key={place.id}
              place={place}
              isMobile={isMobile}
              onClick={() => setSelected(place)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
