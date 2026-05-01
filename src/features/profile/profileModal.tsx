import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Skeleton } from '../../components/Skeleton';
import { getMyProfile, type Profile } from './profileApi';
import { ProfileInfoTab } from './tabs/ProfileInfoTab';
import { BookmarkedPinsTab } from './tabs/BookmarkedPinsTab';
import { SavedItinerariesTab } from './tabs/SavedItinerariesTab';

type Props = {
  open: boolean;
  onClose: () => void;
  onSignedOut: () => void;
};

type Section = 'menu' | 'profile' | 'saved' | 'itineraries';

/**
 * Supabase can return `dob` as `'YYYY-MM-DD'` (DATE column) or as a full ISO
 * timestamp if the column was accidentally created as timestamptz. HTML
 * `<input type="date">` silently rejects any value that is not strictly
 * `YYYY-MM-DD`, which manifests as the DOB field being blank on reopen even
 * though the save succeeded. Slice defensively so both column types display.
 */
function normalizeDobForDateInput(raw: string | null | undefined): string {
  if (!raw) return '';
  // Both 'YYYY-MM-DD' and 'YYYY-MM-DDTHH:mm:ss±HH:mm' have the date in [0, 10).
  return raw.slice(0, 10);
}

/**
 * Profile modal shell.
 *
 * This component used to be ~1,400 lines. In Phase 2.4 it was split into three
 * tab subcomponents plus shared style helpers. This shell is now responsible
 * for:
 *   - Opening / closing the modal
 *   - Loading the user's base profile (name / email / country / dob) once
 *   - Routing between the three tabs (profile info, saved pins, itineraries)
 *
 * Each tab owns its own data-loading, error state, and detail-view state.
 */
export function ProfileModal({ open, onClose, onSignedOut }: Props) {
  const [loading, setLoading] = useState(true);
  const [selectedSection, setSelectedSection] = useState<Section>('menu');

  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState<string>('');
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      // Reset all shell state on close so re-opening lands on the menu.
      setLoading(true);
      setSelectedSection('menu');
      setProfile(null);
      setEmail('');
      setErr(null);
      return;
    }

    setLoading(true);
    setErr(null);

    (async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        setEmail(userData.user?.email ?? '');

        const p = await getMyProfile();
        setProfile(p);
      } catch (e: any) {
        setErr(e?.message ?? 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    })();
  }, [open]);

  if (!open) return null;

  async function onSignOut() {
    onClose();
    onSignedOut();
  }

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  return (
    <div
      onClick={onClose}
      className={`fixed inset-0 bg-black/35 flex justify-center z-50 ${isMobile ? 'items-end p-0' : 'items-center p-4'}`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`bg-white p-0 shadow-[0_18px_48px_rgba(0,0,0,0.22)] text-slate-900 flex flex-col ${isMobile ? 'w-full rounded-t-2xl max-h-[90vh]' : 'w-[min(720px,100%)] rounded-2xl'}`}
      >
        <ModalHeader
          selectedSection={selectedSection}
          onBackToMenu={() => setSelectedSection('menu')}
          onClose={onClose}
        />

        {selectedSection === 'menu' ? (
          <MenuScreen onPick={(s) => setSelectedSection(s)} />
        ) : loading ? (
          <LoadingScreen isMobile={isMobile} />
        ) : err ? (
          <ErrorScreen message={err} />
        ) : selectedSection === 'profile' && profile ? (
          <ProfileInfoTab
            isMobile={isMobile}
            profile={profile}
            email={email}
            initialFirstName={profile.first_name ?? ''}
            initialLastName={profile.last_name ?? ''}
            initialUsername={profile.username ?? ''}
            initialCountryCode={profile.country_code ?? ''}
            initialDob={normalizeDobForDateInput(profile.dob)}
            onAvatarChange={(url) =>
              setProfile((p) => (p ? { ...p, avatar_url: url } : p))
            }
            onSignOut={onSignOut}
          />
        ) : selectedSection === 'saved' ? (
          <BookmarkedPinsTab isMobile={isMobile} />
        ) : selectedSection === 'itineraries' ? (
          <SavedItinerariesTab />
        ) : null}
      </div>
    </div>
  );
}

