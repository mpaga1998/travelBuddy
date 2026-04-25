import { useEffect, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { deleteItinerary, getMyItineraries, type SavedItinerary } from '../profileApi';
import { useConfirm } from '../../../components/ConfirmDialog';
import { Skeleton } from '../../../components/Skeleton';

// No props — the modal shell's header owns "back to menu" navigation. We used
// to take an `onBackToMenu` prop and render our own back button above the list,
// which stacked two "← Back" controls on screen.

// Shared action-button classes. Copy = neutral, Delete = destructive red.
const copyBtnClass =
  'flex-1 px-3 py-2 rounded-lg border border-black/[0.18] bg-white hover:bg-gray-100 cursor-pointer text-[13px] font-semibold text-[#111] transition-colors';
const deleteBtnClass =
  'flex-1 px-3 py-2 rounded-lg border border-red-100 bg-red-50 hover:bg-red-100 cursor-pointer text-[13px] font-semibold text-red-600 transition-colors';

/**
 * Itineraries tab. Loads the user's saved itineraries on mount, renders the
 * list, and drills into a detail view with the formatted markdown on click.
 */
export function SavedItinerariesTab() {
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

  const confirm = useConfirm();

  async function onDeleteItinerary(itineraryId: string) {
    const ok = await confirm({
      title: 'Delete this itinerary?',
      message: "You can't undo this — the saved itinerary will be gone for good.",
      confirmLabel: 'Delete',
      cancelLabel: 'Keep it',
      destructive: true,
    });
    if (!ok) return;

    try {
      await deleteItinerary(itineraryId);
      setSavedItineraries(savedItineraries.filter((it) => it.id !== itineraryId));
      toast.success('Itinerary deleted');
      setMsg('Itinerary deleted.');
    } catch (e: any) {
      const message = e?.message ?? 'Failed to delete itinerary';
      toast.error(message);
      setErr(message);
    }
  }

  if (selectedItinerary) {
    return (
      <div className="flex-1 overflow-auto p-4 flex flex-col">
        <button
          onClick={() => setSelectedItinerary(null)}
          className="bg-none border-none cursor-pointer text-lg text-purple-600 font-semibold mb-3 p-0 text-left"
        >
          ← Back to List
        </button>

        <div className="mb-4">
          <h2 className="text-xl font-bold text-[#111] mb-2">
            {selectedItinerary.title}
          </h2>
          <div className="text-[13px] text-[#666] flex flex-col gap-1">
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

        <div className="text-sm leading-relaxed text-[#333] font-['Segoe_UI',system-ui,sans-serif] pb-5 flex-1">
          {renderSavedItineraryMarkdown(selectedItinerary.markdown_content)}
        </div>

        {err && <div className="mt-2 text-[crimson] text-[13px]">{err}</div>}
        {msg && <div className="mt-2 text-green-600 text-[13px]">{msg}</div>}

        <div className="flex gap-2 mt-4 border-t border-black/[0.08] pt-4">
          <button
            onClick={() => {
              navigator.clipboard.writeText(selectedItinerary.markdown_content);
              toast.success('Copied to clipboard');
            }}
            className={copyBtnClass}
          >
            📋 Copy
          </button>
          <button
            onClick={() => {
              onDeleteItinerary(selectedItinerary.id);
              setSelectedItinerary(null);
            }}
            className={deleteBtnClass}
          >
            🗑️ Delete
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-4 flex flex-col">
      <h2 className="text-xl font-bold text-[#111] mb-4">
        🎒 My Saved Itineraries
      </h2>

      {err && <div className="mb-3 text-[crimson] text-[13px]">{err}</div>}
      {msg && <div className="mb-3 text-green-600 text-[13px]">{msg}</div>}

      {loadingItineraries ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="bg-white border border-black/[0.08] rounded-xl p-4 flex flex-col gap-2"
            >
              <Skeleton className="h-5 w-2/3 rounded" />
              <div className="flex flex-col gap-1.5 mt-1">
                <Skeleton className="h-3 w-4/5 rounded" />
                <Skeleton className="h-3 w-3/5 rounded" />
                <Skeleton className="h-3 w-2/5 rounded" />
              </div>
              <div className="flex gap-2 mt-2">
                <Skeleton className="h-9 flex-1 rounded-lg" />
                <Skeleton className="h-9 flex-1 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      ) : savedItineraries.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-center">
          <div className="text-[#999]">
            <div className="text-[32px] mb-2">📌</div>
            <div className="text-sm">No saved itineraries yet</div>
            <div className="text-xs text-[#bbb] mt-1">
              Generate and save your first itinerary!
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {savedItineraries.map((itinerary) => (
            <div
              key={itinerary.id}
              className="bg-white border border-black/[0.08] hover:border-purple-600 hover:bg-purple-600/[0.02] rounded-xl p-4 flex flex-col gap-2 cursor-pointer transition-colors"
              onClick={() => setSelectedItinerary(itinerary)}
            >
              <div className="text-base font-bold text-[#111]">{itinerary.title}</div>

              <div className="text-[13px] text-[#666] flex flex-col gap-1">
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
                className="flex gap-2 mt-2"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(itinerary.markdown_content);
                    toast.success('Copied to clipboard');
                  }}
                  className={copyBtnClass}
                >
                  📋 Copy
                </button>
                <button
                  onClick={() => onDeleteItinerary(itinerary.id)}
                  className={deleteBtnClass}
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
        <h3 key={idx} className="mt-5 mb-2.5 text-base font-bold">
          {line.replace(/^#+\s/, '')}
        </h3>
      );
    }
    if (line.startsWith('##')) {
      return (
        <h2 key={idx} className="mt-6 mb-3 text-lg font-bold">
          {line.replace(/^#+\s/, '')}
        </h2>
      );
    }
    if (line.startsWith('#')) {
      return (
        <h1 key={idx} className="mt-7 mb-3.5 text-xl font-bold">
          {line.replace(/^#+\s/, '')}
        </h1>
      );
    }

    const content = line;
    if (content.trim() === '') {
      return <div key={idx} className="h-2" />;
    }

    if (/^[-]\s/.test(line)) {
      const bulletContent = line.replace(/^-\s/, '');
      return (
        <div key={idx} className="ml-5 mb-1 flex gap-2">
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
        <div key={idx} className="ml-5 mb-1">
          <span className="font-semibold">{numberPart}</span>{' '}
          {renderInlineMarkdown(listContent)}
        </div>
      );
    }

    return (
      <div key={idx} className="mb-2">
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
            className="text-sky-700 underline decoration-dotted underline-offset-2 cursor-pointer hover:decoration-solid"
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
          className="text-[#0066cc] no-underline hover:underline cursor-pointer"
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
