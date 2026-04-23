import { useEffect, useState, type ReactNode } from 'react';
import { deleteItinerary, getMyItineraries, type SavedItinerary } from '../profileApi';

export interface SavedItinerariesTabProps {
  /** Called when the user asks to go back to the top-level menu. */
  onBackToMenu: () => void;
}

/**
 * Itineraries tab. Loads the user's saved itineraries on mount, renders the
 * list, and drills into a detail view with the formatted markdown on click.
 */
export function SavedItinerariesTab({ onBackToMenu }: SavedItinerariesTabProps) {
  const [savedItineraries, setSavedItineraries] = useState<SavedItinerary[]>([]);
  const [loadingItineraries, setLoadingItineraries] = useState(true);
  const [selectedItinerary, setSelectedItinerary] = useState<SavedItinerary | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    setLoadingItineraries(true);
    (async () => {
      try {
        console.log('📍 Fetching saved itineraries...');
        const itineraries = await getMyItineraries();
        console.log('✅ Saved itineraries fetched:', itineraries);
        setSavedItineraries(itineraries);
      } catch (e: any) {
        console.error('❌ Failed to load itineraries:', e?.message || e);
        setSavedItineraries([]);
      } finally {
        setLoadingItineraries(false);
      }
    })();
  }, []);

  async function onDeleteItinerary(itineraryId: string) {
    if (!window.confirm('🗑️ Are you sure you want to delete this itinerary?')) {
      return;
    }

    try {
      await deleteItinerary(itineraryId);
      setSavedItineraries(savedItineraries.filter((it) => it.id !== itineraryId));
      setMsg('Itinerary deleted.');
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to delete itinerary');
    }
  }

  if (selectedItinerary) {
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
          onClick={() => setSelectedItinerary(null)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: 18,
            color: '#9333ea',
            fontWeight: 600,
            marginBottom: 12,
            padding: 0,
            textAlign: 'left',
          }}
        >
          ← Back to List
        </button>

        <div style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111', marginBottom: 8 }}>
            {selectedItinerary.title}
          </h2>
          <div
            style={{
              fontSize: 13,
              color: '#666',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            <div>
              📍 {selectedItinerary.arrival_location} → {selectedItinerary.departure_location}
            </div>
            <div>
              📅 {new Date(selectedItinerary.start_date).toLocaleDateString()} to{' '}
              {new Date(selectedItinerary.end_date).toLocaleDateString()}
            </div>
            {selectedItinerary.travel_pace && (
              <div>
                ⚡{' '}
                {selectedItinerary.travel_pace.charAt(0).toUpperCase() +
                  selectedItinerary.travel_pace.slice(1)}{' '}
                pace
              </div>
            )}
            {selectedItinerary.budget && (
              <div>💰 {selectedItinerary.budget.replace(/-/g, ' ').toUpperCase()}</div>
            )}
          </div>
        </div>

        <div
          style={{
            fontSize: 14,
            lineHeight: 1.6,
            color: '#333',
            fontFamily: '"Segoe UI", system-ui, sans-serif',
            paddingBottom: 20,
            flex: 1,
          }}
        >
          {renderSavedItineraryMarkdown(selectedItinerary.markdown_content)}
        </div>

        {err && <div style={{ marginTop: 8, color: 'crimson', fontSize: 13 }}>{err}</div>}
        {msg && <div style={{ marginTop: 8, color: 'green', fontSize: 13 }}>{msg}</div>}

        <div
          style={{
            display: 'flex',
            gap: 8,
            marginTop: 16,
            borderTop: '1px solid rgba(0,0,0,0.08)',
            paddingTop: 16,
          }}
        >
          <button
            onClick={() => {
              navigator.clipboard.writeText(selectedItinerary.markdown_content);
              alert('✅ Itinerary copied to clipboard!');
            }}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid rgba(0,0,0,0.18)',
              background: 'white',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
              color: '#111',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLElement).style.background = '#f3f4f6';
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLElement).style.background = 'white';
            }}
          >
            📋 Copy
          </button>
          <button
            onClick={() => {
              onDeleteItinerary(selectedItinerary.id);
              setSelectedItinerary(null);
            }}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid #fee2e2',
              background: '#fef2f2',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
              color: '#dc2626',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = '#fee2e2';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = '#fef2f2';
            }}
          >
            🗑️ Delete
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{ flex: 1, overflow: 'auto', padding: 16, display: 'flex', flexDirection: 'column' }}
    >
      <button
        onClick={onBackToMenu}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontSize: 18,
          color: '#9333ea',
          fontWeight: 600,
          marginBottom: 12,
          padding: 0,
          textAlign: 'left',
        }}
      >
        ← Back to Menu
      </button>

      <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111', marginBottom: 16 }}>
        🎒 My Saved Itineraries
      </h2>

      {err && <div style={{ marginBottom: 12, color: 'crimson', fontSize: 13 }}>{err}</div>}
      {msg && <div style={{ marginBottom: 12, color: 'green', fontSize: 13 }}>{msg}</div>}

      {loadingItineraries ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 14, color: '#666', marginBottom: 8 }}>Loading...</div>
          </div>
        </div>
      ) : savedItineraries.length === 0 ? (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
          }}
        >
          <div style={{ color: '#999' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📌</div>
            <div style={{ fontSize: 14 }}>No saved itineraries yet</div>
            <div style={{ fontSize: 12, color: '#bbb', marginTop: 4 }}>
              Generate and save your first itinerary!
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {savedItineraries.map((itinerary) => (
            <div
              key={itinerary.id}
              style={{
                background: 'white',
                border: '1px solid rgba(0,0,0,0.08)',
                borderRadius: 12,
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onClick={() => setSelectedItinerary(itinerary)}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(147, 51, 234, 0.02)';
                (e.currentTarget as HTMLElement).style.borderColor = '#9333ea';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'white';
                (e.currentTarget as HTMLElement).style.borderColor = 'rgba(0,0,0,0.08)';
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 700, color: '#111' }}>{itinerary.title}</div>

              <div
                style={{
                  fontSize: 13,
                  color: '#666',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}
              >
                <div>
                  📍 {itinerary.arrival_location} → {itinerary.departure_location}
                </div>
                <div>
                  📅 {new Date(itinerary.start_date).toLocaleDateString()} to{' '}
                  {new Date(itinerary.end_date).toLocaleDateString()}
                </div>
                {itinerary.travel_pace && (
                  <div>
                    ⚡{' '}
                    {itinerary.travel_pace.charAt(0).toUpperCase() +
                      itinerary.travel_pace.slice(1)}{' '}
                    pace
                  </div>
                )}
                {itinerary.budget && (
                  <div>💰 {itinerary.budget.replace(/-/g, ' ').toUpperCase()}</div>
                )}
              </div>

              <div
                style={{ display: 'flex', gap: 8, marginTop: 8 }}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(itinerary.markdown_content);
                    alert('✅ Itinerary copied to clipboard!');
                  }}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: '1px solid rgba(0,0,0,0.18)',
                    background: 'white',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#111',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    (e.target as HTMLElement).style.background = '#f3f4f6';
                  }}
                  onMouseLeave={(e) => {
                    (e.target as HTMLElement).style.background = 'white';
                  }}
                >
                  📋 Copy
                </button>
                <button
                  onClick={() => onDeleteItinerary(itinerary.id)}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: '1px solid #fee2e2',
                    background: '#fef2f2',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#dc2626',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    (e.target as HTMLElement).style.background = '#fee2e2';
                  }}
                  onMouseLeave={(e) => {
                    (e.target as HTMLElement).style.background = '#fef2f2';
                  }}
                >
                  🗑️ Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Hand-rolled markdown renderer for saved itineraries. Supports headers,
 * bullets, numbered lists, bold/italic, and the custom `mapbox:` link scheme
 * that opens venues in the native maps app.
 *
 * Kept separate from ItineraryPreview (which uses react-markdown) because this
 * code path is read-only and doesn't stream — it was preserved from the
 * original profileModal for a pixel-identical look.
 */