function ModalHeader({
  selectedSection,
  onBackToMenu,
  onClose,
}: {
  selectedSection: Section;
  onBackToMenu: () => void;
  onClose: () => void;
}) {
  return (
    <div className="p-4 border-b border-black/[0.08] flex justify-between items-center gap-3 flex-shrink-0">
      {selectedSection === 'menu' ? (
        <div className="font-extrabold text-base">Menu</div>
      ) : (
        <button
          onClick={onBackToMenu}
          className="border-none bg-transparent cursor-pointer text-base font-semibold text-blue-600 px-2 py-1 flex items-center gap-1"
        >
          ← Back
        </button>
      )}
      <button
        onClick={onClose}
        className="border-none bg-transparent text-2xl cursor-pointer px-2 py-1 flex items-center justify-center text-slate-900 leading-none"
        aria-label="Close"
      >
        ✕
      </button>
    </div>
  );
}

function MenuScreen({ onPick }: { onPick: (s: Section) => void }) {
  const items: Array<{
    section: Exclude<Section, 'menu'>;
    emoji: string;
    label: string;
    color: string;
    shadow: string;
    hoverBg: string;
  }> = [
    {
      section: 'profile',
      emoji: '👤',
      label: '👤 Profile Info',
      color: '#2563eb',
      shadow: '0 4px 12px rgba(37, 99, 235, 0.12)',
      hoverBg: 'rgba(37, 99, 235, 0.05)',
    },
    {
      section: 'saved',
      emoji: '🔖',
      label: '🔖 Saved',
      color: '#16a34a',
      shadow: '0 4px 12px rgba(22, 163, 74, 0.12)',
      hoverBg: 'rgba(22, 163, 74, 0.05)',
    },
    {
      section: 'itineraries',
      emoji: '🎒',
      label: '🎒 Itineraries',
      color: '#9333ea',
      shadow: '0 4px 12px rgba(147, 51, 234, 0.12)',
      hoverBg: 'rgba(147, 51, 234, 0.05)',
    },
  ];

  return (
    <div className="flex-1 overflow-auto p-8 flex flex-col items-center justify-center gap-5">
      {items.map((item) => (
        <div key={item.section} className="flex flex-col items-center gap-4">
          <div className="text-5xl">{item.emoji}</div>
          <button
            onClick={() => onPick(item.section)}
            onTouchStart={(e) => e.preventDefault()}
            type="button"
            className="w-full max-w-[300px] px-6 py-5 rounded-2xl bg-white cursor-pointer text-base font-bold transition-all"
            style={{
              border: `2px solid ${item.color}`,
              color: item.color,
              boxShadow: item.shadow,
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLElement).style.background = item.hoverBg;
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLElement).style.background = 'white';
            }}
          >
            {item.label}
          </button>
        </div>
      ))}
    </div>
  );
}

function LoadingScreen({ isMobile }: { isMobile: boolean }) {
  // Shape matches ProfileInfoTab: avatar circle + upload button + 6 form fields.
  const fields = Array.from({ length: 6 });
  return (
    <div
      className={`flex-1 overflow-auto p-4 flex flex-col ${isMobile ? 'min-h-[300px]' : 'min-h-[400px]'}`}
    >
      <div className="grid justify-items-center gap-2.5 mb-4">
        <Skeleton
          className={`${isMobile ? 'w-[90px] h-[90px]' : 'w-[110px] h-[110px]'} rounded-full`}
        />
        <Skeleton className="h-10 w-28 rounded-lg" />
      </div>
      <div className="grid grid-cols-1 gap-3">
        {fields.map((_, i) => (
          <div key={i} className="flex flex-col gap-1.5">
            <Skeleton className="h-3 w-20 rounded" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ErrorScreen({ message }: { message: string }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center">
      <div className="text-4xl">⚠️</div>
      <div className="text-sm text-red-900 font-semibold">Couldn't load your profile</div>
      <div className="text-[13px] text-slate-500 max-w-[320px]">{message}</div>
    </div>
  );
}
