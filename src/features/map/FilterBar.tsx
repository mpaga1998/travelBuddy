import { useState } from "react";
import type { PinCategory } from "../pins/pinTypes";
import { AGE_RANGES, CATEGORIES, categoryEmoji, type MapType } from "./mapConstants";
import { useIsMobile } from "./hooks/useIsMobile";

export type FilterBarProps = {
  onBack?: () => void;
  onLogoClick?: () => void;

  mapType: MapType;
  setMapType: (t: MapType) => void;

  activeCategory: PinCategory | "all";
  setActiveCategory: (c: PinCategory | "all") => void;

  selectedAgeRanges: string[];
  setSelectedAgeRanges: (r: string[]) => void;
};

// Shared age-range pill class. Active state toggles color + border weight.
function ageRangeBtnClass(active: boolean, extra = "") {
  return `px-3 py-2 rounded-[10px] cursor-pointer text-[13px] min-h-[44px] whitespace-nowrap outline-none ${
    active
      ? "border-2 border-blue-600 bg-blue-50 font-semibold text-blue-600"
      : "border border-black/[0.18] bg-white font-medium text-[#111]"
  } ${extra}`;
}

/**
 * Top bar + filters. Controlled component — filter state lives in the parent
 * (useMapPins) so the actual pin query can derive from it.
 *
 * Desktop = inline controls in the header.
 * Mobile  = hamburger button opens a drawer with the same controls.
 */
