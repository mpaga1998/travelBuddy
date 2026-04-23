/**
 * ItineraryMapLayer
 *
 * Renders extracted itinerary places on the Mapbox map.
 *
 * Coordinate strategy:
 *   Server-supplied lat/lng from the extraction API are IGNORED because the
 *   server-side Mapbox token may not be available in production (VITE_MAPBOX_TOKEN
 *   is a build-time Vite variable, not a server-side runtime env var). Instead we
 *   re-geocode every venue client-side using geocodeVenueDetailed(name, arrivalLocation),
 *   which uses the browser's VITE_MAPBOX_TOKEN. City center coords are used as a
 *   proximity bias so ambiguous names resolve to the correct city.
 *
 * Clustering:
 *   Uses Mapbox native GeoJSON clustering (same pattern as PinLayer).
 *   Clusters render as GL layers; individual unclustered pins render as
 *   HTML markers synced on every render frame.
 *
 * Click behaviour:
 *   Clicking an itinerary pin opens the same PinPopup used by community pins,
 *   with an isItineraryPin flag that swaps the badge and hides social actions.
 *
 * Logging:
 *   Every step emits structured [ITINERARY-MAP] console logs so coordinate
 *   issues can be diagnosed from browser DevTools without touching the server.
 */

import { useEffect, useRef, useState } from 'react';
import mapboxgl, { Map as MapboxMap, GeoJSONSource } from 'mapbox-gl';
import { createRoot, type Root } from 'react-dom/client';
import type { ExtractedPlace } from './itineraryMapOverlay';
import { dayColor, PLACE_TYPE_EMOJI, placeTypeToCategory } from './itineraryMapOverlay';
import { geocodeVenueDetailed, type GeocodingResult } from '../../lib/venueGeocoding';
import { PinPopup } from '../map/PinPopup';
import type { Pin } from '../pins/pinTypes';
import { MOBILE_BREAKPOINT } from '../map/mapConstants';

// Source / layer ids — must not collide with PinLayer ('pins', 'pins-clusters', …)
const SRC = 'itinerary';
const L_CLUSTERS = 'itinerary-clusters';
const L_CLUSTER_COUNT = 'itinerary-cluster-count';

const LOG = '[ITINERARY-MAP]';

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

// Internal type: ExtractedPlace with guaranteed client-side coords + audit fields
interface GeocodedPlace extends ExtractedPlace {
  resolvedLat: number;
  resolvedLng: number;
  resolvedPlaceName: string;
  relevance: number;
  usedFallback: 'none' | 'city' | 'server';
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/** Haversine great-circle distance in kilometres. */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Stable, reproducible id for an itinerary pin (DJB2 hash). */
function stableId(venueName: string, cityHint: string): string {
  let h = 5381;
  const s = `${venueName}::${cityHint}`;
  for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i);
  return `itinerary-${(h >>> 0).toString(16)}`;
}

