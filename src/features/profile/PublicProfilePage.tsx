import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  fetchPublicItinerariesByUserId,
  fetchPublicPinsByUserId,
  fetchPublicProfileByHandle,
  type PublicItinerary,
  type PublicPin,
  type PublicProfile,
} from './publicProfileApi';
import { followUser, isFollowing, unfollowUser } from './followApi';
import { supabase } from '../../lib/supabaseClient';
import { imgAvatar, imgThumbnail } from '../../lib/imageTransforms';
import { categoryEmoji } from '../map/mapConstants';
import type { PinCategory } from '../pins/pinTypes';

/**
 * 5.1: /u/:handle public profile page.
 *
 * Loads three things in parallel after the handle resolves:
 *   1. the profile (avatar / username / bio / role)
 *   2. their public pins (any pin they've authored that isn't hidden)
 *   3. their PUBLIC itineraries (RLS gates non-owners to is_public = true)
 *
 * Renders a 404 state when the handle doesn't match any profile. The
 * intentional UX choice: pins always show, itineraries only show when the
 * owner has flipped them public — this mirrors how Twitter / Instagram
 * default to public for some content types and private for others.
 */

interface PublicProfilePageProps {
  handle: string;
  onBack: () => void;
}

type ItineraryDetail = PublicItinerary | null;

export function PublicProfilePage({ handle, onBack }: PublicProfilePageProps) {
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [pins, setPins] = useState<PublicPin[]>([]);
  const [itineraries, setItineraries] = useState<PublicItinerary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openItinerary, setOpenItinerary] = useState<ItineraryDetail>(null);

  // 5.2: viewer identity + follow state. Both nullable until the auth
  // round-trip completes — `following` stays null while we don't know yet
  // (button shows a loading state instead of guessing).
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [following, setFollowing] = useState<boolean | null>(null);
  const [followBusy, setFollowBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const profileData = await fetchPublicProfileByHandle(handle);
      if (!profileData) {
        setProfile(null);
        return;
      }
      setProfile(profileData);

      // Pins + itineraries can fetch in parallel — they're both anon reads.
      // The follow check needs the profile id, so it joins this batch too.
      const [pinsData, itinData, viewerData, followingData] = await Promise.all([
        fetchPublicPinsByUserId(profileData.id),
        fetchPublicItinerariesByUserId(profileData.id),
        supabase.auth.getUser(),
        isFollowing(profileData.id),
      ]);
      setPins(pinsData);
      setItineraries(itinData);
      setViewerId(viewerData.data.user?.id ?? null);
      setFollowing(followingData);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load profile';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [handle]);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * Optimistic follow toggle. Flip locally first (state + cached count) so
   * the button + counter feel instantaneous, then call the API and revert
   * on failure. Mirrors the optimism pattern in SavedItinerariesTab's
   * is_public toggle.
   */
  const handleToggleFollow = useCallback(async () => {
    if (!profile || followBusy) return;
    if (!viewerId) {
      toast.error('Sign in to follow travelers.');
      return;
    }
    if (viewerId === profile.id) return; // can't follow yourself

    const next = !following;
    setFollowBusy(true);
    setFollowing(next);
    setProfile((p) =>
      p ? { ...p, followersCount: Math.max(0, p.followersCount + (next ? 1 : -1)) } : p
    );

    try {
      if (next) {
        await followUser(profile.id);
      } else {
        await unfollowUser(profile.id);
      }
    } catch (e) {
      // Revert.
      setFollowing(!next);
      setProfile((p) =>
        p ? { ...p, followersCount: Math.max(0, p.followersCount - (next ? 1 : -1)) } : p
      );
      const message = e instanceof Error ? e.message : 'Failed to update follow';
      toast.error(message);
    } finally {
      setFollowBusy(false);
    }
  }, [profile, viewerId, following, followBusy]);

  // Profile not-found takes over the whole page so the user lands on a clear
  // message instead of staring at an empty layout.
  if (!loading && !profile && !error) {
    return <NotFound onBack={onBack} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 text-[#111]">
      <Header onBack={onBack} />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        {error && (
          <div className="mb-4 px-3.5 py-3 rounded-[10px] bg-red-100 text-red-900 text-sm border border-red-200">
            ❌ {error}
          </div>
        )}

        {loading && !profile ? (
          <ProfileSkeleton />
        ) : profile ? (
          <>
            <ProfileHeader
              profile={profile}
              pinCount={pins.length}
              itineraryCount={itineraries.length}
              viewerId={viewerId}
              following={following}
              followBusy={followBusy}
              onToggleFollow={handleToggleFollow}
            />

            <Section title="Pins" count={pins.length} empty="No pins yet.">
              {pins.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {pins.map((pin) => (
                    <PinCard key={pin.id} pin={pin} />
                  ))}
                </div>
              )}
            </Section>

            <Section title="Public itineraries" count={itineraries.length} empty="No public itineraries.">
              {itineraries.length > 0 && (
                <div className="flex flex-col gap-3">
                  {itineraries.map((it) => (
                    <ItineraryCard key={it.id} itinerary={it} onOpen={setOpenItinerary} />
                  ))}
                </div>
              )}
            </Section>
          </>
        ) : null}
      </main>

      {openItinerary && (
        <ItineraryDetailModal itinerary={openItinerary} onClose={() => setOpenItinerary(null)} />
      )}
    </div>
  );
}

