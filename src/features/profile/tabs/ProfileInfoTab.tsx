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
import { inputClass, smallBtn, primaryBtn, dangerBtn } from './profileStyles';
import { useConfirm } from '../../../components/ConfirmDialog';
import { compressImage, validateImageFile } from '../../../lib/imageCompress';
import { imgAvatar } from '../../../lib/imageTransforms';

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

  const confirm = useConfirm();

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
        const confirmed = await confirm({
          title: `${age} years old? 🎉`,
          message: "That's a remarkable age — double-check your date of birth, or continue if it's correct.",
          confirmLabel: 'Continue',
          cancelLabel: 'Let me fix it',
        });
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

    const validationErr = validateImageFile(file);
    if (validationErr) {
      setErr(validationErr);
      return;
    }

    setBusyAvatar(true);
    try {
      // Downscale + re-encode on the client so we don't ship 5 MB iPhone
      // photos for an image that will render at 110x110. Falls back to the
      // original File if compression fails.
      const compressed = await compressImage(file, { maxDimension: 1024 });
      const url = await uploadMyAvatar(compressed);
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
      <div className="flex-1 overflow-auto p-4 flex flex-col">
        {/* Avatar */}
        <div className="grid justify-items-center gap-2.5 mb-4">
          <div
            className={`${isMobile ? 'w-[90px] h-[90px] text-[28px]' : 'w-[110px] h-[110px] text-[34px]'} rounded-full overflow-hidden bg-black/5 flex items-center justify-center font-black border border-black/10`}
          >
            {avatar ? (
              <img
                src={imgAvatar(avatar)}
                alt="Avatar"
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover"
              />
            ) : (
              initials
            )}
          </div>

          <label
            className={`${isMobile ? 'px-4 py-3' : 'px-3 py-2'} rounded-lg border border-black/[0.18] bg-white font-bold text-sm min-h-[44px] flex items-center justify-center ${busyAvatar ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
          >
            {busyAvatar ? 'Uploading…' : 'Add photo'}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={busyAvatar}
              onChange={(e) => onPickAvatar(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>

        {/* Fields */}
        <div className="grid grid-cols-1 gap-3">
          <Field label="Name">
            <input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="Surname">
            <input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="Date of birth">
            <input
              type="date"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              className={inputClass}
              max={new Date().toISOString().split('T')[0]}
            />
            {dob && (
              <div className="mt-1.5 text-xs opacity-85 text-slate-900">
                Age: {calculateAge(dob)} years old
              </div>
            )}
          </Field>

          <Field label="Nationality">
            <select
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value)}
              className={inputClass}
            >
              <option value="">Select country…</option>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.flag} {c.name}
                </option>
              ))}
            </select>
            {countryCode && (
              <div className="mt-1.5 text-xs opacity-85 text-slate-900">
                Selected: {COUNTRIES.find((x) => x.code === countryCode)?.flag}{' '}
                {COUNTRIES.find((x) => x.code === countryCode)?.name}
              </div>
            )}
          </Field>

          <Field label="Username">
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="Email">
            <input value={email} readOnly className={`${inputClass} bg-black/5`} />
          </Field>

          <Field label="Password">
            <div className="flex gap-2.5 items-center">
              <input value={'••••••••'} readOnly className={`${inputClass} flex-1 bg-black/5`} />
              <button onClick={onResetPassword} className={smallBtn}>
                Reset
              </button>
            </div>
          </Field>
        </div>

        {err && <div className="mt-3 text-[crimson] text-[13px]">{err}</div>}
        {msg && <div className="mt-3 text-green-700 text-[13px]">{msg}</div>}
      </div>

      {/* Actions */}
      <div className="p-4 border-t border-black/[0.08] flex flex-col gap-2.5 flex-shrink-0">
        <button onClick={onSave} disabled={saving} className={primaryBtn(saving)}>
          {saving ? 'Saving…' : 'Save'}
        </button>

        <button onClick={() => setShowSignOutConfirm(true)} className={dangerBtn}>
          Sign out
        </button>
      </div>

      {showSignOutConfirm && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10000]"
          onClick={() => setShowSignOutConfirm(false)}
        >
          <div
            className="bg-white rounded-[20px] p-6 max-w-[300px] shadow-[0_12px_48px_rgba(0,0,0,0.3)]"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="m-0 mb-3 text-lg text-slate-900">Sign out?</h3>
            <p className="m-0 mb-6 text-sm text-slate-500 leading-relaxed">
              Are you sure you want to sign out? You'll need to sign in again to access your
              profile.
            </p>
            <div className="flex gap-2.5 justify-end">
              <button
                onClick={() => setShowSignOutConfirm(false)}
                className="px-5 py-2.5 rounded-lg border border-black/[0.18] bg-white cursor-pointer text-sm font-semibold text-slate-900"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSignOut}
                className="px-5 py-2.5 rounded-lg border-none bg-[#ff4444] cursor-pointer text-sm font-semibold text-white"
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
