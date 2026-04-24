import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { openVenueInMapsSync } from '../../lib/venueGeocoding';

export interface ItineraryPreviewProps {
  markdown: string;
  isStreaming: boolean;
}

export function ItineraryPreview({ markdown, isStreaming }: ItineraryPreviewProps) {
  return (
    <div>
      {isStreaming && (
        <div className="flex items-center gap-2.5 px-3.5 py-2.5 mb-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-[13px] font-semibold">
          <div className="w-3.5 h-3.5 border-2 border-blue-200 border-t-blue-700 rounded-full animate-spin shrink-0" />
          <span>Writing your itinerary…</span>
        </div>
      )}
      <div className="itinerary-markdown text-sm leading-relaxed text-[#333] font-['Segoe_UI',system-ui,sans-serif] pb-5">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          // react-markdown 9 sanitizes URLs by default and strips any scheme
          // not on its allowlist. Our venue links use a custom `mapbox:` scheme
          // (e.g. `mapbox:Trattoria%20Da%20Enzo|Rome`), which was being rewritten
          // to an empty string — clicking then opened a blank tab that resolved
          // to the app's home URL. Pass urlTransform through so our scheme
          // survives and the `a` override below can handle it.
          urlTransform={(url) => url}
          components={{
            h1: ({ node: _n, ...props }) => (
              <h1 className="mt-7 mb-3.5 text-xl font-bold" {...props} />
            ),
            h2: ({ node: _n, ...props }) => (
              <h2 className="mt-6 mb-3 text-lg font-bold" {...props} />
            ),
            h3: ({ node: _n, ...props }) => (
              <h3 className="mt-5 mb-2.5 text-base font-bold" {...props} />
            ),
            p: ({ node: _n, ...props }) => (
              <p className="mt-0 mb-2.5" {...props} />
            ),
            ul: ({ node: _n, ...props }) => (
              <ul className="mt-1 mb-2.5 pl-5 list-disc" {...props} />
            ),
            ol: ({ node: _n, ...props }) => (
              <ol className="mt-1 mb-2.5 pl-5 list-decimal" {...props} />
            ),
            li: ({ node: _n, ...props }) => (
              <li className="mb-1" {...props} />
            ),
            blockquote: ({ node: _n, ...props }) => (
              <blockquote
                className="border-l-4 border-blue-200 bg-blue-50 my-2.5 px-3 py-2 text-blue-900 rounded"
                {...props}
              />
            ),
            table: ({ node: _n, ...props }) => (
              <div className="overflow-x-auto my-3">
                <table className="border-collapse w-full text-[13px]" {...props} />
              </div>
            ),
            th: ({ node: _n, ...props }) => (
              <th
                className="border border-gray-200 px-2.5 py-1.5 bg-gray-50 text-left font-semibold"
                {...props}
              />
            ),
            td: ({ node: _n, ...props }) => (
              <td className="border border-gray-200 px-2.5 py-1.5" {...props} />
            ),
            a: ({ node: _n, href, children, ...props }) => {
              const hrefStr = href;
              // mapbox: links are venue links emitted by the model.
              // Open in the platform's native maps app via openVenueInMaps.
              if (hrefStr?.startsWith('mapbox:')) {
                const match = hrefStr.match(/^mapbox:(.+)\|(.+)$/);
                const decodedVenue = match ? decodeURIComponent(match[1]) : String(children);
                const city = match ? match[2] : '';
                const encodedQuery = encodeURIComponent(city ? `${decodedVenue} ${city}` : decodedVenue);
                const fallbackUrl = `https://www.google.com/maps/search/?api=1&query=${encodedQuery}`;
                return (
                  <a
                    href={fallbackUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => {
                      e.preventDefault();
                      // openVenueInMapsSync calls window.open synchronously within
                      // the user gesture, satisfying mobile popup blockers.
                      openVenueInMapsSync(decodedVenue, city);
                    }}
                    className="text-sky-700 underline decoration-dotted underline-offset-2 cursor-pointer hover:decoration-solid"
                  >
                    📍 {children}
                  </a>
                );
              }
              return (
                <a
                  href={hrefStr}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-700 no-underline"
                  {...props}
                >
                  {children}
                </a>
              );
            },
          }}
        >
          {markdown}
        </ReactMarkdown>
      </div>
    </div>
  );
}
