import { useEffect, useRef } from "react";
import mapboxgl, { Map as MapboxMap, LngLat } from "mapbox-gl";
import { DEFAULT_CENTER, DEFAULT_ZOOM } from "./mapConstants";

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN as string;

// Signature look. All three knobs are opt-out via props so we can kill them
// on mobile/low-power later if Lighthouse complains.
const DEFAULT_STYLE = "mapbox://styles/mapbox/outdoors-v12"; // terrain-y, travel-y
const DEFAULT_PITCH = 30;       // tilt for depth without disorienting
const TERRAIN_EXAGGERATION = 1.3; // 1.0 = realistic, >1.5 = cartoony
const FOG_COLOR = "rgb(220, 232, 238)";
const FOG_HORIZON_BLEND = 0.03;

export type MapCanvasProps = {
  /** Initial center override (e.g. passed in from a search). */
  initialCenter?: { lng: number; lat: number } | null;
  /**
   * Fires once after the Mapbox instance is constructed. Store the map in a
   * ref upstairs and pass it to PinLayer / PinPopup. The component will NOT
   * fire this again if the map is recreated (we dont recreate it).
   */
  onMapReady: (map: MapboxMap) => void;
  /** Empty-map click (no popup, no draft). Receives clicked lnglat. */
  onMapClick?: (lngLat: LngLat) => void;
  /** Custom style URL. Defaults to outdoors-v12. */
  styleUrl?: string;
  /** Enable 3D terrain via Mapbox DEM. Default on. */
  terrain?: boolean;
  /** Enable atmospheric fog at horizon. Default on. */
  fog?: boolean;
};

/**
 * Thin wrapper around a Mapbox instance.
 *
 * Only the map container and its lifecycle live here everything else
 * (markers, popups, UI overlays) is rendered by siblings outside this
 * component and wired via refs the parent holds.
 */
export function MapCanvas({
  initialCenter,
  onMapReady,
  onMapClick,
  styleUrl = DEFAULT_STYLE,
  terrain = true,
  fog = true,
}: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapboxMap | null>(null);

  // Keep the latest click handler in a ref so re-rendering the parent
  // doesnt re-subscribe on every render.
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
      pitch: DEFAULT_PITCH,
    });

    map.on("click", (e) => {
      clickHandlerRef.current?.(e.lngLat);
    });

    // Terrain + fog must be set AFTER the style loads  Mapbox requires
    // the style (and its sources) to be ready before addSource/setTerrain.
    map.on("load", () => {
      if (terrain) {
        if (!map.getSource("mapbox-dem")) {
          map.addSource("mapbox-dem", {
            type: "raster-dem",
            url: "mapbox://mapbox.mapbox-terrain-dem-v1",
            tileSize: 512,
            maxzoom: 14,
          });
        }
        map.setTerrain({ source: "mapbox-dem", exaggeration: TERRAIN_EXAGGERATION });
      }
      if (fog) {
        map.setFog({
          color: FOG_COLOR,
          "horizon-blend": FOG_HORIZON_BLEND,
          "high-color": "#add8e6",
          "space-color": "#d8e8f5",
          "star-intensity": 0.0,
        });
      }
    });

    mapRef.current = map;
    onMapReady(map);

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // initialCenter/styleUrl intentionally not in deps: we dont support
    // rebuilding the map in-place. If you need that, teardown + remount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />;
}