// ───────────────────────────── Sub-components ─────────────────────────────

function Header({ onBack }: { onBack: () => void }) {
  return (
    <header className="sticky top-0 z-10 flex items-center gap-3 px-4 sm:px-6 py-3 bg-white border-b border-black/[0.08]">
      <button
        type="button"
        onClick={onBack}
        className="px-3 py-1.5 rounded-md border border-black/15 bg-white text-sm font-medium hover:bg-gray-50"
      >
        ← Back
      </button>
      <h1 className="text-base font-semibold text-gray-700">Profile</h1>
    </header>
  );
}

function ProfileHeader({
  profile,
  pinCount,
  itineraryCount,
  viewerId,
  following,
  followBusy,
  onToggleFollow,
}: {
  profile: PublicProfile;
  pinCount: number;
  itineraryCount: number;
  viewerId: string | null;
  following: boolean | null;
  followBusy: boolean;
  onToggleFollow: () => void;
}) {
  const initials = useMemo(() => {
    return (
      profile.username
        ?.split(/\s+/)
        .map((s) => s[0])
        .filter(Boolean)
        .slice(0, 2)
        .join('')
        .toUpperCase() || '🙂'
    );
  }, [profile.username]);

  const displayName =
    profile.role === 'hostel'
      ? profile.hostelName ?? profile.username
      : profile.username;

  // Hide the follow button on:
  //   - your own profile (can't follow yourself; CHECK constraint enforces it)
  //   - signed-out visitors (viewerId === null)
  //
  // Anonymous visitors still see the counts — they're public — they just
  // don't get an action surface.
  const showFollowButton = viewerId !== null && viewerId !== profile.id;

  return (
    <section className="bg-white rounded-2xl border border-black/[0.08] p-5 mb-6 shadow-sm">
      <div className="flex flex-col sm:flex-row gap-5">
        <div className="flex-shrink-0">
          {profile.avatarUrl ? (
            <img
              src={imgAvatar(profile.avatarUrl) ?? undefined}
              alt={`${displayName} avatar`}
              loading="lazy"
              decoding="async"
              className="w-24 h-24 rounded-full object-cover bg-gray-100 border border-black/[0.08]"
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-gray-100 flex items-center justify-center text-2xl font-bold text-gray-500 border border-black/[0.08]">
              {initials}
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold truncate">{displayName}</h2>
                {profile.role === 'hostel' && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-xs font-semibold">
                    Hostel
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500 mt-0.5">@{profile.handle}</p>
            </div>

            {showFollowButton && (
              <FollowButton
                following={following}
                busy={followBusy}
                onClick={onToggleFollow}
              />
            )}
          </div>

          {profile.bio && (
            <p className="text-sm text-gray-700 mt-3 whitespace-pre-wrap">{profile.bio}</p>
          )}

          <div className="flex gap-4 mt-4 text-xs text-gray-500 flex-wrap">
            <span>
              <strong className="text-gray-900">{profile.followersCount}</strong>{' '}
              {profile.followersCount === 1 ? 'follower' : 'followers'}
            </span>
            <span>
              <strong className="text-gray-900">{profile.followingCount}</strong> following
            </span>
            <span>
              <strong className="text-gray-900">{pinCount}</strong> pins
            </span>
            <span>
              <strong className="text-gray-900">{itineraryCount}</strong> public itineraries
            </span>
            {profile.age != null && profile.role !== 'hostel' && (
              <span>
                <strong className="text-gray-900">{profile.age}</strong> y/o
              </span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function FollowButton({
  following,
  busy,
  onClick,
}: {
  following: boolean | null;
  busy: boolean;
  onClick: () => void;
}) {
  // While the initial isFollowing check is in flight, show a neutral
  // "Loading…" state instead of guessing — guessing wrong would briefly
  // flash the wrong label.
  if (following === null) {
    return (
      <button
        type="button"
        disabled
        className="px-4 py-1.5 rounded-full border border-black/15 bg-white text-sm font-semibold text-gray-400 cursor-not-allowed"
        aria-label="Checking follow status"
      >
        Loading…
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-pressed={following}
      className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
        following
          ? 'border border-black/15 bg-white text-gray-700 hover:bg-red-50 hover:text-red-700 hover:border-red-200'
          : 'border-none bg-blue-600 text-white hover:bg-blue-700'
      } ${busy ? 'opacity-60 cursor-wait' : 'cursor-pointer'}`}
    >
      {following ? '✓ Following' : '+ Follow'}
    </button>
  );
}

function Section({
  title,
  count,
  empty,
  children,
}: {
  title: string;
  count: number;
  empty: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-8">
      <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500 mb-3">
        {title} {count > 0 && <span className="text-gray-400">({count})</span>}
      </h2>
      {count === 0 ? (
        <p className="text-sm text-gray-500 italic">{empty}</p>
      ) : (
        children
      )}
    </section>
  );
}

function PinCard({ pin }: { pin: PublicPin }) {
  const thumb = pin.imageUrls[0] ? imgThumbnail(pin.imageUrls[0]) : null;
  const emoji = categoryEmoji(pin.category as PinCategory);
  return (
    <article className="bg-white rounded-xl border border-black/[0.08] overflow-hidden shadow-sm">
      {thumb ? (
        <img
          src={thumb}
          alt=""
          loading="lazy"
          decoding="async"
          className="w-full aspect-[4/3] object-cover bg-gray-100"
        />
      ) : (
        <div className="w-full aspect-[4/3] bg-gray-100 flex items-center justify-center text-3xl">
          📍
        </div>
      )}
      <div className="p-2.5">
        <h3 className="text-sm font-semibold truncate">
          <span className="mr-1">{emoji}</span>
          {pin.title}
        </h3>
        {pin.bookmarkCount > 0 && (
          <p className="text-xs text-gray-500 mt-0.5">🔖 {pin.bookmarkCount}</p>
        )}
      </div>
    </article>
  );
}

function ItineraryCard({
  itinerary,
  onOpen,
}: {
  itinerary: PublicItinerary;
  onOpen: (it: PublicItinerary) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(itinerary)}
      className="bg-white rounded-xl border border-black/[0.08] hover:border-purple-600 hover:bg-purple-600/[0.02] p-4 text-left flex flex-col gap-1.5 transition-colors shadow-sm"
    >
      <div className="text-base font-bold text-[#111]">{itinerary.title}</div>
      <div className="text-[13px] text-[#666] flex flex-col gap-1">
        {(itinerary.arrivalLocation || itinerary.departureLocation) && (
          <div>
            📍 {itinerary.arrivalLocation ?? '?'} → {itinerary.departureLocation ?? '?'}
          </div>
        )}
        {itinerary.startDate && itinerary.endDate && (
          <div>
            📅 {new Date(itinerary.startDate).toLocaleDateString()} to{' '}
            {new Date(itinerary.endDate).toLocaleDateString()}
          </div>
        )}
        {itinerary.travelPace && (
          <div>
            ⚡ {itinerary.travelPace.charAt(0).toUpperCase() + itinerary.travelPace.slice(1)} pace
          </div>
        )}
        {itinerary.budget && <div>💰 {itinerary.budget.replace(/-/g, ' ').toUpperCase()}</div>}
      </div>
    </button>
  );
}

function ItineraryDetailModal({
  itinerary,
  onClose,
}: {
  itinerary: PublicItinerary;
  onClose: () => void;
}) {
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-[1001] p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-[0_18px_48px_rgba(0,0,0,0.22)] w-[min(720px,100%)] max-h-[90vh] overflow-auto"
      >
        <div className="flex justify-between items-start p-5 border-b border-black/[0.08] sticky top-0 bg-white">
          <h3 className="text-lg font-bold text-[#111] m-0">{itinerary.title}</h3>
          <button
            onClick={onClose}
            className="border-none bg-transparent text-2xl cursor-pointer px-2 py-1 text-gray-400"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="p-5">
          {itinerary.markdownContent ? (
            <pre className="whitespace-pre-wrap text-sm leading-relaxed text-[#333] font-sans">
              {itinerary.markdownContent}
            </pre>
          ) : (
            <p className="text-sm text-gray-500 italic">No content.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <>
      <div className="bg-white rounded-2xl border border-black/[0.08] p-5 mb-6 flex gap-5">
        <div className="w-24 h-24 rounded-full bg-gray-200 animate-pulse flex-shrink-0" />
        <div className="flex-1 flex flex-col gap-2">
          <div className="h-5 w-1/3 bg-gray-200 rounded animate-pulse" />
          <div className="h-3 w-1/4 bg-gray-200 rounded animate-pulse" />
          <div className="h-3 w-3/4 bg-gray-200 rounded animate-pulse mt-2" />
          <div className="h-3 w-1/2 bg-gray-200 rounded animate-pulse" />
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="aspect-[4/3] rounded-xl bg-gray-200 animate-pulse" />
        ))}
      </div>
    </>
  );
}

function NotFound({ onBack }: { onBack: () => void }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-gray-700 p-6 text-center">
      <div className="text-5xl mb-4">🧭</div>
      <h1 className="text-2xl font-bold mb-2">Profile not found</h1>
      <p className="text-sm text-gray-500 mb-6 max-w-md">
        We couldn't find a Backpack Map profile with that handle. The user may have changed
        their handle, or the link might be a typo.
      </p>
      <button
        type="button"
        onClick={onBack}
        className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-semibold"
      >
        Go home
      </button>
    </div>
  );
}
