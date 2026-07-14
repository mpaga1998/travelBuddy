import { useEffect, useState } from "react";
import { type Map as MapboxMap } from "mapbox-gl";

// Shows the map's current bearing as a rotating N-needle. Clicking snaps
// bearing back to 0° (north up) with a short animation, matching Google Maps.
// Always visible so users always know which way is north.
export function CompassButton({ map }: { map: MapboxMap | null }) {
  const [bearing, setBearing] = useState(0);

  useEffect(() => {
    if (!map) return;
    const onRotate = () => setBearing(map.getBearing());
    map.on("rotate", onRotate);
    // Sync immediately in case map was already rotated.
    setBearing(map.getBearing());
    return () => { map.off("rotate", onRotate); };
  }, [map]);

  const handleClick = () => {
    if (!map) return;
    map.easeTo({ bearing: 0, pitch: 30, duration: 400 });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="Reset bearing to north"
      className="absolute right-4 bottom-20 z-10 w-10 h-10 rounded-full bg-white shadow-[0_2px_8px_rgba(0,0,0,0.22)] border border-black/[0.08] flex items-center justify-center hover:bg-gray-50 active:scale-95 transition-transform"
    >
      {/* Needle SVG: red = north, grey = south. Rotated so the red tip always
          points toward true north regardless of the map's bearing. */}
      <svg
        width="22"
        height="22"
        viewBox="0 0 22 22"
        style={{ transform: `rotate(${-bearing}deg)`, transition: "transform 0.1s linear" }}
        aria-hidden
      >
        {/* North half — red */}
        <polygon points="11,2 8,11 14,11" fill="#e53e3e" />
        {/* South half — light grey */}
        <polygon points="11,20 8,11 14,11" fill="#a0aec0" />
        {/* Centre dot */}
        <circle cx="11" cy="11" r="1.8" fill="#4a5568" />
      </svg>
    </button>
  );
}
