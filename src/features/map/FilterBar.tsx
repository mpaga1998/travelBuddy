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
    <div
      style={{
        borderBottom: "1px solid rgba(0,0,0,0.08)",
        background: "white",
        color: "#111",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: isMobile ? 8 : 12,
          alignItems: "center",
          padding: isMobile ? "8px 10px" : "10px 12px",
          maxWidth: isMobile ? "100%" : 1100,
          margin: "0 auto",
          flexWrap: "nowrap",
          justifyContent: isMobile ? "space-between" : "flex-start",
        }}
      >
        <button
          onClick={onBack}
          style={{
            border: "none",
            background: "transparent",
            cursor: onBack ? "pointer" : "default",
            padding: "8px 10px",
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontWeight: 600,
            fontSize: 14,
            color: "#111",
            outline: "none",
          }}
          aria-label="Back"
        >
          ↩️ Back
        </button>

        <button
          onClick={onLogoClick}
          title="Click to recenter on north"
          style={{
            position: isMobile ? "absolute" : "relative",
            left: isMobile ? "50%" : "auto",
            transform: isMobile ? "translateX(-50%)" : "none",
            fontWeight: 700,
            whiteSpace: "nowrap",
            fontSize: isMobile ? 14 : 16,
            border: "none",
            background: "transparent",
            cursor: "pointer",
            padding: "4px 8px",
            outline: "none",
            color: "#111",
          }}
        >
          🎒 travelBuddy
        </button>

        {!isMobile && <div style={{ flex: 1 }} />}

        {!isMobile && (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <MapTypeToggle mapType={mapType} setMapType={setMapType} />

            {mapType !== "bookmarked" && (
              <select
                value={activeCategory}
                onChange={(e) => setActiveCategory(e.target.value as PinCategory | "all")}
                style={{
                  padding: "8px 10px",
                  borderRadius: 10,
                  border: "1px solid rgba(0,0,0,0.18)",
                  minWidth: 170,
                  fontSize: 14,
                }}
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
          <div style={{ display: "flex", gap: 8 }}>
            {AGE_RANGES.map((range) => {
              const active = selectedAgeRanges.includes(range.value);
              return (
                <button
                  key={range.value}
                  onClick={() => toggleAge(range.value)}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 10,
                    border: active ? "2px solid #2563eb" : "1px solid rgba(0,0,0,0.18)",
                    background: active ? "#eff6ff" : "white",
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: active ? 600 : 500,
                    color: active ? "#2563eb" : "#111",
                    minHeight: 44,
                    whiteSpace: "nowrap",
                    outline: "none",
                  }}
                >
                  {range.label}
                </button>
              );
            })}
          </div>
        )}

        <div style={{ flex: 1 }} />

        {isMobile && (
          <button
            onClick={() => setMobileMenuOpen((o) => !o)}
            aria-label="Filters"
            title="Filters"
            style={{
              width: 44,
              height: 44,
              borderRadius: 8,
              border: "1px solid rgba(0,0,0,0.18)",
              background: "white",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
              padding: 6,
              position: "relative",
            }}
          >
            <div style={{ width: 20, height: 2, background: "#111", borderRadius: 1 }} />
            <div style={{ width: 20, height: 2, background: "#111", borderRadius: 1 }} />
            <div style={{ width: 20, height: 2, background: "#111", borderRadius: 1 }} />
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
  const pill = (t: MapType, activeBg: string, label: string, title: string) => (
    <button
      onClick={() => setMapType(t)}
      title={title}
      style={{
        flex: full ? 1 : undefined,
        padding: full ? "8px 12px" : "6px 12px",
        border: "none",
        background: mapType === t ? activeBg : "transparent",
        color: mapType === t ? "white" : "#111",
        cursor: "pointer",
        fontSize: full ? 13 : 14,
        fontWeight: mapType === t ? 600 : 500,
        borderRadius: 8,
        transition: "all 0.2s ease",
        outline: "none",
      }}
    >
      {label}
    </button>
  );

  return (
    <div
      style={{
        display: "flex",
        borderRadius: 10,
        border: "1px solid rgba(0,0,0,0.18)",
        background: "white",
        padding: 2,
      }}
    >
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
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        zIndex: 100,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "white",
          borderBottomLeftRadius: 12,
          borderBottomRightRadius: 12,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "12px 12px 0 12px",
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 600, color: "#111" }}>Filters</span>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              border: "none",
              background: "transparent",
              fontSize: 24,
              cursor: "pointer",
              padding: "4px 8px",
              minHeight: 44,
              minWidth: 44,
              outline: "none",
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ padding: "0 12px" }}>
          <div style={{ marginBottom: 10 }}>
            <MapTypeToggle mapType={mapType} setMapType={setMapType} full />
          </div>
        </div>

        {mapType === "travelers" && (
          <div
            style={{
              padding: "0 12px 12px 12px",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <select
              value={activeCategory}
              onChange={(e) => setActiveCategory(e.target.value as PinCategory | "all")}
              style={{
                padding: 12,
                borderRadius: 10,
                border: "1px solid rgba(0,0,0,0.18)",
                fontSize: 14,
                width: "100%",
                boxSizing: "border-box",
                minHeight: 44,
              }}
            >
              <option value="all">All Categories</option>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {categoryEmoji(c.value)} {c.label}
                </option>
              ))}
            </select>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {AGE_RANGES.map((range) => {
                const active = selectedAgeRanges.includes(range.value);
                return (
                  <button
                    key={range.value}
                    onClick={() => toggleAge(range.value)}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 10,
                      border: active ? "2px solid #2563eb" : "1px solid rgba(0,0,0,0.18)",
                      background: active ? "#eff6ff" : "white",
                      cursor: "pointer",
                      fontSize: 13,
                      fontWeight: active ? 600 : 500,
                      color: active ? "#2563eb" : "#111",
                      minHeight: 44,
                      flex: "1 1 auto",
                      minWidth: "calc(50% - 4px)",
                      outline: "none",
                    }}
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
