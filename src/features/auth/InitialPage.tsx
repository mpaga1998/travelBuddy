import { useState, useEffect, useRef } from "react";
import { supabase } from "../../lib/supabaseClient";
import { ItineraryModal } from "../itinerary/ItineraryModal";
import { ProfileModal } from "../profile/profileModal";
import { getMyProfile } from "../profile/profileApi";
import { FeatureErrorBoundary } from "../../components/FeatureErrorBoundary";

interface InitialPageProps {
  onGoToMap: (location: { lng: number; lat: number } | null) => void;
}

interface Suggestion {
  id: string;
  place_name: string;
  center: [number, number];
}

// Shared class for the top-left avatar / top-right sign-out round buttons.
// Hover/touch brightness swap is handled by Tailwind's hover:/active: variants.
const topRoundBtnClass =
  "absolute top-5 w-11 h-11 rounded-full border-none bg-white/25 hover:bg-white/[0.35] active:bg-white/[0.35] cursor-pointer flex items-center justify-center backdrop-blur-md transition-colors";

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
    <div className="w-screen h-[100dvh] bg-gradient-to-br from-[#ff8c00] to-[#ff6b00] flex flex-col items-center justify-center p-5 box-border text-white font-sans overflow-hidden">
      {/* Logo / Icon */}
      <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center text-[48px] mb-8 shadow-[0_8px_24px_rgba(0,0,0,0.2)]">
        🧭
      </div>

      {/* Title */}
      <h1 className="text-4xl font-bold m-0 mb-3 text-center">
        travelBuddy
      </h1>

      {/* Subtitle */}
      <p className="text-base font-normal m-0 mb-12 text-center opacity-95 max-w-[280px]">
        Discover amazing places and create unforgettable memories
      </p>

      {/* Profile Button (Top Left) */}
      <button
        onClick={() => setProfileOpen(true)}
        className={`${topRoundBtnClass} left-5 p-0 overflow-hidden`}
        aria-label="Open profile"
        title="Profile"
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt="avatar"
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-xl text-white">🙂</span>
        )}
      </button>

      {/* Sign Out Button (Top Right) */}
      <button
        onClick={() => setShowSignOutConfirm(true)}
        className={`${topRoundBtnClass} right-5 text-white text-xl`}
        title="Sign out"
      >
        👋
      </button>

      {/* Buttons Container */}
      <div className="w-full max-w-[380px] flex flex-col gap-3">
        {/* Button 1: Where Next? - Transforms into search bar */}
        {!searchActive ? (
          <button
            onClick={() => setSearchActive(true)}
            className="w-full px-5 py-[18px] text-lg font-semibold border-none rounded-2xl bg-white text-[#ff8c00] cursor-pointer flex items-center justify-center gap-3 transition-transform active:scale-[0.98] shadow-[0_4px_12px_rgba(0,0,0,0.15)]"
          >
            <span>🌍</span>
            <span>Where next?</span>
          </button>
        ) : (
          <div ref={searchContainerRef} className="w-full relative">
            <div className="w-full flex gap-3 items-center justify-between bg-white rounded-2xl px-5 py-[18px] shadow-[0_4px_12px_rgba(0,0,0,0.15)] text-[#111] leading-none min-h-[56px] box-border">
              <span className="text-lg shrink-0 flex items-center">🌍</span>
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
                className="flex-1 border-none text-base outline-none font-[inherit] text-[#111] bg-transparent h-auto m-0 p-0 leading-none appearance-none"
              />
              <button
                onClick={() => {
                  setSearchActive(false);
                  setSearchInput("");
                  setSuggestions([]);
                  setShowSuggestions(false);
                }}
                className="border-none bg-transparent cursor-pointer text-base px-1 flex items-center justify-center text-[#111] shrink-0 h-auto min-w-[24px] leading-none"
                title="Cancel"
              >
                ✕
              </button>
            </div>

            {/* Suggestions Dropdown - Scrollable */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-[calc(100%+8px)] left-0 right-0 bg-white rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.2)] max-h-[220px] overflow-hidden z-[1000]">
                {suggestions.map((suggestion, idx) => (
                  <div
                    key={suggestion.id}
                    onClick={() => handleSearchSubmit(suggestion)}
                    className={`px-4 py-3.5 cursor-pointer transition-colors text-[#111] text-[15px] whitespace-nowrap overflow-hidden text-ellipsis hover:bg-[#ff8c00]/[0.08] ${idx < suggestions.length - 1 ? "border-b border-black/[0.08]" : ""}`}
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
          className="w-full px-5 py-[18px] text-lg font-semibold border-none rounded-2xl bg-gradient-to-br from-[#667eea] to-[#764ba2] text-white cursor-pointer flex items-center justify-center gap-3 transition-transform active:scale-[0.98] shadow-[0_6px_16px_rgba(102,126,234,0.4)]"
        >
          <span>✨</span>
          <span>Create your custom travel itinerary!</span>
        </button>
      </div>

      {/* Sign Out Confirmation Modal */}
      {showSignOutConfirm && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10000]"
          onClick={() => setShowSignOutConfirm(false)}
        >
          <div
            className="bg-white rounded-[20px] p-6 max-w-[300px] shadow-[0_12px_48px_rgba(0,0,0,0.3)]"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="m-0 mb-3 text-lg text-[#111]">Sign out?</h3>
            <p className="m-0 mb-6 text-sm text-[#666] leading-normal">
              Are you sure you want to sign out? You'll need to sign in again to access your profile.
            </p>
            <div className="flex gap-2.5 justify-end">
              <button
                onClick={() => setShowSignOutConfirm(false)}
                className="px-5 py-2.5 rounded-[10px] border border-black/[0.18] bg-white cursor-pointer text-sm font-semibold text-[#111]"
              >
                Cancel
              </button>
              <button
                onClick={handleSignOut}
                className="px-5 py-2.5 rounded-[10px] border-none bg-[#ff4444] cursor-pointer text-sm font-semibold text-white"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Itinerary Modal — isolated behind its own boundary so a crash in
          itinerary generation doesn't take down the home page. */}
      {itineraryModalOpen && (
        <FeatureErrorBoundary featureName="Itinerary">
          <ItineraryModal
            open={itineraryModalOpen}
            onClose={() => setItineraryModalOpen(false)}
          />
        </FeatureErrorBoundary>
      )}

      {/* Profile Modal — same pattern. */}
      {profileOpen && (
        <FeatureErrorBoundary featureName="Profile">
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
        </FeatureErrorBoundary>
      )}

      {/* Coming Soon Popup */}
      {showComingSoon && (
        <div
          className="fixed inset-0 w-full h-full bg-black/50 flex items-center justify-center z-[1000] p-5 box-border"
          onClick={() => setShowComingSoon(false)}
        >
          <div
            className="bg-white rounded-[20px] px-6 py-8 max-w-[320px] text-center shadow-[0_12px_40px_rgba(0,0,0,0.3)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-[48px] mb-4">😉</div>
            <h2 className="text-2xl font-bold m-0 mb-3 text-[#333]">
              Coming Soon!
            </h2>
            <p className="text-base text-[#666] m-0 mb-6 leading-normal">
              Be patient! This feature is coming soon...
            </p>
            <button
              onClick={() => setShowComingSoon(false)}
              className="w-full px-5 py-3 text-base font-semibold border-none rounded-xl bg-[#ff8c00] hover:bg-[#ff7700] text-white cursor-pointer transition-colors"
            >
              Got it! 🚀
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
