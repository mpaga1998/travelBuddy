import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
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
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.35)',
        display: 'flex',
        alignItems: isMobile ? 'flex-end' : 'center',
        justifyContent: 'center',
        padding: isMobile ? 0 : 16,
        zIndex: 50,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: isMobile ? '100%' : 'min(720px, 100%)',
          background: 'white',
          borderRadius: isMobile ? '16px 16px 0 0' : 16,
          padding: 0,
          boxShadow: '0 18px 48px rgba(0,0,0,0.22)',
          color: '#111',
          maxHeight: isMobile ? '90vh' : 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}
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
            initialDob={profile.dob ?? ''}
            onAvatarChange={(url) =>
              setProfile((p) => (p ? { ...p, avatar_url: url } : p))
            }
            onSignOut={onSignOut}
          />
        ) : selectedSection === 'saved' ? (
          <BookmarkedPinsTab isMobile={isMobile} />
        ) : selectedSection === 'itineraries' ? (
          <SavedItinerariesTab onBackToMenu={() => setSelectedSection('menu')} />
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
    <div
      style={{
        padding: 16,
        borderBottom: '1px solid rgba(0,0,0,0.08)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
        flexShrink: 0,
      }}
    >
      {selectedSection === 'menu' ? (
        <div style={{ fontWeight: 800, fontSize: 16 }}>Menu</div>
      ) : (
        <button
          onClick={onBackToMenu}
          style={{
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            fontSize: 16,
            fontWeight: 600,
            color: '#2563eb',
            padding: '4px 8px',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          ← Back
        </button>
      )}
      <button
        onClick={onClose}
        style={{
          border: 'none',
          background: 'transparent',
          fontSize: 24,
          cursor: 'pointer',
          padding: '4px 8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#111',
          lineHeight: '1',
        }}
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
    <div
      style={{
        flex: 1,
        overflow: 'auto',
        padding: 32,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 20,
      }}
    >
      {items.map((item) => (
        <div
          key={item.section}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}
        >
          <div style={{ fontSize: 48, marginBottom: 0 }}>{item.emoji}</div>
          <button
            onClick={() => onPick(item.section)}
            onTouchStart={(e) => e.preventDefault()}
            type="button"
            style={{
              width: '100%',
              maxWidth: 300,
              padding: '20px 24px',
              borderRadius: 16,
              border: `2px solid ${item.color}`,
              background: 'white',
              cursor: 'pointer',
              fontSize: 16,
              fontWeight: 700,
              color: item.color,
              transition: 'all 0.2s',
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
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        padding: 32,
        minHeight: isMobile ? 300 : 400,
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          border: '4px solid #e5e7eb',
          borderTop: '4px solid #2563eb',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }}
      />
      <div style={{ fontSize: 14, color: '#666', fontWeight: 500 }}>Loading profile…</div>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

function ErrorScreen({ message }: { message: string }) {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: 32,
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 36 }}>⚠️</div>
      <div style={{ fontSize: 14, color: '#991b1b', fontWeight: 600 }}>
        Couldn't load your profile
      </div>
      <div style={{ fontSize: 13, color: '#666', maxWidth: 320 }}>{message}</div>
    </div>
  );
}
