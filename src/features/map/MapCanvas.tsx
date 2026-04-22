import { useEffect, useRef } from "react";
import mapboxgl, { Map as MapboxMap, LngLat } from "mapbox-gl";
import { DEFAULT_CENTER, DEFAULT_ZOOM } from "./mapConstants";

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN as string;

export type MapCanvasProps = {
  /** Initial center override (e.g. passed in from a search). */
  initialCenter?: { lng: number; lat: number } | null;
  /**
   * Fires once after the Mapbox instance is constructed. Store the map in a
   * ref upstairs and pass it to PinLayer / PinPopup. The component will NOT
   * fire this again if the map is recreated (we don't recreate it).
   */
  onMapReady: (map: MapboxMap) => void;
  /** Empty-map click (no popup, no draft). Receives clicked lnglat. */
  onMapClick?: (lngLat: LngLat) => void;
  /** Custom style URL. Defaults to streets-v12. Change here for 2.x polish. */
  styleUrl?: string;
};

/**
 * Thin wrapper around a Mapbox instance.
 *
 * Only the map container and its lifecycle live here — everything else
 * (markers, popups, UI overlays) is rendered by siblings outside this
 * component and wired via refs the parent holds.
 */
export function MapCanvas({
  initialCenter,
  onMapReady,
  onMapClick,
  styleUrl = "mapbox://styles/mapbox/streets-v12",
}: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapboxMap | null>(null);

  // Keep the latest click handler in a ref so re-rendering the parent
  // doesn't re-subscribe on every render.
  const clickHandlerRef = useRef(onMapClick);
  useEffect(() => {
    clickHandlerRef.current = onMapClick;
  }, [onMapClick]);

  useEffect(() => {
    if (mapRef.current) return;
    if (!containerRef.current) return;
    if (!mapboxgl.accessToken) {
      console.error("Missing VITE_MAPBOX_TOKEN in .env");
      return;
    }

    const center = initialCenter || DEFAULT_CENTER;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: styleUrl,
      center: [center.lng, center.lat],
      zoom: DEFAULT_ZOOM,
    });

    map.on("click", (e) => {
      clickHandlerRef.current?.(e.lngLat);
    });

    mapRef.current = map;
    onMapReady(map);

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // initialCenter/styleUrl intentionally not in deps: we don't support
    // rebuilding the map in-place. If you need that, teardown + remount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />;
}
