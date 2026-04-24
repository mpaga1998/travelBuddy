import { useEffect, useRef } from "react";
import mapboxgl, { Map as MapboxMap, LngLat } from "mapbox-gl";
import { DEFAULT_CENTER, DEFAULT_ZOOM } from "./mapConstants";

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN as string;

const DEFAULT_STYLE = "mapbox://styles/mapbox/outdoors-v12";
const DEFAULT_PITCH = 30;
const TERRAIN_EXAGGERATION = 1.3;
const FOG_COLOR = "rgb(220, 232, 238)";
const FOG_HORIZON_BLEND = 0.03;

export type MapCanvasProps = {
  initialCenter?: { lng: number; lat: number } | null;
  onMapReady: (map: MapboxMap) => void;
  onMapClick?: (lngLat: LngLat) => void;
  styleUrl?: string;
  terrain?: boolean;
  fog?: boolean;
  /**
   * Layer ids whose rendered features should swallow an empty-map click.
   * Used so clicks on cluster bubbles don't trigger the draft flow.
   */
  interactiveLayers?: string[];
};

export function MapCanvas({
  initialCenter,
  onMapReady,
  onMapClick,
  styleUrl = DEFAULT_STYLE,
  terrain = true,
  fog = true,
  interactiveLayers,
}: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapboxMap | null>(null);

  const clickHandlerRef = useRef(onMapClick);
  useEffect(() => { clickHandlerRef.current = onMapClick; }, [onMapClick]);
  const interactiveLayersRef = useRef(interactiveLayers);
  useEffect(() => { interactiveLayersRef.current = interactiveLayers; }, [interactiveLayers]);

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
      // Skip empty-map handler if the click hit any interactive layer.
      const layers = interactiveLayersRef.current;
      if (layers && layers.length) {
        const present = layers.filter((l) => map.getLayer(l));
        if (present.length) {
          const hits = map.queryRenderedFeatures(e.point, { layers: present });
          if (hits.length) return;
        }
      }
      clickHandlerRef.current?.(e.lngLat);
    });

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Use w-full/h-full (not absolute/inset) so Mapbox resolves a real size from
  