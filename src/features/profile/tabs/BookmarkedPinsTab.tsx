import { useEffect, useState } from 'react';
import { getMapsUrl } from '../../../lib/mapsUtils';
import { getMyBookmarkedPins } from '../profileApi';

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
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <button
          onClick={() => setSelectedPin(null)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: 18,
            color: '#2563eb',
            fontWeight: 600,
            marginBottom: 12,
            padding: 0,
            textAlign: 'left',
          }}
        >
          ← Back
        </button>

        {selectedPin.images && selectedPin.images.length > 0 && (
          <div
            style={{
              width: '100%',
              height: 200,
              borderRadius: 12,
              overflow: 'hidden',
              marginBottom: 16,
              background: '#f3f4f6',
            }}
          >
            <img
              src={selectedPin.images[0]}
              alt={selectedPin.title}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>
        )}

        <div
          style={{
            fontSize: isMobile ? 18 : 20,
            fontWeight: 700,
            color: '#111',
            marginBottom: 8,
          }}
        >
          {selectedPin.title}
        </div>

        {selectedPin.category && (
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: '#0066cc',
              background: 'rgba(0, 102, 204, 0.1)',
              borderRadius: 6,
              padding: '4px 10px',
              width: 'fit-content',
              textTransform: 'capitalize',
              marginBottom: 12,
            }}
          >
            {selectedPin.category}
          </div>
        )}

        {selectedPin.description && (
          <div style={{ fontSize: 14, color: '#333', lineHeight: 1.6, marginBottom: 16 }}>
            {selectedPin.description}
          </div>
        )}

        <div
          style={{
            display: 'flex',
            gap: 16,
            flexWrap: 'wrap',
            marginBottom: 16,
            paddingTop: 12,
            borderTop: '1px solid rgba(0,0,0,0.08)',
          }}
        >
          {selectedPin.bookmark_count > 0 && (
            <div
              style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 14, color: '#666' }}
            >
              <span>🔖</span>
              <span>{selectedPin.bookmark_count} bookmarks</span>
            </div>
          )}
          {selectedPin.likes_count > 0 && (
            <div
              style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 14, color: '#666' }}
            >
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
            style={{
              width: '100%',
              padding: '12px 16px',
              borderRadius: 10,
              border: '2px solid #2563eb',
              background: 'white',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 600,
              color: '#2563eb',
              marginBottom: 16,
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLElement).style.background = 'rgba(37, 99, 235, 0.05)';
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLElement).style.background = 'white';
            }}
          >
            📍 Open in Maps
          </button>
        )}

        {selectedPin.tips && selectedPin.tips.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: '#666',
                marginBottom: 8,
                textTransform: 'uppercase',
              }}
            >
              Tips
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {selectedPin.tips.map((tip: string, idx: number) => (
                <div
                  key={idx}
                  style={{
                    fontSize: 13,
                    color: '#555',
                    padding: '6px 8px',
                    background: 'rgba(0,0,0,0.04)',
                    borderRadius: 6,
                  }}
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
    return (
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            border: '3px solid #e5e7eb',
            borderTop: '3px solid #2563eb',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }}
        />
        <div style={{ fontSize: 13, color: '#666', fontWeight: 500 }}>Loading saved pins…</div>
      </div>
    );
  }

  if (bookmarkedPins.length === 0) {
    return (
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          color: '#666',
        }}
      >
        <div style={{ fontSize: 32 }}>🔖</div>
        <div style={{ fontSize: 14, fontWeight: 500 }}>No saved pins yet</div>
        <div style={{ fontSize: 12, opacity: 0.75, textAlign: 'center' }}>
          Bookmark pins from the map to save them here
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)',
          gap: isMobile ? 12 : 16,
        }}
      >
        {bookmarkedPins.map((pin) => (
          <div
            key={pin.id}
            style={{
              display: 'flex',
              flexDirection: 'column',
              borderRadius: 12,
              border: '1px solid rgba(0,0,0,0.08)',
              overflow: 'hidden',
              background: 'white',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              minHeight: isMobile ? 140 : 160,
              touchAction: 'manipulation',
            }}
            onClick={() => setSelectedPin(pin)}
            role="button"
            tabIndex={0}
          >
            <div
              style={{
                flex: 1,
                background: '#f3f4f6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: isMobile ? 28 : 32,
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              {pin.images && pin.images.length > 0 ? (
                <img
                  src={pin.images[0]}
                  alt={pin.title}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={(e) => {
                    console.error(
                      `❌ Failed to load image for pin "${pin.title}": ${pin.images[0]}`,
                    );
                    e.currentTarget.style.display = 'none';
                  }}
                  onLoad={() => {
                    console.log(`✅ Loaded image for pin "${pin.title}": ${pin.images[0]}`);
                  }}
                />
              ) : (
                <div>📍</div>
              )}
            </div>

            <div
              style={{
                padding: isMobile ? 10 : 12,
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
            >
              <div
                style={{
                  fontSize: isMobile ? 12 : 13,
                  fontWeight: 600,
                  color: '#111',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {pin.title}
              </div>

              {pin.category && (
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 500,
                    color: '#0066cc',
                    background: 'rgba(0, 102, 204, 0.1)',
                    borderRadius: 4,
                    padding: '2px 6px',
                    width: 'fit-content',
                    textTransform: 'capitalize',
                  }}
                >
                  {pin.category}
                </div>
              )}

              {pin.bookmark_count > 0 && (
                <div style={{ fontSize: 10, color: '#666', marginTop: 2 }}>
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
