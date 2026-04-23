import { useState, useEffect, useRef } from "react";
import { supabase } from "../../lib/supabaseClient";
import { ItineraryModal } from "../itinerary/ItineraryModal";
import { ProfileModal } from "../profile/profileModal";
import { getMyProfile } from "../profile/profileApi";

import type { ExtractedPlace } from '../itinerary/itineraryMapOverlay';

interface InitialPageProps {
  onGoToMap: (location: { lng: number; lat: number } | null, itineraryPlaces?: ExtractedPlace[]) => void;
}

interface Suggestion {
  id: string;
  place_name: string;
  center: [number, number];
}

export function InitialPage({ onGoToMap }: InitialPageProps) {
  const [showComingSoon, setShowComingSoon] = useState(false);
  const [itineraryModalOpen, setItineraryModalOpen] = useState(false);
  const [searchActive, setSearchActive] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState("");
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN as string;

  // Click outside handler
  useEffect(() => {
    if (!searchActive) return;

    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setSearchActive(false);
        setSearchInput("");
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [searchActive]);

  // Fetch suggestions as user types
  useEffect(() => {
    if (!searchInput.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
            searchInput
          )}.json?access_token=${mapboxToken}&limit=5`
        );
        const data = await response.json();

        if (data.features && data.features.length > 0) {
          setSuggestions(
            data.features.map((feature: any) => ({
              id: feature.id,
              place_name: feature.place_name,
              center: feature.geometry.coordinates,
            }))
          );
          setShowSuggestions(true);
        } else {
          setSuggestions([]);
        }
      } catch (error) {
        console.error("Suggestions fetch failed:", error);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchInput, mapboxToken]);

  // Load profile avatar on mount
  useEffect(() => {
    (async () => {
      try {
        const p = await getMyProfile();
        setAvatarUrl(p.avatar_url ?? "");
      } catch (error) {
        console.error("Failed to load profile:", error);
      }
    })();
  }, []);

  async function handleSearchSubmit(location?: Suggestion) {
    const selectedLocation = location || suggestions[0];
    if (!selectedLocation) return;

    const [lng, lat] = selectedLocation.center;
    onGoToMap({ lng, lat });
    setSearchActive(false);
    setSearchInput("");
    setSuggestions([]);
    setShowSuggestions(false);
  }

  async function handleSignOut() {
    setShowSignOutConfirm(false);
    await supabase.auth.signOut();
  }

  return (
    <div
      style={{
        width: "100vw",
        height: "100dvh",
        background: "linear-gradient(135deg, #ff8c00 0%, #ff6b00 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        boxSizing: "border-box",
        color: "white",
        fontFamily: "system-ui, -apple-system, sans-serif",
        overflow: "hidden",
      }}
    >
      {/* Logo / Icon */}
      <div
        style={{
          width: "80px",
          height: "80px",
          background: "white",
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "48px",
          marginBottom: "32px",
          boxShadow: "0 8px 24px rgba(0, 0, 0, 0.2)",
        }}
      >
        🧭
      </div>

      {/* Title */}
      <h1
        style={{
          fontSize: "36px",
          fontWeight: "bold",
          margin: "0 0 12px 0",
          textAlign: "center",
        }}
      >
        travelBuddy
      </h1>

      {/* Subtitle */}
      <p
        style={{
          fontSize: "16px",
          fontWeight: "400",
          margin: "0 0 48px 0",
          textAlign: "center",
          opacity: 0.95,
          maxWidth: "280px",
        }}
      >
        Discover amazing places and create unforgettable memories
      </p>

      {/* Profile Button (Top Left) */}
      <button
        onClick={() => setProfileOpen(true)}
        style={{
          position: "absolute",
          top: "20px",
          left: "20px",
          width: "44px",
          height: "44px",
          borderRadius: "50%",
          border: "none",
          background: "rgba(255, 255, 255, 0.25)",
          cursor: "pointer",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 0,
          transition: "background 0.2s",
          backdropFilter: "blur(10px)",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = "rgba(255, 255, 255, 0.35)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = "rgba(255, 255, 255, 0.25)";
        }}
        onTouchStart={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = "rgba(255, 255, 255, 0.35)";
        }}
        onTouchEnd={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = "rgba(255, 255, 255, 0.25)";
        }}
        aria-label="Open profile"
        title="Profile"
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt="avatar"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <span style={{ fontSize: 20, color: "white" }}>🙂</span>
        )}
      </button>

      {/* Sign Out Button (Top Right) */}
      <button
        onClick={() => setShowSignOutConfirm(true)}
        style={{
          position: "absolute",
          top: "20px",
          right: "20px",
          width: "44px",
          height: "44px",
          borderRadius: "50%",
          border: "none",
          background: "rgba(255, 255, 255, 0.25)",
          color: "white",
          cursor: "pointer",
          fontSize: "20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "background 0.2s",
          backdropFilter: "blur(10px)",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = "rgba(255, 255, 255, 0.35)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = "rgba(255, 255, 255, 0.25)";
        }}
        title="Sign out"
      >
        👋
      </button>

      {/* Buttons Container */}
      <div
        style={{
          width: "100%",
          maxWidth: "380px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        {/* Button 1: Where Next? - Transforms into search bar */}
        {!searchActive ? (
          <button
            onClick={() => setSearchActive(true)}
            style={{
              width: "100%",
              padding: "18px 20px",
              fontSize: "18px",
              fontWeight: "600",
              border: "none",
              borderRadius: "16px",
              background: "white",
              color: "#ff8c00",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "12px",
              transition: "transform 0.2s, box-shadow 0.2s",
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
            }}
            onMouseDown={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.98)";
            }}
            onMouseUp={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
            }}
            onTouchStart={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.98)";
            }}
            onTouchEnd={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
            }}
          >
            <span>🌍</span>
            <span>Where next?</span>
          </button>
        ) : (
          <div
            ref={searchContainerRef}
            style={{
              width: "100%",
              position: "relative",
            }}
          >
            <div
              style={{
                width: "100%",
                display: "flex",
                gap: "12px",
                alignItems: "center",
                justifyContent: "space-between",
                background: "white",
                borderRadius: "16px",
                padding: "18px 20px",
                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
                color: "#111",
                lineHeight: "1",
                minHeight: "56px",
                boxSizing: "border-box",
              }}
            >
              <span style={{ fontSize: "18px", flexShrink: 0, display: "flex", alignItems: "center" }}>🌍</span>
              <input
                autoFocus
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && suggestions.length > 0) {
                    handleSearchSubmit(suggestions[0]);
                  }
                  if (e.key === "Escape") {
                    setSearchActive(false);
                    setSearchInput("");
                    setSuggestions([]);
                    setShowSuggestions(false);
                  }
                }}
                placeholder="Search location..."
                style={{
                  flex: 1,
                  border: "none",
                  fontSize: "16px",
                  outline: "none",
                  fontFamily: "inherit",
                  color: "#111",
                  background: "transparent",
                  height: "auto",
                  margin: "0",
                  padding: "0",
                  lineHeight: "1",
                  WebkitAppearance: "none",
                  appearance: "none",
                }}
              />
              <button
                onClick={() => {
                  setSearchActive(false);
                  setSearchInput("");
                  setSuggestions([]);
                  setShowSuggestions(false);
                }}
                style={{
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  fontSize: "16px",
                  padding: "0 4px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#111",
                  flexShrink: 0,
                  height: "auto",
                  minWidth: "24px",
                  lineHeight: "1",
                }}
                title="Cancel"
              >
                ✕
              </button>
            </div>

            {/* Suggestions Dropdown - Scrollable */}
            {showSuggestions && suggestions.length > 0 && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 8px)",
                  left: 0,
                  right: 0,
                  background: "white",
                  borderRadius: "12px",
                  boxShadow: "0 8px 24px rgba(0, 0, 0, 0.2)",
                  maxHeight: "220px",
                  overflowY: "scroll",
                  overflow: "hidden",
                  zIndex: 1000,
                  WebkitOverflowScrolling: "touch",
                }}
              >
                {suggestions.map((suggestion, idx) => (
                  <div
                    key={suggestion.id}
                    onClick={() => handleSearchSubmit(suggestion)}
                    style={{
                      padding: "14px 16px",
                      borderBottom: idx < suggestions.length - 1 ? "1px solid rgba(0, 0, 0, 0.08)" : "none",
                      cursor: "pointer",
                      transition: "background 0.2s",
                      color: "#111",
                      fontSize: "15px",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLDivElement).style.background = "rgba(255, 140, 0, 0.08)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLDivElement).style.background = "transparent";
                    }}
                  >
                    📍 {suggestion.place_name}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Button 2: Create Itinerary (closes search bar if active) */}
        <button
          onClick={() => {
            if (searchActive) {
              setSearchActive(false);
              setSearchInput("");
              setSuggestions([]);
              setShowSuggestions(false);
            }
            setItineraryModalOpen(true);
          }}
          style={{
            width: "100%",
            padding: "18px 20px",
            fontSize: "18px",
            fontWeight: "600",
            border: "none",
            borderRadius: "16px",
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            color: "white",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "12px",
            transition: "transform 0.2s, box-shadow 0.2s",
            boxShadow: "0 6px 16px rgba(102, 126, 234, 0.4)",
          }}
          onMouseDown={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.98)";
          }}
          onMouseUp={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
          }}
          onTouchStart={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.98)";
          }}
          onTouchEnd={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
          }}
        >
          <span>✨</span>
          <span>Create your custom travel itinerary!</span>
        </button>
      </div>

      {/* Sign Out Confirmation Modal */}
      {showSignOutConfirm && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10000,
          }}
          onClick={() => setShowSignOutConfirm(false)}
        >
          <div
            style={{
              background: "white",
              borderRadius: "20px",
              padding: "24px",
              maxWidth: "300px",
              boxShadow: "0 12px 48px rgba(0, 0, 0, 0.3)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: "0 0 12px 0", fontSize: "18px", color: "#111" }}>
              Sign out?
            </h3>
            <p style={{ margin: "0 0 24px 0", fontSize: "14px", color: "#666", lineHeight: "1.5" }}>
              Are you sure you want to sign out? You'll need to sign in again to access your profile.
            </p>
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowSignOutConfirm(false)}
                style={{
                  padding: "10px 20px",
                  borderRadius: "10px",
                  border: "1px solid rgba(0, 0, 0, 0.18)",
                  background: "white",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: "600",
                  color: "#111",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSignOut}
                style={{
                  padding: "10px 20px",
                  borderRadius: "10px",
                  border: "none",
                  background: "#ff4444",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: "600",
                  color: "white",
                }}
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Itinerary Modal */}
      <ItineraryModal
        open={itineraryModalOpen}
        onClose={() => setItineraryModalOpen(false)}
        onViewOnMap={(places, _arrivalLocation) => {
          setItineraryModalOpen(false);
          // Pass null center so MapCanvas uses DEFAULT_CENTER; ItineraryMapLayer
          // will call fitBounds once the map style loads.
          onGoToMap(null, places);
        }}
      />

      {/* Profile Modal */}
      <ProfileModal
        open={profileOpen}
        onClose={async () => {
          setProfileOpen(false);
          try {
            const p = await getMyProfile();
            setAvatarUrl(p.avatar_url ?? "");
          } catch {
            // ignore
          }
        }}
        onSignedOut={() => {
          // App.tsx will switch to AuthPage automatically
        }}
      />

      {/* Coming Soon Popup */}
      {showComingSoon && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "20px",
            boxSizing: "border-box",
          }}
          onClick={() => setShowComingSoon(false)}
        >
          <div
            style={{
              background: "white",
              borderRadius: "20px",
              padding: "32px 24px",
              maxWidth: "320px",
              textAlign: "center",
              boxShadow: "0 12px 40px rgba(0, 0, 0, 0.3)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                fontSize: "48px",
                marginBottom: "16px",
              }}
            >
              😉
            </div>
            <h2
              style={{
                fontSize: "24px",
                fontWeight: "bold",
                margin: "0 0 12px 0",
                color: "#333",
              }}
            >
              Coming Soon!
            </h2>
            <p
              style={{
                fontSize: "16px",
                color: "#666",
                margin: "0 0 24px 0",
                lineHeight: "1.5",
              }}
            >
              Be patient! This feature is coming soon...
            </p>
            <button
              onClick={() => setShowComingSoon(false)}
              style={{
                width: "100%",
                padding: "12px 20px",
                fontSize: "16px",
                fontWeight: "600",
                border: "none",
                borderRadius: "12px",
                background: "#ff8c00",
                color: "white",
                cursor: "pointer",
                transition: "background 0.2s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "#ff7700";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "#ff8c00";
              }}
            >
              Got it! 🚀
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
