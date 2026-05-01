import { useEffect, useState } from 'react';
import { getMapsUrl } from '../../../lib/mapsUtils';
import { getMyBookmarkedPins } from '../profileApi';
import { Skeleton } from '../../../components/Skeleton';
import { imgThumbnail, imgDetail } from '../../../lib/imageTransforms';

export interface BookmarkedPinsTabProps {
  isMobile: boolean;
}

/**
 * Saved-pins tab. Loads the user's bookmarked pins on mount, renders a grid,
 * and drills into a single-pin detail view on click.
 */
export function BookmarkedPinsTab({ isMobile }: BookmarkedPinsTabProps) {
  const [bookmarkedPins, setBookmarkedPins] = useState<any[]>([]);
  const [loadingBookmarks, setLoadingBookmarks] = useState(true);
  const [selectedPin, setSelectedPin] = useState<any | null>(null);

  useEffect(() => {
    setLoadingBookmarks(true);
    (async () => {
      try {
        console.log('🔖 Fetching bookmarked pins...');
        const pins = await getMyBookmarkedPins();
        console.log('✅ Bookmarked pins fetched:', pins);
        setBookmarkedPins(pins);
      } catch (e: any) {
        console.error('❌ Failed to load bookmarked pins:', e?.message || e);
        setBookmarkedPins([]);
      } finally {
        setLoadingBookmarks(false);
      }
    })();
  }, []);

  if (selectedPin) {
    return (
      <div className="flex-1 overflow-auto p-4 flex flex-col">
        <button
          onClick={() => setSelectedPin(null)}
          className="bg-transparent border-none cursor-pointer text-lg text-blue-600 font-semibold mb-3 p-0 text-left"
        >
          ← Back
        </button>

        {selectedPin.images && selectedPin.images.length > 0 && (
          <div className="w-full h-[200px] rounded-xl overflow-hidden mb-4 bg-gray-100">
            <img
              src={imgDetail(selectedPin.images[0])}
              alt={selectedPin.title}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover"
            />
          </div>
        )}

        <div
          className={`${isMobile ? 'text-lg' : 'text-xl'} font-bold text-slate-900 mb-2`}
        >
          {selectedPin.title}
        </div>

        {selectedPin.category && (
          <div className="text-xs font-semibold text-[#0066cc] bg-[#0066cc]/10 rounded-md px-2.5 py-1 w-fit capitalize mb-3">
            {selectedPin.category}
          </div>
        )}

        {selectedPin.description && (
          <div className="text-sm text-slate-700 leading-relaxed mb-4">
            {selectedPin.description}
          </div>
        )}

        <div className="flex gap-4 flex-wrap mb-4 pt-3 border-t border-black/[0.08]">
          {selectedPin.bookmark_count > 0 && (
            <div className="flex items-center gap-1 text-sm text-slate-500">
              <span>🔖</span>
              <span>{selectedPin.bookmark_count} bookmarks</span>
            </div>
          )}
          {selectedPin.likes_count > 0 && (
            <div className="flex items-center gap-1 text-sm text-slate-500">
              <span>❤️</span>
              <span>{selectedPin.likes_count} likes</span>
            </div>
          )}
        </div>

        {selectedPin.lat && selectedPin.lng && (
          <button
            onClick={() =>
              window.open(
                getMapsUrl(selectedPin.lat, selectedPin.lng, selectedPin.title),
                '_blank',
              )
            }
            className="w-full px-4 py-3 rounded-[10px] border-2 border-blue-600 bg-white cursor-pointer text-sm font-semibold text-blue-600 mb-4 transition-colors hover:bg-blue-600/5"
          >
            📍 Open in Maps
          </button>
        )}

        {selectedPin.tips && selectedPin.tips.length > 0 && (
          <div className="mt-3">
            <div className="text-xs font-semibold text-slate-500 mb-2 uppercase">Tips</div>
            <div className="flex flex-col gap-1">
              {selectedPin.tips.map((tip: string, idx: number) => (
                <div
                  key={idx}
                  className="text-[13px] text-slate-600 px-2 py-1.5 bg-black/[0.04] rounded-md"
                >
                  • {tip}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (loadingBookmarks) {
    const placeholders = Array.from({ length: isMobile ? 4 : 6 });
    return (
      <div className="flex-1 overflow-auto p-4">
        <div className={`grid ${isMobile ? 'grid-cols-2 gap-3' : 'grid-cols-3 gap-4'}`}>
          {placeholders.map((_, i) => (
            <div
              key={i}
              className={`flex flex-col rounded-xl border border-black/[0.08] overflow-hidden bg-white shadow-[0_2px_8px_rgba(0,0,0,0.08)] ${isMobile ? 'min-h-[140px]' : 'min-h-[160px]'}`}
            >
              <Skeleton className="flex-1 min-h-[80px] rounded-none" />
              <div className={`${isMobile ? 'p-2.5' : 'p-3'} flex flex-col gap-1.5`}>
                <Skeleton className="h-3.5 w-3/4 rounded" />
                <Skeleton className="h-3 w-1/3 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (bookmarkedPins.length === 0) {
    return (
      <div className="flex-1 overflow-auto p-4 flex flex-col items-center justify-center gap-3 text-slate-500">
        <div className="text-3xl">🔖</div>
        <div className="text-sm font-medium">No saved pins yet</div>
        <div className="text-xs opacity-75 text-center">
          Bookmark pins from the map to save them here
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-4">
      <div
        className={`grid ${isMobile ? 'grid-cols-2 gap-3' : 'grid-cols-3 gap-4'}`}
      >
        {bookmarkedPins.map((pin) => (
          <div
            key={pin.id}
            className={`flex flex-col rounded-xl border border-black/[0.08] overflow-hidden bg-white cursor-pointer transition-all shadow-[0_2px_8px_rgba(0,0,0,0.08)] ${isMobile ? 'min-h-[140px]' : 'min-h-[160px]'} touch-manipulation`}
            onClick={() => setSelectedPin(pin)}
            role="button"
            tabIndex={0}
          >
            <div
              className={`flex-1 bg-gray-100 flex items-center justify-center ${isMobile ? 'text-[28px]' : 'text-[32px]'} overflow-hidden relative`}
            >
              {pin.images && pin.images.length > 0 ? (
                <img
                  src={imgThumbnail(pin.images[0])}
                  alt={pin.title}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    console.error(
                      `❌ Failed to load image for pin "${pin.title}": ${pin.images[0]}`,
                    );
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : (
                <div>📍</div>
              )}
            </div>

            <div className={`${isMobile ? 'p-2.5' : 'p-3'} flex flex-col gap-1`}>
              <div
                className={`${isMobile ? 'text-xs' : 'text-[13px]'} font-semibold text-slate-900 overflow-hidden text-ellipsis whitespace-nowrap`}
              >
                {pin.title}
              </div>

              {pin.category && (
                <div className="text-[10px] font-medium text-[#0066cc] bg-[#0066cc]/10 rounded px-1.5 py-0.5 w-fit capitalize">
                  {pin.category}
                </div>
              )}

              {pin.bookmark_count > 0 && (
                <div className="text-[10px] text-slate-500 mt-0.5">
                  🔖 {pin.bookmark_count}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
