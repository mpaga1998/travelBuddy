/**
 * ItineraryMapLayer
 *
 * Renders extracted itinerary places as numbered HTML markers on the Mapbox
 * map. Each marker is coloured by day number. Clicking opens Google Maps for
 * that venue.
 *
 * The layer is fully self-contained: it manages its own markers, cleans up
 * on unmount, and re-syncs whenever `places` changes.
 */

import { useEffect, useRef } from 'react';
import mapboxgl, { Map as MapboxMap } from 'mapbox-gl';
import type { ExtractedPlace } from './itineraryMapOverlay';
import { dayColor, PLACE_TYPE_EMOJI } from './itineraryMapOverlay';
import { generateGoogleMapsURL } from '../../lib/venueGeocoding';

export interface ItineraryMapLayerProps {
  map: MapboxMap | null;
  places: ExtractedPlace[];
}

/**
 * Build a small coloured circle marker element for a place.
 * Shows the type emoji and a global sequence badge (1..N).
 */
function buildMarkerEl(place: ExtractedPlace, globalSeq: number): HTMLElement {
  const color = dayColor(place.day);
  const emoji = PLACE_TYPE_EMOJI[place.type] ?? '📍';

  const el = document.createElement('div');
  el.title = `${place.name} — Day ${place.day}`;
  Object.assign(el.style, {
    width: '34px',
    height: '34px',
    borderRadius: '999px',
    background: color,
    border: '2px solid white',
    boxShadow: '0 6px 18px rgba(0,0,0,0.18)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    position: 'relative',
    fontSize: '15px',
    userSelect: 'none',
  } as CSSStyleDeclaration);
  el.textContent = emoji;

  // Global sequence badge — contiguous 1..N across all days
  const badge = document.createElement('div');
  badge.textContent = String(globalSeq);
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
  el.appendChild(badge);

  // Click → open venue in Google Maps
  el.addEventListener('click', (e) => {
    e.stopPropagation();
    const url = generateGoogleMapsURL([place.lat, place.lng], place.name);
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  });

  return el;
}

export function ItineraryMapLayer({ map, places }: ItineraryMapLayerProps) {
  const markersRef = useRef<mapboxgl.Marker[]>([]);

  useEffect(() => {
    if (!map || !places.length) return;

    // Add markers with globally contiguous numbering (1..N)
    places.forEach((place, index) => {
      const el = buildMarkerEl(place, index + 1);

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([place.lng, place.lat])
        .addTo(map);

      markersRef.current.push(marker);
    });

    // Fit the map to the bounding box of all places.
    // Must wait for the style to finish loading — calling fitBounds on an
    // unloaded map causes cameraForBounds to receive a zero-sized viewport
    // and silently returns a garbage zoom, leaving the camera unmoved.
    const fitBounds = () => {
      const bounds = new mapboxgl.LngLatBounds();
      places.forEach((p) => bounds.extend([p.lng, p.lat]));
      map.fitBounds(bounds, { padding: 80, maxZoom: 15 });
      console.log(`[ItineraryMapLayer] fitBounds to ${places.length} places`);
    };

    if (map.loaded()) {
      fitBounds();
    } else {
      map.once('load', fitBounds);
    }

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      // Cancel the pending load listener if the component unmounts before load.
      map.off('load', fitBounds);
    };
  }, [map, places]);

  return null; // Purely imperative — no DOM output from React
}


