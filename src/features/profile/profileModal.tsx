import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { COUNTRIES } from "./countries";
import { getMyProfile, sendPasswordReset, updateMyProfile, uploadMyAvatar, type Profile } from "./profileApi";

type Props = {
  open: boolean;
  onClose: () => void;
  onSignedOut: () => void; // optional hook
};

export function ProfileModal({ open, onClose, onSignedOut }: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyAvatar, setBusyAvatar] = useState(false);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState<string>("");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [countryCode, setCountryCode] = useState<string>("");

  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const countryLabel = useMemo(() => {
    const c = COUNTRIES.find((x) => x.code === countryCode);
    return c ? `${c.flag} ${c.name}` : "";
  }, [countryCode]);

  useEffect(() => {
    if (!open) return;

    setErr(null);
    setMsg(null);
    setLoading(true);

    (async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        const user = userData.user;
        setEmail(user?.email ?? "");

        const p = await getMyProfile();
        setProfile(p);

        setFirstName(p.first_name ?? "");
        setLastName(p.last_name ?? "");
        setUsername(p.username ?? "");
        setCountryCode(p.country_code ?? "");
      } catch (e: any) {
        setErr(e?.message ?? "Failed to load profile");
      } finally {
        setLoading(false);
      }
    })();
  }, [open]);

  if (!open) return null;

  async function onSave() {
    if (!profile) return;

    setErr(null);
    setMsg(null);

    const u = username.trim();
    if (!u) {
      setErr("Username is required.");
      return;
    }

    setSaving(true);
    try {
      await updateMyProfile({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        username: u,
        country_code: countryCode || null,
      });

      setMsg("Profile saved.");
    } catch (e: any) {
      // If username unique constraint fails, Supabase returns an error message
      setErr(e?.message ?? "Failed to save profile");
    } finally {
      setSaving(false);
    }
  }

  async function onPickAvatar(file: File | null) {
    if (!file) return;
    setErr(null);
    setMsg(null);

    // Basic validation
    if (!file.type.startsWith("image/")) {
      setErr("Please select an image file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErr("Image too large (max 5MB).");
      return;
    }

    setBusyAvatar(true);
    try {
      const url = await uploadMyAvatar(file);
      setProfile((p) => (p ? { ...p, avatar_url: url } : p));
      setMsg("Avatar updated.");
    } catch (e: any) {
      setErr(e?.message ?? "Failed to upload avatar");
    } finally {
      setBusyAvatar(false);
    }
  }

  async function onResetPassword() {
    setErr(null);
    setMsg(null);
    try {
      if (!email) {
        setErr("No email found for this user.");
        return;
      }
      await sendPasswordReset(email);
      setMsg("Password reset email sent. Check your inbox/spam.");
    } catch (e: any) {
      setErr(e?.message ?? "Failed to send reset email");
    }
  }

  async function onSignOut() {
    await supabase.auth.signOut();
    onClose();
    onSignedOut();
  }

  const avatar = profile?.avatar_url || "";
  const initials =
    `${(firstName?.[0] ?? "").toUpperCase()}${(lastName?.[0] ?? "").toUpperCase()}` || "🙂";

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        zIndex: 50,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(720px, 100%)",
          background: "white",
          borderRadius: 16,
          padding: 16,
          boxShadow: "0 18px 48px rgba(0,0,0,0.22)",
          color: "#111",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <div style={{ fontWeight: 800, fontSize: 16 }}>Profile</div>
          <button
            onClick={onClose}
            style={{ border: "none", background: "transparent", fontSize: 18, cursor: "pointer" }}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {loading ? (
          <div style={{ marginTop: 16 }}>Loading…</div>
        ) : (
          <>
            {/* Avatar */}
            <div style={{ marginTop: 14, display: "grid", justifyItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 110,
                  height: 110,
                  borderRadius: "999px",
                  overflow: "hidden",
                  background: "rgba(0,0,0,0.06)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 34,
                  fontWeight: 900,
                  border: "1px solid rgba(0,0,0,0.10)",
                }}
              >
                {avatar ? (
                  <img
                    src={avatar}
                    alt="Avatar"
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  initials
                )}
              </div>

              <label
                style={{
                  padding: "8px 12px",
                  borderRadius: 10,
                  border: "1px solid rgba(0,0,0,0.18)",
                  background: "white",
                  cursor: busyAvatar ? "not-allowed" : "pointer",
                  fontWeight: 700,
                  opacity: busyAvatar ? 0.6 : 1,
                }}
              >
                {busyAvatar ? "Uploading…" : "Change picture"}
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  disabled={busyAvatar}
                  onChange={(e) => onPickAvatar(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>

            {/* Fields */}
            <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="First name">
                <input value={firstName} onChange={(e) => setFirstName(e.target.value)} style={inputStyle} />
              </Field>

              <Field label="Last name">
                <input value={lastName} onChange={(e) => setLastName(e.target.value)} style={inputStyle} />
              </Field>

              <Field label="Username">
                <input value={username} onChange={(e) => setUsername(e.target.value)} style={inputStyle} />
              </Field>

              <Field label="Email">
                <input value={email} readOnly style={{ ...inputStyle, background: "rgba(0,0,0,0.04)" }} />
              </Field>

              <Field label="Password">
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <input value={"••••••••"} readOnly style={{ ...inputStyle, flex: 1, background: "rgba(0,0,0,0.04)" }} />
                  <button onClick={onResetPassword} style={smallBtn}>
                    Reset
                  </button>
                </div>
              </Field>

              <Field label="Country">
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
                  <div style={{ marginTop: 6, fontSize: 12, opacity: 0.85, color: "#111" }}>
                    Selected: {COUNTRIES.find((x) => x.code === countryCode)?.flag}{" "}
                    {COUNTRIES.find((x) => x.code === countryCode)?.name}
                  </div>
                )}
              </Field>
            </div>

            {/* Errors / messages */}
            {err && <div style={{ marginTop: 12, color: "crimson", fontSize: 13 }}>{err}</div>}
            {msg && <div style={{ marginTop: 12, color: "green", fontSize: 13 }}>{msg}</div>}

            {/* Actions */}
            <div style={{ marginTop: 14, display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <button onClick={onSignOut} style={dangerBtn}>
                Sign out
              </button>

              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={onClose} style={secondaryBtn}>
                  Close
                </button>
                <button onClick={onSave} disabled={saving} style={primaryBtn(saving)}>
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div style={{ fontSize: 12, opacity: 0.8 }}>{label}</div>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(0,0,0,0.2)",
  outline: "none",
  color: "#111",
  background: "white",
};

const smallBtn: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(0,0,0,0.18)",
  background: "white",
  color: "#111",
  cursor: "pointer",
  fontWeight: 800,
};

const secondaryBtn: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(0,0,0,0.18)",
  background: "white",
  color: "#111",
  cursor: "pointer",
  fontWeight: 800,
};

function primaryBtn(disabled: boolean): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 10,
    border: "none",
    background: disabled ? "rgba(0,0,0,0.25)" : "#111",
    color: "white",
    cursor: disabled ? "not-allowed" : "pointer",
    fontWeight: 900,
  };
}

const dangerBtn: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(220,38,38,0.35)",
  background: "rgba(220,38,38,0.08)",
  color: "#991b1b",
  cursor: "pointer",
  fontWeight: 900,
};