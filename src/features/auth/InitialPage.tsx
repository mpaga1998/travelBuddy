import { useState, useEffect, useRef } from "react";
import { supabase } from "../../lib/supabaseClient";
import { ItineraryModal } from "../itinerary/ItineraryModal";
import { ProfileModal } from "../profile/profileModal";
import { getMyProfile } from "../profile/profileApi";
import { countUnread } from "../notifications/notificationsApi";
import { FeatureErrorBoundary } from "../../components/FeatureErrorBoundary";
import {
  UserCircle,
  Bell,
  SignOut,
  GlobeHemisphereWest,
  Sparkle,
  Newspaper,
} from "@phosphor-icons/react";

interface InitialPageProps {
  onGoToMap: (location: { lng: number; lat: number } | null) => void;
}

interface Suggestion {
  id: string;
  place_name: string;
  center: [number, number];
}

const topRoundBtnClass =
  "absolute top-5 w-11 h-11 rounded-full border-none bg-white shadow-[0_2px_8px_rgba(0,0,0,0.10)] hover:bg-gray-50 active:bg-gray-50 cursor-pointer flex items-center justify-center transition-colors";

export function InitialPage({ onGoToMap }: InitialPageProps) {
  const [showComingSoon, setShowComingSoon] = useState(false);
  const [itineraryModalOpen, setItineraryModalOpen] = useState(false);
  const [showWelcome, setShowWelcome] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('nook_welcome_dismissed') !== '1';
  });
  const [searchActive, setSearchActive] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState("");
  // 5.4: unread notification count for the bell badge. Refreshes on mount
  // and whenever the window regains focus — cheap and feels live without
  // pulling in Supabase Realtime. Capped at 99+ in the badge so a viral
  // pin doesn't blow up the layout.
  const [unread, setUnread] = useState(0);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN as string;

  // Refresh the bell badge on mount + focus. Effects fire in declaration
  // order, so this runs alongside the avatar fetch — no ordering hazard.
  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      countUnread().then((n) => {
        if (!cancelled) setUnread(n);
      });
    };
    refresh();
    window.addEventListener('focus', refresh);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', refresh);
    };
  }, []);

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

  function dismissWelcome() {
    setShowWelcome(false);
    try {
      localStorage.setItem('nook_welcome_dismissed', '1');
    } catch {
      /* private mode — no harm */
    }
  }

  async function handleSignOut() {
    setShowSignOutConfirm(false);
    await supabase.auth.signOut();
  }

  return (
    <div className="relative w-screen h-[100dvh] bg-[#F5F1E3] flex flex-col overflow-hidden font-sans">

      {/* ── Top bar buttons (absolute so they don't affect layout flow) ── */}
      <button
        onClick={() => setProfileOpen(true)}
        className={`${topRoundBtnClass} left-5 p-0 overflow-hidden`}
        aria-label="Open profile"
        title="Profile"
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover rounded-full" />
        ) : (
          <UserCircle size={22} weight="light" color="#304D6D" />
        )}
      </button>

      <button
        onClick={() => {
          window.history.pushState({}, '', '/notifications');
          window.dispatchEvent(new PopStateEvent('popstate'));
        }}
        className={`${topRoundBtnClass} right-[68px]`}
        title="Notifications"
        aria-label={unread > 0 ? `Notifications (${unread} unread)` : 'Notifications'}
      >
        <Bell size={22} weight="light" color="#304D6D" />
        {unread > 0 && (
          <span
            className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center border-2 border-[#F5F1E3]"
            aria-hidden="true"
          >
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      <button
        onClick={() => setShowSignOutConfirm(true)}
        className={`${topRoundBtnClass} right-5`}
        title="Sign out"
      >
        <SignOut size={22} weight="light" color="#304D6D" />
      </button>

      {/* ── Upper area: Logo + Tagline (expands to fill available space, centered) ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-5 pt-16">

        {/* Compass icon — scales with viewport: 60px on small phones, 72px at 375px, 90px max */}
        <svg
          viewBox="0 0 400 500"
          style={{ width: 'clamp(60px, 19.2vw, 90px)', height: 'clamp(75px, 24vw, 112px)' }}
          aria-hidden="true"
        >
          <path fill="#45B4B9" d="M199.85374,18.44993c-70.54955,0-130.90053,45.58634-153.14949,108.75948l150.35546,59.97013c23.43068-8.13731,46.86151-16.27463,70.29219-24.41178,20.44568-9.60174,40.39949-.2709,43.88289,10.97053,3.14734,10.15551-5.70655,26.52126-23.88896,32.91252-72.86679,23.89503-145.73374,47.7899-218.60053,71.68492,47.15138,94.80723,131.10844,203.21433,131.10844,203.21433,7.56488-9.0164,162.61081-211.47605,162.61081-300.78184S289.45205,20.33983,199.85374,18.44993Z"/>
          <path fill="#45B4B9" d="M39.48382,155.73892c-1.27642,8.16344-1.94837,16.52095-1.94837,25.02931,0,15.72444,4.82824,34.97006,12.81564,56.05271,15.95023-5.6882,31.43659-11.3282,43.99828-16.07262l-54.86555-65.0094Z"/>
        </svg>

        {/* Wordmark — scales with viewport, overlap tracks icon height proportionally */}
        <svg
          viewBox="0 0 595.276 400"
          style={{
            width: 'clamp(180px, 58.7vw, 250px)',
            marginTop: 'clamp(-55px, -12vw, -36px)',
          }}
          aria-label="nook"
        >
          <path fill="#45B4B9" d="M73.58626,184.44603c-9.06548,0-16.61238,2.25487-22.6407,6.78761s-10.53805,10.37699-13.57521,17.53273c-2.99115,7.15575-4.50973,15.07079-4.50973,23.74512v67.00174H4.88187v-69.83182c0-13.57521,2.62301-25.7699,7.91504-36.60706,5.26902-10.83716,12.99999-19.46548,23.1699-25.88494,10.19292-6.39646,22.70972-9.59469,37.61945-9.59469,15.25486,0,28.02476,3.19823,38.28671,9.59469,10.28495,6.41947,18.10796,15.04778,23.46901,25.88494,5.38407,10.83716,8.05309,22.93981,8.05309,36.33095v70.10793h-27.97875v-66.72563c0-8.65132-1.5646-16.63539-4.64779-23.88317-3.1292-7.24778-7.73097-13.13805-13.87433-17.67079-6.12035-4.53274-13.89734-6.78761-23.30795-6.78761Z"/>
          <path fill="#45B4B9" d="M226.24775,302.91853c-13.94336,0-26.48317-3.31327-37.59644-9.8938-11.13628-6.60354-19.97167-15.41592-26.59822-26.43715-6.58053-11.04424-9.8938-23.23893-9.8938-36.63007,0-13.36813,3.31327-25.53981,9.8938-36.46901,6.62655-10.9292,15.46194-19.64955,26.59822-26.13804,11.11327-6.5115,23.65309-9.75575,37.59644-9.75575s26.48317,3.24425,37.59644,9.75575c11.13628,6.48849,19.87964,15.25486,26.2991,26.27609,6.41947,11.04424,9.61769,23.14689,9.61769,36.33095,0,13.39114-3.19823,25.58583-9.61769,36.63007-6.41947,11.02123-15.20884,19.83362-26.43715,26.43715-11.22831,6.58053-23.6991,9.8938-37.45839,9.8938ZM226.24775,276.34332c8.65132,0,16.42831-2.0708,23.33096-6.2354,6.85663-4.14159,12.28672-9.75575,16.24424-16.81946,3.95752-7.06371,5.93628-14.74867,5.93628-23.03185,0-8.49026-1.97876-16.22123-5.93628-23.19291-3.95752-6.97168-9.38761-12.58583-16.24424-16.81946-6.90265-4.23363-14.67964-6.37345-23.33096-6.37345-8.67433,0-16.45132,2.13982-23.33096,6.37345-6.87964,4.23363-12.37875,9.84778-16.52035,16.81946-4.1646,6.97168-6.2354,14.70265-6.2354,23.19291,0,8.28318,2.0708,15.96813,6.2354,23.03185,4.14159,7.06371,9.6407,12.67787,16.52035,16.81946,6.87964,4.1646,14.65663,6.2354,23.33096,6.2354Z"/>
          <path fill="#45B4B9" d="M378.06551,302.91853c-13.96636,0-26.48317-3.31327-37.61945-9.8938-11.11327-6.60354-19.97167-15.41592-26.5522-26.43715-6.60354-11.04424-9.8938-23.23893-9.8938-36.63007,0-13.36813,3.29026-25.53981,9.8938-36.46901,6.58053-10.9292,15.43893-19.64955,26.5522-26.13804,11.13628-6.5115,23.65309-9.75575,37.61945-9.75575,13.94336,0,26.48317,3.24425,37.61945,9.75575,11.09026,6.48849,19.87964,15.25486,26.27609,26.27609,6.39646,11.04424,9.61769,23.14689,9.61769,36.33095,0,13.39114-3.22124,25.58583-9.61769,36.63007-6.39646,11.02123-15.23185,19.83362-26.43715,26.43715-11.2053,6.58053-23.6991,9.8938-37.45839,9.8938ZM378.06551,276.34332c8.67433,0,16.45132-2.0708,23.30795-6.2354,6.90265-4.14159,12.33274-9.75575,16.29026-16.81946,3.95752-7.06371,5.93628-14.74867,5.93628-23.03185,0-8.49026-1.97876-16.22123-5.93628-23.19291-3.95752-6.97168-9.38761-12.58583-16.29026-16.81946-6.85663-4.23363-14.63362-6.37345-23.30795-6.37345s-16.45132,2.13982-23.33096,6.37345c-6.87964,4.23363-12.40176,9.84778-16.54335,16.81946-4.14159,6.97168-6.21239,14.70265-6.21239,23.19291,0,8.28318,2.0708,15.96813,6.21239,23.03185,4.14159,7.06371,9.66371,12.67787,16.54335,16.81946,6.87964,4.1646,14.65663,6.2354,23.33096,6.2354Z"/>
          <path fill="#45B4B9" d="M488.32692,299.51322h-28.00176V97.08147h28.00176v202.43176ZM483.51807,240.70263v-22.04247h31.08494v22.04247h-31.08494ZM590.11802,299.51322h-34.51326l-44.08493-48.34157c-5.66017-6.39646-8.51327-13.48318-8.51327-21.21415,0-7.33982,2.94513-14.21946,8.78938-20.63893l44.38405-48.34157h34.21414l-59.66192,65.02298c-.75929.57522-1.35752,1.19646-1.84071,1.84071-.48319.66726-.71327,1.38053-.71327,2.11681,0,.57522.23009,1.19646.71327,1.84071.48319.66726,1.08142,1.38053,1.84071,2.11681l59.38581,65.5982Z"/>
        </svg>

        {/* Tagline — Lora 600 normal, solid Dusk Blue, per Figma CSS */}
        <p
          style={{ fontFamily: "'Lora', Georgia, serif", fontWeight: 600, fontStyle: "normal" }}
          className="text-[clamp(14px,4.2vw,16px)] text-[#304D6D] text-center mt-4 mb-0 max-w-[280px] leading-[1.5]"
        >
          Hidden corners, shared by travelers who actually went.
        </p>
      </div>

      {/* ── Lower area: Welcome banner + Buttons (always anchored toward bottom) ── */}
      <div className="flex flex-col items-center w-full px-5 pb-6 gap-3">

      {/* Welcome banner — first-time users only */}
      {showWelcome && (
        <div className="w-full max-w-[380px] bg-white/70 border border-[#304D6D]/10 rounded-2xl p-4 mb-4 flex flex-col gap-2">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-[#304D6D] m-0 leading-snug">First time on nook?</p>
            <button
              type="button"
              onClick={dismissWelcome}
              className="shrink-0 bg-transparent border-0 p-0 w-6 h-6 flex items-center justify-center text-[#304D6D]/40 hover:text-[#304D6D] text-base leading-none cursor-pointer"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
          <p className="text-xs text-[#304D6D]/60 m-0 leading-snug">
            The fastest way in: plan a trip. The AI knows the corners.
          </p>
          <button
            type="button"
            onClick={() => { dismissWelcome(); setItineraryModalOpen(true); }}
            className="self-start px-4 py-1.5 rounded-xl bg-[#45B4B9] text-white text-sm font-semibold active:scale-[0.98] transition-transform"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            Find your nook
          </button>
        </div>
      )}

      {/* Action Buttons */}
      <div className="w-full max-w-[375px] flex flex-col gap-3">

        {/* Search */}
        {!searchActive ? (
          <button
            onClick={() => setSearchActive(true)}
            className="w-full px-5 py-[17px] rounded-full bg-white cursor-pointer flex items-center gap-3 transition-transform active:scale-[0.98]"
          >
            <GlobeHemisphereWest size={20} weight="light" color="rgba(69,180,185,0.4)" />
            <span
              style={{ fontFamily: "'DM Sans', sans-serif" }}
              className="text-base font-semibold text-[#304D6D]/40"
            >
              Where next?
            </span>
          </button>
        ) : (
          <div ref={searchContainerRef} className="w-full relative">
            <div className="w-full flex gap-3 items-center bg-white rounded-full px-5 py-[17px] leading-none min-h-[56px] box-border">
              <GlobeHemisphereWest size={20} weight="light" color="rgba(69,180,185,0.4)" className="shrink-0" />
              <input
                autoFocus
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && suggestions.length > 0) handleSearchSubmit(suggestions[0]);
                  if (e.key === "Escape") { setSearchActive(false); setSearchInput(""); setSuggestions([]); setShowSuggestions(false); }
                }}
                placeholder="Search location..."
                className="flex-1 border-none text-base outline-none text-[#304D6D] bg-transparent p-0 leading-none appearance-none"
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              />
              <button
                onClick={() => { setSearchActive(false); setSearchInput(""); setSuggestions([]); setShowSuggestions(false); }}
                className="border-none bg-transparent cursor-pointer flex items-center justify-center text-[#304D6D]/40 shrink-0"
                title="Cancel"
              >
                ✕
              </button>
            </div>
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-[calc(100%+8px)] left-0 right-0 bg-white rounded-2xl shadow-[0_8px_24px_rgba(0,0,0,0.12)] max-h-[220px] overflow-hidden z-[1000]">
                {suggestions.map((suggestion, idx) => (
                  <div
                    key={suggestion.id}
                    onClick={() => handleSearchSubmit(suggestion)}
                    className={`px-4 py-3.5 cursor-pointer text-[#304D6D] text-[15px] whitespace-nowrap overflow-hidden text-ellipsis hover:bg-[#45B4B9]/[0.06] ${idx < suggestions.length - 1 ? "border-b border-[#304D6D]/[0.06]" : ""}`}
                    style={{ fontFamily: "'DM Sans', sans-serif" }}
                  >
                    📍 {suggestion.place_name}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Find your nook — itinerary CTA */}
        <button
          onClick={() => {
            if (searchActive) { setSearchActive(false); setSearchInput(""); setSuggestions([]); setShowSuggestions(false); }
            setItineraryModalOpen(true);
          }}
          className="w-full px-5 py-[17px] rounded-full bg-[#DB7F67] text-white cursor-pointer flex items-center justify-center gap-3 transition-transform active:scale-[0.98]"
        >
          <Sparkle size={20} weight="light" color="white" />
          <span style={{ fontFamily: "'DM Sans', sans-serif" }} className="text-base font-semibold">
            Find your nook
          </span>
        </button>

        {/* Feed */}
        <button
          onClick={() => {
            window.history.pushState({}, '', '/feed');
            window.dispatchEvent(new PopStateEvent('popstate'));
          }}
          className="w-full px-5 py-[17px] rounded-full bg-[#304D6D] cursor-pointer flex items-center justify-center gap-2 opacity-50 transition-opacity hover:opacity-60"
        >
          <Newspaper size={18} weight="light" color="white" />
          <span style={{ fontFamily: "'DM Sans', sans-serif" }} className="text-base font-semibold text-white">
            Feed
          </span>
        </button>
      </div>

      {/* Sign Out Confirmation Modal */}
      {showSignOutConfirm && (
        <div
          className="fixed inset-0 bg-black/30 flex items-center justify-center z-[10000]"
          onClick={() => setShowSignOutConfirm(false)}
        >
          <div
            className="bg-white rounded-2xl p-6 max-w-[300px] shadow-[0_12px_48px_rgba(0,0,0,0.15)]"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="m-0 mb-2 text-base font-semibold text-[#304D6D]" style={{ fontFamily: "'DM Sans', sans-serif" }}>Sign out?</h3>
            <p className="m-0 mb-6 text-sm text-[#304D6D]/60 leading-normal" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              You'll need to sign in again to access your profile.
            </p>
            <div className="flex gap-2.5 justify-end">
              <button
                onClick={() => setShowSignOutConfirm(false)}
                className="px-5 py-2.5 rounded-xl border border-[#304D6D]/15 bg-white cursor-pointer text-sm font-medium text-[#304D6D]"
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                Cancel
              </button>
              <button
                onClick={handleSignOut}
                className="px-5 py-2.5 rounded-xl border-none bg-[#DB7F67] cursor-pointer text-sm font-semibold text-white"
                style={{ fontFamily: "'DM Sans', sans-serif" }}
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

      </div>{/* end lower area */}

      {/* Legal footer — equal thirds so spacing is visually even regardless of text length */}
      <footer className="w-full flex px-5 pb-5 pointer-events-none shrink-0" style={{ fontFamily: "'Inter', sans-serif" }}>
        {[
          { label: 'Terms of Service', path: '/terms' },
          { label: 'Guidelines', path: '/guidelines' },
          { label: 'Privacy', path: '/privacy' },
        ].map(({ label, path }) => (
          <a
            key={path}
            href={path}
            onClick={(e) => {
              e.preventDefault();
              window.history.pushState({}, '', path);
              window.dispatchEvent(new PopStateEvent('popstate'));
            }}
            className="pointer-events-auto flex-1 text-[12px] text-center hover:opacity-80 transition-opacity"
            style={{ color: 'rgba(48,77,109,0.6)', lineHeight: '24px' }}
          >
            {label}
          </a>
        ))}
      </footer>

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
