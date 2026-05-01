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
import { isHandleAvailable } from '../publicProfileApi';
import { validateHandle, HANDLE_MAX_LENGTH } from '../handleValidation';
import { Field } from './Field';
import { inputClass, smallBtn, primaryBtn, dangerBtn } from './profileStyles';
import { useConfirm } from '../../../components/ConfirmDialog';
import { compressImage, validateImageFile } from '../../../lib/imageCompress';
import { imgAvatar } from '../../../lib/imageTransforms';

const BIO_MAX_LENGTH = 280;

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
  // 5.1: handle + bio for public profile pages. We initialize from
  // profile.handle/bio (added to the type in profileApi.ts) — these are
  // independent of the existing username field, which stays as the display
  // name shown in pin labels.
  const [handle, setHandle] = useState(profile.handle ?? '');
  const [bio, setBio] = useState(profile.bio ?? '');

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

    // 5.1: handle + bio validation. Handle is optional — empty string clears
    // it (column is nullable). Format/reserved checks live in handleValidation.ts;
    // uniqueness check is a separate DB round-trip via isHandleAvailable.
    const trimmedHandle = handle.trim();
    let normalizedHandle: string | null = null;
    if (trimmedHandle) {
      const result = validateHandle(trimmedHandle);
      if (!result.ok) {
        setErr(result.error);
        return;
      }
      normalizedHandle = result.normalized;
      // Only check availability when the handle actually changed — saves a
      // round-trip on every save and avoids a self-conflict false-positive
      // (the index would catch it anyway via unique violation, but
      // isHandleAvailable already accounts for "already mine = available").
      if (normalizedHandle !== (profile.handle ?? '')) {
        const available = await isHandleAvailable(normalizedHandle);
        if (!available) {
          setErr('That handle is already taken.');
          return;
        }
      }
    }

    if (bio.length > BIO_MAX_LENGTH) {
      setErr(`Bio must be ${BIO_MAX_LENGTH} characters or fewer.`);
      return;
    }

    setSaving(true);
    try {
      await updateMyProfile({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        username: u,
        country_code: countryCode || null,
        dob: dob || null,
        handle: normalizedHandle,
        bio: bio.trim() || null,
      });

      setMsg('Profile saved.');
    } catch (e: any) {
      // Surface unique-violation as a friendlier message — the DB index is
      // the source of truth and can race against isHandleAvailable above.
      const code = (e as { code?: string } | null)?.code;
      if (code === '23505') {
        setErr('That handle is already taken.');
      } else {
        setErr(e?.message ?? 'Failed to save profile');
      }
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

          <Field label="Handle (for public profile URL)">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">@</span>
              <input
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                placeholder="your-handle"
                maxLength={HANDLE_MAX_LENGTH}
                className={inputClass}
              />
            </div>
            {handle && profile.handle === handle.trim().toLowerCase() && (
              <a
                href={`/u/${profile.handle}`}
                className="mt-1.5 inline-block text-xs text-blue-600 hover:underline"
              >
                View public profile →
              </a>
            )}
            <div className="mt-1.5 text-xs text-gray-500">
              3–30 characters, lowercase letters, numbers, _ or -.
            </div>
          </Field>

          <Field label="Bio">
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value.slice(0, BIO_MAX_LENGTH))}
              placeholder="A short blurb shown on your public profile."
              rows={3}
              className={`${inputClass} resize-y min-h-[72px]`}
            />
            <div className="mt-1 text-xs text-gray-500 text-right">
              {bio.length}/{BIO_MAX_LENGTH}
            </div>
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