/** Convert a geocoded itinerary place to a Pin shape for PinPopup. */
function geocodedPlaceToPin(p: GeocodedPlace, cityHint: string): Pin {
  return {
    id: stableId(p.name, cityHint),
    title: p.name,
    description: p.context?.trim().slice(0, 300) ?? '',
    category: placeTypeToCategory(p.type),
    lat: p.resolvedLat,
    lng: p.resolvedLng,
    createdByLabel: 'Your itinerary',
    createdByType: 'traveler',
    createdById: 'itinerary',
    createdByAge: null,
    likesCount: 0,
    dislikesCount: 0,
    bookmarkCount: 0,
    tips: [],
    imageUrls: [],
    createdAt: new Date().toISOString(),
  };
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

  // Selected place drives the popup.
  const [selectedPlace, setSelectedPlace] = useState<GeocodedPlace | null>(null);

  // Popup DOM refs — mutated imperatively to match PinLayer pattern.
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  const popupRootRef = useRef<Root | null>(null);

  // ---- Popup lifecycle (mirrors PinLayer) ---------------------------------
  useEffect(() => {
    // Clean up any previous popup immediately.
    if (popupRef.current) {
      popupRef.current.remove();
      popupRef.current = null;
    }
    if (popupRootRef.current) {
      popupRootRef.current.unmount();
      popupRootRef.current = null;
    }

    if (!map || !selectedPlace) return;

    const place = selectedPlace;

    map.easeTo({
      center: [place.resolvedLng, place.resolvedLat],
      duration: 400,
      padding: { top: 180, bottom: 80, left: 40, right: 40 },
    });

    // Mirror PinLayer: open popup after the camera animation settles.
    const timer = window.setTimeout(() => {
      const isMobile = window.innerWidth < MOBILE_BREAKPOINT;
      const container = document.createElement('div');
      const pin = geocodedPlaceToPin(place, arrivalLocation);

      const popup = new mapboxgl.Popup({
        closeButton: true,
        closeOnClick: false,
        maxWidth: isMobile ? `${Math.min(window.innerWidth * 0.9, 360)}px` : '400px',
        offset: [0, -10] as [number, number],
        anchor: 'bottom',
        focusAfterOpen: false,
        className: 'pin-popup',
      })
        .setLngLat([place.resolvedLng, place.resolvedLat])
        .setDOMContent(container)
        .addTo(map);

      popup.on('close', () => setSelectedPlace(null));
      popupRef.current = popup;

      const root = createRoot(container);
      popupRootRef.current = root;
      root.render(
        <PinPopup
          pin={pin}
          currentUserId={null}
          isBookmarkedByUser={false}
          onShowTips={() => {}}
          onShowImages={() => {}}
          isItineraryPin={true}
        />,
      );
    }, 400);

    return () => {
      window.clearTimeout(timer);
      if (popupRef.current) {
        popupRef.current.remove();
        popupRef.current = null;
      }
      if (popupRootRef.current) {
        popupRootRef.current.unmount();
        popupRootRef.current = null;
      }
    };
  }, [map, selectedPlace, arrivalLocation]);

  // Unmount cleanup for popup refs.
  useEffect(() => {
    return () => {
      if (popupRef.current) { popupRef.current.remove(); popupRef.current = null; }
      if (popupRootRef.current) { popupRootRef.current.unmount(); popupRootRef.current = null; }
    };
  }, []);

  // ---- Main geocoding + GL layer effect -----------------------------------
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
            // Always read from ref so we get the freshest GeocodedPlace.
            const freshPlace = geocodedRef.current[seq - 1];
            if (freshPlace) setSelectedPlace(freshPlace);
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

    // ---- Async geocoding + logging pipeline --------------------------------
    const run = async () => {
      onGeocoding?.(true);
      try {
        console.info(`${LOG} start`, {
          arrivalLocation,
          placeCount: places.length,
          venues: places.map((p) => ({ name: p.name, day: p.day, type: p.type })),
        });

        // Step 1: Geocode the city for fallback coords + proximity bias.
        const cityResult = await geocodeVenueDetailed(arrivalLocation);
        if (cancelled) return;

        const cityCoords: { lat: number; lng: number } | null = cityResult
          ? { lat: cityResult.lat, lng: cityResult.lng }
          : null;

        console.info(`${LOG} city geocode`, {
          query: arrivalLocation,
          resolvedLat: cityResult?.lat ?? null,
          resolvedLng: cityResult?.lng ?? null,
          resolvedPlaceName: cityResult?.placeName ?? null,
          relevance: cityResult?.relevance ?? null,
          warning: cityCoords === null
            ? 'CITY GEOCODE FAILED — no proximity bias, no city fallback'
            : null,
        });

        // Step 2: Deduplicate venue names so each unique name makes exactly one API call.
        const uniqueNames = [...new Set(places.map((p) => p.name))];
        const cache = new Map<string, GeocodingResult>();

        await Promise.all(
          uniqueNames.map(async (name) => {
            if (!name) {
              console.warn(`${LOG} geocode request: SKIPPED — empty venue name`);
              return;
            }

            // Build a loggable URL (access_token redacted).
            const logQuery = arrivalLocation ? `${name}, ${arrivalLocation}` : name;
            const proximityStr = cityCoords
              ? `${cityCoords.lng},${cityCoords.lat}`
              : '(none — city geocode failed)';
            const logUrl =
              `https://api.mapbox.com/geocoding/v5/mapbox.places/` +
              `${encodeURIComponent(logQuery)}.json` +
              `?limit=1&proximity=${proximityStr}&access_token=REDACTED`;

            console.info(`${LOG} geocode request`, {
              venueName: name,
              cityHint: arrivalLocation || '(none)',
              proximityCoords: cityCoords,
              requestUrl: logUrl,
            });

            const r = await geocodeVenueDetailed(name, arrivalLocation, cityCoords ?? undefined);

            if (r) {
              cache.set(name, r);
              console.info(`${LOG} geocode response`, {
                venueName: name,
                resolvedLat: r.lat,
                resolvedLng: r.lng,
                resolvedPlaceName: r.placeName,
                relevance: r.relevance,
                usedFallback: false,
              });
            } else {
              console.warn(`${LOG} geocode response: NO MATCH`, {
                venueName: name,
                cityHint: arrivalLocation || '(none)',
                note: 'Venue not found in Mapbox index. Will fall back to city coords.',
              });
            }
          }),
        );

        if (cancelled) return;

        // Step 3: Build GeocodedPlace array with per-place fallback tracking.
        const geocoded: GeocodedPlace[] = places.map((p) => {
          const coords = cache.get(p.name);
          if (coords) {
            return {
              ...p,
              resolvedLat: coords.lat,
              resolvedLng: coords.lng,
              resolvedPlaceName: coords.placeName,
              relevance: coords.relevance,
              usedFallback: 'none' as const,
            };
          }
          if (cityCoords) {
            return {
              ...p,
              resolvedLat: cityCoords.lat,
              resolvedLng: cityCoords.lng,
              resolvedPlaceName: arrivalLocation,
              relevance: 0,
              usedFallback: 'city' as const,
            };
          }
          // Last resort: server-supplied coords (may be wrong but keeps pin visible).
          return {
            ...p,
            resolvedLat: p.lat,
            resolvedLng: p.lng,
            resolvedPlaceName: '(server coords — may be inaccurate)',
            relevance: 0,
            usedFallback: 'server' as const,
          };
        });

        // Step 4: Summary log.
        const geocodedOk = geocoded.filter((p) => p.usedFallback === 'none').length;
        const fellBackToCity = geocoded.filter((p) => p.usedFallback === 'city').length;
        const failedCount = geocoded.filter((p) => p.usedFallback === 'server').length;

        const distances = cityCoords
          ? geocoded
              .filter((p) => p.usedFallback !== 'server')
              .map((p) =>
                haversineKm(p.resolvedLat, p.resolvedLng, cityCoords.lat, cityCoords.lng),
              )
          : [];
        const avgDist =
          distances.length > 0
            ? Number((distances.reduce((a, b) => a + b, 0) / distances.length).toFixed(2))
            : null;

        console.info(`${LOG} final summary`, {
          totalVenues: geocoded.length,
          geocodedOk,
          fellBackToCity,
          failed: failedCount,
          avgDistanceFromCityCenterKm: avgDist,
        });

        // Step 5: Anomaly detection — flag anything > 50 km from the city centre.
        if (cityCoords) {
          for (const p of geocoded) {
            const dist = haversineKm(
              p.resolvedLat,
              p.resolvedLng,
              cityCoords.lat,
              cityCoords.lng,
            );
            if (dist > 50) {
              console.warn(`${LOG} ANOMALY: pin > 50 km from city centre`, {
                venueName: p.name,
                resolvedLat: p.resolvedLat,
                resolvedLng: p.resolvedLng,
                resolvedPlaceName: p.resolvedPlaceName,
                distanceKm: Number(dist.toFixed(2)),
                usedFallback: p.usedFallback,
                relevance: p.relevance,
                cityCenter: cityCoords,
                hypothesis:
                  p.relevance < 0.5
                    ? 'Low relevance — Mapbox picked a weak match. Very common name or missing city hint.'
                    : p.usedFallback === 'city'
                    ? 'City fallback used (venue had no Mapbox match).'
                    : 'Despite a high-relevance match the place is far away — check if this is a real venue at this location.',
              });
            }
          }
        }

        // Step 6: Install GL layers.
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
      // Close any open popup for this itinerary run.
      setSelectedPlace(null);

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