export function FilterBar({
  onBack,
  onLogoClick,
  mapType,
  setMapType,
  activeCategory,
  setActiveCategory,
  selectedAgeRanges,
  setSelectedAgeRanges,
}: FilterBarProps) {
  const isMobile = useIsMobile();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const toggleAge = (value: string) => {
    if (selectedAgeRanges.includes(value)) {
      setSelectedAgeRanges(selectedAgeRanges.filter((r) => r !== value));
    } else {
      setSelectedAgeRanges([...selectedAgeRanges, value]);
    }
  };

  return (
    <div className="border-b border-black/[0.08] bg-white text-[#111]">
      <div
        className={`flex items-center flex-nowrap mx-auto ${
          isMobile
            ? "gap-2 px-2.5 py-2 max-w-full justify-between"
            : "gap-3 px-3 py-2.5 max-w-[1100px] justify-start"
        }`}
      >
        <button
          onClick={onBack}
          className={`border-none bg-transparent px-2.5 py-2 flex items-center gap-1.5 font-semibold text-sm text-[#111] outline-none ${onBack ? "cursor-pointer" : "cursor-default"}`}
          aria-label="Back"
        >
          ↩️ Back
        </button>

        <button
          onClick={onLogoClick}
          title="Click to recenter on north"
          className={`font-bold whitespace-nowrap border-none bg-transparent cursor-pointer px-2 py-1 outline-none text-[#111] ${
            isMobile
              ? "absolute left-1/2 -translate-x-1/2 text-sm"
              : "relative text-base"
          }`}
        >
          🎒 travelBuddy
        </button>

        {!isMobile && <div className="flex-1" />}

        {!isMobile && (
          <div className="flex gap-2 items-center">
            <MapTypeToggle mapType={mapType} setMapType={setMapType} />

            {mapType !== "bookmarked" && (
              <select
                value={activeCategory}
                onChange={(e) => setActiveCategory(e.target.value as PinCategory | "all")}
                className="px-2.5 py-2 rounded-[10px] border border-black/[0.18] min-w-[170px] text-sm"
              >
                <option value="all">All</option>
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {categoryEmoji(c.value)} {c.label}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {!isMobile && mapType === "travelers" && (
          <div className="flex gap-2">
            {AGE_RANGES.map((range) => {
              const active = selectedAgeRanges.includes(range.value);
              return (
                <button
                  key={range.value}
                  onClick={() => toggleAge(range.value)}
                  className={ageRangeBtnClass(active)}
                >
                  {range.label}
                </button>
              );
            })}
          </div>
        )}

        <div className="flex-1" />

        {isMobile && (
          <button
            onClick={() => setMobileMenuOpen((o) => !o)}
            aria-label="Filters"
            title="Filters"
            className="w-11 h-11 rounded-lg border border-black/[0.18] bg-white cursor-pointer flex flex-col items-center justify-center gap-1 p-1.5 relative"
          >
            <div className="w-5 h-0.5 bg-[#111] rounded-[1px]" />
            <div className="w-5 h-0.5 bg-[#111] rounded-[1px]" />
            <div className="w-5 h-0.5 bg-[#111] rounded-[1px]" />
          </button>
        )}
      </div>

      {isMobile && mobileMenuOpen && (
        <MobileFilterDrawer
          mapType={mapType}
          setMapType={setMapType}
          activeCategory={activeCategory}
          setActiveCategory={(c) => {
            setActiveCategory(c);
            setMobileMenuOpen(false);
          }}
          selectedAgeRanges={selectedAgeRanges}
          toggleAge={toggleAge}
          onClose={() => setMobileMenuOpen(false)}
        />
      )}
    </div>
  );
}

// --- Subcomponents (file-local) -------------------------------------------

function MapTypeToggle({
  mapType,
  setMapType,
  full,
}: {
  mapType: MapType;
  setMapType: (t: MapType) => void;
  full?: boolean;
}) {
  // The active background color is per-tab, so we keep it as inline style.
  const pill = (t: MapType, activeBg: string, label: string, title: string) => {
    const isActive = mapType === t;
    return (
      <button
        onClick={() => setMapType(t)}
        title={title}
        className={`border-none cursor-pointer rounded-lg outline-none transition-all ${
          full ? "px-3 py-2 text-[13px]" : "px-3 py-1.5 text-sm"
        } ${full ? "flex-1" : ""} ${isActive ? "text-white font-semibold" : "bg-transparent text-[#111] font-medium"}`}
        style={isActive ? { background: activeBg } : undefined}
      >
        {label}
      </button>
    );
  };

  return (
    <div className="flex rounded-[10px] border border-black/[0.18] bg-white p-0.5">
      {pill("travelers", "#2563eb", "👥 Travelers", "Show pins from travelers")}
      {pill("hostels", "#111", "🏫 Hostels", "Show pins from hostels")}
      {pill("bookmarked", "#16a34a", "🔖 Your Map", "Show your bookmarked pins")}
    </div>
  );
}

function MobileFilterDrawer({
  mapType,
  setMapType,
  activeCategory,
  setActiveCategory,
  selectedAgeRanges,
  toggleAge,
  onClose,
}: {
  mapType: MapType;
  setMapType: (t: MapType) => void;
  activeCategory: PinCategory | "all";
  setActiveCategory: (c: PinCategory | "all") => void;
  selectedAgeRanges: string[];
  toggleAge: (v: string) => void;
  onClose: () => void;
}) {
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/40 z-[100]"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-b-xl flex flex-col gap-2.5"
      >
        <div className="flex justify-between items-center px-3 pt-3">
          <span className="text-sm font-semibold text-[#111]">Filters</span>
          <button
            onClick={onClose}
            aria-label="Close"
            className="border-none bg-transparent text-2xl cursor-pointer px-2 py-1 min-h-[44px] min-w-[44px] outline-none"
          >
            ✕
          </button>
        </div>

        <div className="px-3">
          <div className="mb-2.5">
            <MapTypeToggle mapType={mapType} setMapType={setMapType} full />
          </div>
        </div>

        {mapType === "travelers" && (
          <div className="px-3 pb-3 flex flex-col gap-2.5">
            <select
              value={activeCategory}
              onChange={(e) => setActiveCategory(e.target.value as PinCategory | "all")}
              className="p-3 rounded-[10px] border border-black/[0.18] text-sm w-full box-border min-h-[44px]"
            >
              <option value="all">All Categories</option>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {categoryEmoji(c.value)} {c.label}
                </option>
              ))}
            </select>

            <div className="flex gap-2 flex-wrap">
              {AGE_RANGES.map((range) => {
                const active = selectedAgeRanges.includes(range.value);
                return (
                  <button
                    key={range.value}
                    onClick={() => toggleAge(range.value)}
                    className={ageRangeBtnClass(active, "flex-[1_1_auto] min-w-[calc(50%-4px)]")}
                  >
                    {range.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
