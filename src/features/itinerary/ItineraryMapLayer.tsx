/**
 * ItineraryMapLayer
 *
 * Renders extracted itinerary places as numbered HTML markers on the Mapbox
 * map. Each marker is coloured by day number. Clicking opens a popup with
 * the place name, day badge, context sentence and an "Add to my map" button.
 *
 * The layer is fully self-contained: it manages its own markers and popups,
 * cleans up on unmount, and re-syncs whenever `places` changes.
 */

import { useEffect, useRef } from 'react';
import mapboxgl, { Map as MapboxMap } from 'mapbox-gl';
import type { ExtractedPlace } from './itineraryMapOverlay';
import { dayColor, PLACE_TYPE_EMOJI } from './itineraryMapOverlay';
import type { PinCategory } from '../pins/pinTypes';
import { placeTypeToCategory } from './itineraryMapOverlay';
import { createPin } from '../pins/pinApi';

export interface ItineraryMapLayerProps {
  map: MapboxMap | null;
  places: ExtractedPlace[];
  /** Called after a place is saved as a community pin, so the parent can reload. */
  onPinSaved?: () => void;
}

/**
 * Build a small coloured circle marker element for a place.
 * Shows the type emoji and a small day badge.
 */
function buildMarkerEl(place: ExtractedPlace, seqInDay: number): HTMLElement {
  const color = dayColor(place.day);
  const emoji = PLACE_TYPE_EMOJI[place.type] ?? '📍';

  const el = document.createElement('div');
  el.title = place.name;
  Object.assign(el.style, {
    width: '34px',
    height: '34px',
    borderRadius: '50%',
    background: color,
    border: '2px solid white',
    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    position: 'relative',
    fontSize: '15px',
    userSelect: 'none',
  } as CSSStyleDeclaration);
  el.textContent = emoji;

  // Day badge — tiny number in corner
  const badge = document.createElement('div');
  badge.textContent = String(seqInDay);
  Object.assign(badge.style, {
    position: 'absolute',
    top: '-4px',
    right: '-4px',
    width: '14px',
    height: '14px',
    borderRadius: '50%',
    background: '#1e293b',
    color: 'white',
    fontSize: '9px',
    fontWeight: '700',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: '1',
  } as CSSStyleDeclaration);
  badge.textContent = String(seqInDay);
  el.appendChild(badge);

  return el;
}

/** Popup HTML rendered for a single place. */
function buildPopupHTML(place: ExtractedPlace, color: string): string {
  const emoji = PLACE_TYPE_EMOJI[place.type] ?? '📍';
  return `
    <div style="font-family:system-ui,sans-serif;max-width:230px;padding:2px 0">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
        <span style="font-size:16px">${emoji}</span>
        <strong style="font-size:13px;color:#111;line-height:1.3">${escapeHtml(place.name)}</strong>
      </div>
      <span style="
        display:inline-block;padding:2px 8px;border-radius:999px;
        background:${color};color:#111;font-size:11px;font-weight:700;
        margin-bottom:6px
      ">Day ${place.day}</span>
      ${place.context
        ? `<p style="margin:0 0 8px 0;font-size:12px;color:#444;line-height:1.4">${escapeHtml(place.context)}</p>`
        : ''}
      <button
        data-add-pin
        style="
          width:100%;padding:7px 10px;border-radius:8px;border:none;
          background:#2563eb;color:white;font-size:12px;font-weight:600;
          cursor:pointer;display:flex;align-items:center;justify-content:center;gap:4px
        "
      >
        ＋ Add to my map
      </button>
    </div>
  `;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function ItineraryMapLayer({ map, places, onPinSaved }: ItineraryMapLayerProps) {
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const popupsRef = useRef<mapboxgl.Popup[]>([]);

  useEffect(() => {
    if (!map || !places.length) return;

    // Count per day so we can number markers within each day
    const dayCounters: Record<number, number> = {};
    const getSeq = (day: number) => {
      dayCounters[day] = (dayCounters[day] ?? 0) + 1;
      return dayCounters[day];
    };

    places.forEach((place) => {
      const seq = getSeq(place.day);
      const color = dayColor(place.day);

      const el = buildMarkerEl(place, seq);

      const popup = new mapboxgl.Popup({
        offset: 20,
        closeButton: true,
        className: 'itinerary-place-popup',
      }).setHTML(buildPopupHTML(place, color));

      // Wire "Add to my map" button inside the popup once it opens
      popup.on('open', () => {
        const container = popup.getElement();
        const btn = container?.querySelector('[data-add-pin]') as HTMLButtonElement | null;
        if (!btn) return;

        btn.addEventListener('click', async () => {
          btn.disabled = true;
          btn.textContent = 'Saving…';
          try {
            const category: PinCategory = placeTypeToCategory(place.type);
            await createPin({
              title: place.name,
              description: place.context,
              category,
              lat: place.lat,
              lng: place.lng,
            });
            btn.textContent = '✅ Saved!';
            btn.style.background = '#16a34a';
            onPinSaved?.();
          } catch (err) {
            console.error('[ItineraryMapLayer] createPin error:', err);
            btn.textContent = '❌ Failed';
            btn.style.background = '#dc2626';
            btn.disabled = false;
          }
        });
      });

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([place.lng, place.lat])
        .setPopup(popup)
        .addTo(map);

      markersRef.current.push(marker);
      popupsRef.current.push(popup);
    });

    // Fit map to the places when the layer mounts
    if (places.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();
      places.forEach((p) => bounds.extend([p.lng, p.lat]));
      map.fitBounds(bounds, { padding: 80, maxZoom: 15, duration: 800 });
    }

    return () => {
      markersRef.current.forEach((m) => m.remove());
      popupsRef.current.forEach((p) => p.remove());
      markersRef.current = [];
      popupsRef.current = [];
    };
  }, [map, places, onPinSaved]);

  return null; // Purely imperative — no DOM output from React
}