function renderSavedItineraryMarkdown(content: string): ReactNode[] {
  return content.split('\n').map((line, idx) => {
    if (line.startsWith('###')) {
      return (
        <h3 key={idx} style={{ marginTop: 20, marginBottom: 10, fontSize: 16, fontWeight: 700 }}>
          {line.replace(/^#+\s/, '')}
        </h3>
      );
    }
    if (line.startsWith('##')) {
      return (
        <h2 key={idx} style={{ marginTop: 24, marginBottom: 12, fontSize: 18, fontWeight: 700 }}>
          {line.replace(/^#+\s/, '')}
        </h2>
      );
    }
    if (line.startsWith('#')) {
      return (
        <h1 key={idx} style={{ marginTop: 28, marginBottom: 14, fontSize: 20, fontWeight: 700 }}>
          {line.replace(/^#+\s/, '')}
        </h1>
      );
    }

    const content = line;
    if (content.trim() === '') {
      return <div key={idx} style={{ height: 8 }} />;
    }

    if (/^[-]\s/.test(line)) {
      const bulletContent = line.replace(/^-\s/, '');
      return (
        <div key={idx} style={{ marginLeft: 20, marginBottom: 4, display: 'flex', gap: 8 }}>
          <span>•</span>
          <span>{renderInlineMarkdown(bulletContent)}</span>
        </div>
      );
    }

    const numberMatch = line.match(/^\d+\.\s/);
    if (numberMatch) {
      const listContent = line.replace(/^\d+\.\s/, '');
      const numberPart = line.match(/^\d+\./)?.[0];
      return (
        <div key={idx} style={{ marginLeft: 20, marginBottom: 4 }}>
          <span style={{ fontWeight: 600 }}>{numberPart}</span>{' '}
          {renderInlineMarkdown(listContent)}
        </div>
      );
    }

    return (
      <div key={idx} style={{ marginBottom: 8 }}>
        {renderInlineMarkdown(content)}
      </div>
    );
  });
}

function renderInlineMarkdown(text: string): ReactNode[] {
  const linkParts = text.split(/(\[[^\]]+\]\([^)]+\))/);

  return linkParts.flatMap((part, i) => {
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      const [, linkText, url] = linkMatch;

      if (url.startsWith('mapbox:')) {
        const [, venueName, city] = url.match(/^mapbox:(.+)\|(.+)$/) || [];
        const decodedVenue = decodeURIComponent(venueName || '');

        return (
          <a
            key={i}
            href="#"
            onClick={async (e) => {
              e.preventDefault();
              const { openVenueInMaps } = await import('../../../lib/venueGeocoding');
              await openVenueInMaps(decodedVenue, city || '');
            }}
            style={{
              color: '#0369a1',
              textDecoration: 'underline',
              textDecorationStyle: 'dotted',
              textUnderlineOffset: '2px',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLAnchorElement).style.textDecorationStyle = 'solid')
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLAnchorElement).style.textDecorationStyle = 'dotted')
            }
          >
            📍 {linkText}
          </a>
        );
      }

      return (
        <a
          key={i}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#0066cc', textDecoration: 'none', cursor: 'pointer' }}
          onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
          onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
        >
          {linkText}
        </a>
      );
    }

    const boldParts = part.split(/(\*\*[^*]+\*\*)/);

    return boldParts.map((boldPart, j): ReactNode => {
      if (boldPart.startsWith('**') && boldPart.endsWith('**')) {
        const boldContent = boldPart.slice(2, -2);
        const italicParts = boldContent.split(/(\*[^*]+\*)/);
        return (
          <strong key={`${i}-${j}`}>
            {italicParts.map((segment, k) => {
              if (segment.startsWith('*') && segment.endsWith('*') && segment.length > 2) {
                return <em key={k}>{segment.slice(1, -1)}</em>;
              }
              return segment;
            })}
          </strong>
        );
      }
      const italicParts = boldPart.split(/(\*[^*]+\*)/);
      return (
        <span key={`${i}-${j}`}>
          {italicParts.map((segment, k) => {
            if (segment.startsWith('*') && segment.endsWith('*') && segment.length > 2) {
              return <em key={k}>{segment.slice(1, -1)}</em>;
            }
            return segment;
          })}
        </span>
      );
    });
  });
}
