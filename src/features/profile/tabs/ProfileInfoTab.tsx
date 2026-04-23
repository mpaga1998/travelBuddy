import { useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { COUNTRIES } from '../countries';
import {
  sendPasswordReset,
  updateMyProfile,
  uploadMyAvatar,
  type Profile,
  calculateAge,
} from '../profileApi';
import { Field } from './Field';
import { inputStyle, smallBtn, primaryBtn, dangerBtn } from './profileStyles';

export interface ProfileInfoTabProps {
  isMobile: boolean;
  profile: Profile;
  email: string;
  initialFirstName: string;
  initialLastName: string;
  initialUsername: string;
  initialCountryCode: string;
  initialDob: string;
  /** Called when the avatar changes so the parent can reflect it in its cached copy. */
  onAvatarChange: (url: string) => void;
  /** Called on "Sign out" confirmed. */
  onSignOut: () => Promise<void> | void;
}

/**
 * Profile info tab — avatar upload, basic fields, save, password reset, sign out.
 * Owns its own form state; parent passes initial values only.
 */
export function ProfileInfoTab({
  isMobile,
  profile,
  email,
  initialFirstName,
  initialLastName,
  initialUsername,
  initialCountryCode,
  initialDob,
  onAvatarChange,
  onSignOut,
}: ProfileInfoTabProps) {
  const [firstName, setFirstName] = useState(initialFirstName);
  const [lastName, setLastName] = useState(initialLastName);
  const [username, setUsername] = useState(initialUsername);
  const [countryCode, setCountryCode] = useState(initialCountryCode);
  const [dob, setDob] = useState(initialDob);
  const [avatar, setAvatar] = useState(profile.avatar_url ?? '');

  const [saving, setSaving] = useState(false);
  const [busyAvatar, setBusyAvatar] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);

  const initials =
    `${(firstName?.[0] ?? '').toUpperCase()}${(lastName?.[0] ?? '').toUpperCase()}` || '🙂';

  async function onSave() {
    setErr(null);
    setMsg(null);

    const u = username.trim();
    if (!u) {
      setErr('Username is required.');
      return;
    }

    if (dob) {
      const age = calculateAge(dob);
      if (age === null) {
        setErr('Invalid date of birth.');
        return;
      }
      if (age < 18) {
        setErr('You must be at least 18 years old.');
        return;
      }
      if (age > 100) {
        const confirmed = window.confirm(
          `Wow, ${age} years old? You're basically a legend! 🎉 Continue anyway?`,
        );
        if (!confirmed) return;
      }
    }

    setSaving(true);
    try {
      await updateMyProfile({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        username: u,
        country_code: countryCode || null,
        dob: dob || null,
      });

      setMsg('Profile saved.');
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  }

  async function onPickAvatar(file: File | null) {
    if (!file) return;
    setErr(null);
    setMsg(null);

    if (!file.type.startsWith('image/')) {
      setErr('Please select an image file.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErr('Image too large (max 5MB).');
      return;
    }

    setBusyAvatar(true);
    try {
      const url = await uploadMyAvatar(file);
      setAvatar(url);
      onAvatarChange(url);
      setMsg('Avatar updated.');
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to upload avatar');
    } finally {
      setBusyAvatar(false);
    }
  }

  async function onResetPassword() {
    setErr(null);
    setMsg(null);
    try {
      if (!email) {
        setErr('No email found for this user.');
        return;
      }
      await sendPasswordReset(email);
      setMsg('Password reset email sent. Check your inbox/spam.');
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to send reset email');
    }
  }

  async function handleConfirmSignOut() {
    setShowSignOutConfirm(false);
    await supabase.auth.signOut();
    await onSignOut();
  }

  return (
    <>
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Avatar */}
        <div style={{ display: 'grid', justifyItems: 'center', gap: 10, marginBottom: 16 }}>
          <div
            style={{
              width: isMobile ? 90 : 110,
              height: isMobile ? 90 : 110,
              borderRadius: '999px',
              overflow: 'hidden',
              background: 'rgba(0,0,0,0.06)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: isMobile ? 28 : 34,
              fontWeight: 900,
              border: '1px solid rgba(0,0,0,0.10)',
            }}
          >
            {avatar ? (
              <img
                src={avatar}
                alt="Avatar"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              initials
            )}
          </div>

          <label
            style={{
              padding: isMobile ? '12px 16px' : '8px 12px',
              borderRadius: 10,
              border: '1px solid rgba(0,0,0,0.18)',
              background: 'white',
              cursor: busyAvatar ? 'not-allowed' : 'pointer',
              fontWeight: 700,
              opacity: busyAvatar ? 0.6 : 1,
              fontSize: 14,
              minHeight: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {busyAvatar ? 'Uploading…' : 'Add photo'}
            <input
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              disabled={busyAvatar}
              onChange={(e) => onPickAvatar(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>

        {/* Fields */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
          <Field label="Name">
            <input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              style={inputStyle}
            />
          </Field>

          <Field label="Surname">
            <input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              style={inputStyle}
            />
          </Field>

          <Field label="Date of birth">
            <input
              type="date"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              style={inputStyle}
              max={new Date().toISOString().split('T')[0]}
            />
            {dob && (
              <div style={{ marginTop: 6, fontSize: 12, opacity: 0.85, color: '#111' }}>
                Age: {calculateAge(dob)} years old
              </div>
            )}
          </Field>

          <Field label="Nationality">
            <select
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value)}
              style={inputStyle}
            >
              <option value="">Select country…</option>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.flag} {c.name}
                </option>
              ))}
            </select>
            {countryCode && (
              <div style={{ marginTop: 6, fontSize: 12, opacity: 0.85, color: '#111' }}>
                Selected: {COUNTRIES.find((x) => x.code === countryCode)?.flag}{' '}
                {COUNTRIES.find((x) => x.code === countryCode)?.name}
              </div>
            )}
          </Field>

          <Field label="Username">
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={inputStyle}
            />
          </Field>

          <Field label="Email">
            <input
              value={email}
              readOnly
              style={{ ...inputStyle, background: 'rgba(0,0,0,0.04)' }}
            />
          </Field>

          <Field label="Password">
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <input
                value={'••••••••'}
                readOnly
                style={{ ...inputStyle, flex: 1, background: 'rgba(0,0,0,0.04)' }}
              />
              <button onClick={onResetPassword} style={smallBtn}>
                Reset
              </button>
            </div>
          </Field>
        </div>

        {err && <div style={{ marginTop: 12, color: 'crimson', fontSize: 13 }}>{err}</div>}
        {msg && <div style={{ marginTop: 12, color: 'green', fontSize: 13 }}>{msg}</div>}
      </div>

      {/* Actions */}
      <div
        style={{
          padding: 16,
          borderTop: '1px solid rgba(0,0,0,0.08)',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          flexShrink: 0,
        }}
      >
        <button onClick={onSave} disabled={saving} style={primaryBtn(saving)}>
          {saving ? 'Saving…' : 'Save'}
        </button>

        <button onClick={() => setShowSignOutConfirm(true)} style={dangerBtn}>
          Sign out
        </button>
      </div>

      {showSignOutConfirm && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
          }}
          onClick={() => setShowSignOutConfirm(false)}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '20px',
              padding: '24px',
              maxWidth: '300px',
              boxShadow: '0 12px 48px rgba(0, 0, 0, 0.3)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 12px 0', fontSize: '18px', color: '#111' }}>Sign out?</h3>
            <p
              style={{
                margin: '0 0 24px 0',
                fontSize: '14px',
                color: '#666',
                lineHeight: '1.5',
              }}
            >
              Are you sure you want to sign out? You'll need to sign in again to access your
              profile.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowSignOutConfirm(false)}
                style={{
                  padding: '10px 20px',
                  borderRadius: '10px',
                  border: '1px solid rgba(0, 0, 0, 0.18)',
                  background: 'white',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: '#111',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSignOut}
                style={{
                  padding: '10px 20px',
                  borderRadius: '10px',
                  border: 'none',
                  background: '#ff4444',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: 'white',
                }}
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
