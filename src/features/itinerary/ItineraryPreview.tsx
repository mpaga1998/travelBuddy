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
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 14px',
            marginBottom: 12,
            background: '#eff6ff',
            border: '1px solid #bfdbfe',
            borderRadius: 8,
            color: '#1d4ed8',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          <div
            style={{
              width: 14,
              height: 14,
              border: '2px solid #bfdbfe',
              borderTop: '2px solid #1d4ed8',
              borderRadius: '50%',
              animation: 'spin 0.9s linear infinite',
              flexShrink: 0,
            }}
          />
          <span>Writing your itinerary…</span>
        </div>
      )}
      <div
        className="itinerary-markdown"
        style={{
          fontSize: 14,
          lineHeight: 1.6,
          color: '#333',
          fontFamily: '"Segoe UI", system-ui, sans-serif',
          paddingBottom: 20,
        }}
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h1: ({ node: _n, ...props }) => (
              <h1 style={{ marginTop: 28, marginBottom: 14, fontSize: 20, fontWeight: 700 }} {...props} />
            ),
            h2: ({ node: _n, ...props }) => (
              <h2 style={{ marginTop: 24, marginBottom: 12, fontSize: 18, fontWeight: 700 }} {...props} />
            ),
            h3: ({ node: _n, ...props }) => (
              <h3 style={{ marginTop: 20, marginBottom: 10, fontSize: 16, fontWeight: 700 }} {...props} />
            ),
            p: ({ node: _n, ...props }) => (
              <p style={{ marginTop: 0, marginBottom: 10 }} {...props} />
            ),
            ul: ({ node: _n, ...props }) => (
              <ul style={{ marginTop: 4, marginBottom: 10, paddingLeft: 20 }} {...props} />
            ),
            ol: ({ node: _n, ...props }) => (
              <ol style={{ marginTop: 4, marginBottom: 10, paddingLeft: 20 }} {...props} />
            ),
            li: ({ node: _n, ...props }) => (
              <li style={{ marginBottom: 4 }} {...props} />
            ),
            blockquote: ({ node: _n, ...props }) => (
              <blockquote
                style={{
                  borderLeft: '4px solid #bfdbfe',
                  background: '#eff6ff',
                  margin: '10px 0',
                  padding: '8px 12px',
                  color: '#1e3a8a',
                  borderRadius: 4,
                }}
                {...props}
              />
            ),
            table: ({ node: _n, ...props }) => (
              <div style={{ overflowX: 'auto', margin: '12px 0' }}>
                <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }} {...props} />
              </div>
            ),
            th: ({ node: _n, ...props }) => (
              <th
                style={{
                  border: '1px solid #e5e7eb',
                  padding: '6px 10px',
                  background: '#f9fafb',
                  textAlign: 'left',
                  fontWeight: 600,
                }}
                {...props}
              />
            ),
            td: ({ node: _n, ...props }) => (
              <td style={{ border: '1px solid #e5e7eb', padding: '6px 10px' }} {...props} />
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
                    style={{
                      color: '#0369a1',
                      textDecoration: 'underline',
                      textDecorationStyle: 'dotted',
                      textUnderlineOffset: '2px',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLAnchorElement).style.textDecorationStyle = 'solid';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLAnchorElement).style.textDecorationStyle = 'dotted';
                    }}
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
                  style={{ color: '#0066cc', textDecoration: 'none' }}
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
