/**
 * ItineraryMapLayer
 *
 * Renders extracted itinerary places on the Mapbox map.
 *
 * Coordinate strategy:
 *   Server-supplied lat/lng from the extraction API are IGNORED because the
 *   server-side Mapbox token may not be available in production (VITE_MAPBOX_TOKEN
 *   is a build-time Vite variable, not a server-side runtime env var). Instead we
 *   re-geocode every venue client-side using geocodeVenue(name, arrivalLocation),
 *   which uses the browser's VITE_MAPBOX_TOKEN.
 *
 * Clustering:
 *   Uses Mapbox native GeoJSON clustering (same pattern as PinLayer).
 *   Clusters render as GL layers; individual unclustered pins render as
 *   HTML markers synced on every render frame.
 */

import { useEffect, useRef } from 'react';
import mapboxgl, { Map as MapboxMap, GeoJSONSource } from 'mapbox-gl';
import type { ExtractedPlace } from './itineraryMapOverlay';
import { dayColor, PLACE_TYPE_EMOJI } from './itineraryMapOverlay';
import { geocodeVenue, generateGoogleMapsURL } from '../../lib/venueGeocoding';

// Source / layer ids — must not collide with PinLayer ('pins', 'pins-clusters', …)
const SRC = 'itinerary';
const L_CLUSTERS = 'itinerary-clusters';
const L_CLUSTER_COUNT = 'itinerary-cluster-count';

export interface ItineraryMapLayerProps {
  map: MapboxMap | null;
  /** Server-extracted places. Their lat/lng are REPLACED by client-side geocoding. */
  places: ExtractedPlace[];
  /** Full city string from the itinerary form, e.g. "Rome, Italy". Used as the
   *  geocoding city hint so venue names resolve to the correct city. */
  arrivalLocation: string;
  /** Called with true when geocoding starts, false when done. */
  onGeocoding?: (loading: boolean) => void;
}

// Internal type: ExtractedPlace with guaranteed client-side coords
interface GeocodedPlace extends ExtractedPlace {
  resolvedLat: number;
  resolvedLng: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function placesToFc(places: GeocodedPlace[]): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: 'FeatureCollection',
    features: places.map((p, i) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [p.resolvedLng, p.resolvedLat] },
      properties: {
        seq: i + 1,
        day: p.day,
        type: p.type,
        name: p.name,
      },
    })),
  };
}

function buildMarkerEl(place: GeocodedPlace, seq: number): HTMLElement {
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

  const badge = document.createElement('div');
  badge.textContent = String(seq);
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
    pointerEvents: 'none',
  } as CSSStyleDeclaration);
  el.appendChild(badge);

  return el;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ItineraryMapLayer({
  map,
  places,
  arrivalLocation,
  onGeocoding,
}: ItineraryMapLayerProps) {
  // Stable ref so the render-frame handler always reads the latest geocoded list.
  const geocodedRef = useRef<GeocodedPlace[]>([]);

  useEffect(() => {
    if (!map || !places.length || !arrivalLocation) return;

    let cancelled = false;

    // Per-invocation marker bookkeeping (NOT shared across renders).
    const localMarkers = new Map<number, mapboxgl.Marker>();
    const localMarkersOnScreen = new Map<number, mapboxgl.Marker>();

    // ---- Event handlers defined here so we can remove them by reference ----
    const clusterClickHandler = (e: mapboxgl.MapLayerMouseEvent) => {
      const feat = e.features?.[0];
      if (!feat) return;
      const clusterId = feat.properties?.cluster_id as number | undefined;
      const src = map.getSource(SRC) as GeoJSONSource | undefined;
      if (!src || clusterId == null) return;
      src.getClusterExpansionZoom(clusterId, (err, zoom) => {
        if (err) return;
        const coords = (feat.geometry as GeoJSON.Point).coordinates as [number, number];
        map.easeTo({ center: coords, zoom: zoom ?? map.getZoom() + 2, duration: 400 });
      });
    };

    const onClusterEnter = () => { map.getCanvas().style.cursor = 'pointer'; };
    const onClusterLeave = () => { map.getCanvas().style.cursor = ''; };

    const updateMarkers = () => {
      if (!map.getSource(SRC) || !map.isSourceLoaded(SRC)) return;

      const features = map.querySourceFeatures(SRC);
      const next = new Map<number, mapboxgl.Marker>();

      for (const feat of features) {
        const props = feat.properties;
        if (!props || props.cluster) continue;
        const seq = props.seq as number;
        if (!seq) continue;
        const place = geocodedRef.current[seq - 1];
        if (!place) continue;
        const coords = (feat.geometry as GeoJSON.Point).coordinates as [number, number];

        let marker = localMarkers.get(seq);
        if (!marker) {
          const el = buildMarkerEl(place, seq);
          el.addEventListener('click', (ev) => {
            ev.stopPropagation();
            const url = generateGoogleMapsURL(
              [place.resolvedLat, place.resolvedLng],
              place.name
            );
            if (url) window.open(url, '_blank', 'noopener,noreferrer');
          });
          marker = new mapboxgl.Marker({ element: el }).setLngLat(coords);
          localMarkers.set(seq, marker);
        } else {
          marker.setLngLat(coords);
        }

        next.set(seq, marker);
        if (!localMarkersOnScreen.has(seq)) marker.addTo(map);
      }

      for (const [seq, marker] of localMarkersOnScreen) {
        if (!next.has(seq)) marker.remove();
      }
      localMarkersOnScreen.clear();
      for (const [k, v] of next) localMarkersOnScreen.set(k, v);
    };

    // ---- Layer installation (called once geocoding is done) ----------------
    let loadHandler: (() => void) | null = null;

    const installLayers = (geocoded: GeocodedPlace[]) => {
      if (!map || cancelled) return;

      geocodedRef.current = geocoded;
      const fc = placesToFc(geocoded);

      // If source already exists (e.g. HMR / re-mount), just update data.
      if (map.getSource(SRC)) {
        (map.getSource(SRC) as GeoJSONSource).setData(fc);
        return;
      }

      map.addSource(SRC, {
        type: 'geojson',
        data: fc,
        cluster: true,
        clusterRadius: 50,
        clusterMaxZoom: 14,
      });

      // Cluster circles — same colour scale as PinLayer
      map.addLayer({
        id: L_CLUSTERS,
        type: 'circle',
        source: SRC,
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': [
            'step', ['get', 'point_count'],
            '#93c5fd', 10, '#3b82f6', 50, '#1d4ed8',
          ],
          'circle-radius': [
            'step', ['get', 'point_count'],
            20, 10, 26, 50, 32,
          ],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      });

      // Cluster count labels
      map.addLayer({
        id: L_CLUSTER_COUNT,
        type: 'symbol',
        source: SRC,
        filter: ['has', 'point_count'],
        layout: {
          'text-field': ['get', 'point_count_abbreviated'],
          'text-size': 13,
          'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
          'text-allow-overlap': true,
        },
        paint: { 'text-color': '#ffffff' },
      });

      map.on('click', L_CLUSTERS, clusterClickHandler);
      map.on('mouseenter', L_CLUSTERS, onClusterEnter);
      map.on('mouseleave', L_CLUSTERS, onClusterLeave);

      // Sync HTML markers on every GL render frame (same pattern as PinLayer).
      map.on('render', updateMarkers);

      // Fit to bounding box of all geocoded places.
      const bounds = new mapboxgl.LngLatBounds();
      geocoded.forEach((p) => bounds.extend([p.resolvedLng, p.resolvedLat]));
      map.fitBounds(bounds, { padding: 60, maxZoom: 14 });

      updateMarkers();
    };

    // ---- Async geocoding ---------------------------------------------------
    const run = async () => {
      onGeocoding?.(true);
      try {
        // Geocode the city once to use as fallback for failed individual venues.
        const cityResult = await geocodeVenue(arrivalLocation);
        if (cancelled) return;
        const cityCoords = cityResult
          ? { lat: cityResult[0], lng: cityResult[1] }
          : null;

        // Deduplicate venue names so each unique name makes only one API call.
        const uniqueNames = [...new Set(places.map((p) => p.name))];
        const cache = new Map<string, { lat: number; lng: number }>();

        await Promise.all(
          uniqueNames.map(async (name) => {
            const r = await geocodeVenue(name, arrivalLocation);
            if (r) {
              cache.set(name, { lat: r[0], lng: r[1] });
            } else {
              console.warn(`[ItineraryMapLayer] geocoding failed for "${name}"`);
            }
          })
        );

        if (cancelled) return;

        const geocoded: GeocodedPlace[] = places.map((p) => {
          const coords = cache.get(p.name);
          if (coords) return { ...p, resolvedLat: coords.lat, resolvedLng: coords.lng };
          if (cityCoords) {
            console.warn(`[ItineraryMapLayer] using city fallback for "${p.name}"`);
            return { ...p, resolvedLat: cityCoords.lat, resolvedLng: cityCoords.lng };
          }
          // Last resort: server-supplied coords (may be wrong, but keeps the pin visible).
          console.warn(`[ItineraryMapLayer] no coords for "${p.name}", using server coords`);
          return { ...p, resolvedLat: p.lat, resolvedLng: p.lng };
        });

        if (map.isStyleLoaded()) {
          installLayers(geocoded);
        } else {
          loadHandler = () => installLayers(geocoded);
          map.once('load', loadHandler);
        }
      } finally {
        if (!cancelled) onGeocoding?.(false);
      }
    };

    run();

    // ---- Cleanup -----------------------------------------------------------
    return () => {
      cancelled = true;
      try {
        if (loadHandler) map.off('load', loadHandler);
        map.off('render', updateMarkers);
        map.off('click', L_CLUSTERS, clusterClickHandler);
        map.off('mouseenter', L_CLUSTERS, onClusterEnter);
        map.off('mouseleave', L_CLUSTERS, onClusterLeave);

        for (const m of localMarkersOnScreen.values()) m.remove();
        for (const m of localMarkers.values()) m.remove();
        localMarkersOnScreen.clear();
        localMarkers.clear();

        if (map.getLayer(L_CLUSTER_COUNT)) map.removeLayer(L_CLUSTER_COUNT);
        if (map.getLayer(L_CLUSTERS)) map.removeLayer(L_CLUSTERS);
        if (map.getSource(SRC)) map.removeSource(SRC);
      } catch {
        // Map or style may already be gone — safe to ignore.
      }
    };
  }, [map, places, arrivalLocation, onGeocoding]);

  return null;
}


