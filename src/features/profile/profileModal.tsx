import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { COUNTRIES } from "./countries";
import { getMyProfile, sendPasswordReset, updateMyProfile, uploadMyAvatar, getMyBookmarkedPins, type Profile, calculateAge } from "./profileApi";
import { downloadKML, openGoogleMyMaps, showImportInstructions } from "../../lib/kmlExport";
import { generateKML } from "../../lib/kmlExport";

type Props = {
  open: boolean;
  onClose: () => void;
  onSignedOut: () => void;
};

export function ProfileModal({ open, onClose, onSignedOut }: Props) {
  const [loading, setLoading] = useState(true); // Always start loading
  const [saving, setSaving] = useState(false);
  const [busyAvatar, setBusyAvatar] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [selectedSection, setSelectedSection] = useState<"menu" | "profile" | "saved">("menu"); // Menu or section selection
  const [bookmarkedPins, setBookmarkedPins] = useState<any[]>([]);
  const [loadingBookmarks, setLoadingBookmarks] = useState(false);
  const [selectedPin, setSelectedPin] = useState<any | null>(null); // Pin detail view

  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState<string>("");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [countryCode, setCountryCode] = useState<string>("");
  const [dob, setDob] = useState<string>(""); // ISO date string (YYYY-MM-DD)

  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setLoading(true);
      setSelectedSection("menu");
      setSelectedPin(null);
      // Reset all form data when modal closes
      setProfile(null);
      setEmail("");
      setFirstName("");
      setLastName("");
      setUsername("");
      setCountryCode("");
      setDob("");
      setBookmarkedPins([]);
      setErr(null);
      setMsg(null);
      return;
    }

    setLoading(true);
    setErr(null);
    setMsg(null);

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
        setDob(p.dob ?? "");
      } catch (e: any) {
        setErr(e?.message ?? "Failed to load profile");
      } finally {
        setLoading(false);
      }
    })();
  }, [open]);

  // Load bookmarked pins when Saved section is opened
  useEffect(() => {
    if (!open || selectedSection !== "saved") return;

    setLoadingBookmarks(true);
    (async () => {
      try {
        console.log("🔖 Fetching bookmarked pins...");
        const pins = await getMyBookmarkedPins();
        console.log("✅ Bookmarked pins fetched:", pins);
        setBookmarkedPins(pins);
      } catch (e: any) {
        console.error("❌ Failed to load bookmarked pins:", e?.message || e);
        setBookmarkedPins([]);
      } finally {
        setLoadingBookmarks(false);
      }
    })();
  }, [open, selectedSection]);

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

    // Validate age if DoB is provided
    if (dob) {
      const age = calculateAge(dob);
      if (age === null) {
        setErr("Invalid date of birth.");
        return;
      }
      if (age < 18) {
        setErr("You must be at least 18 years old.");
        return;
      }
      // Show warning for over 100
      if (age > 100) {
        const confirmed = window.confirm(
          `Wow, ${age} years old? You're basically a legend! 🎉 Continue anyway?`
        );
        if (!confirmed) {
          return;
        }
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
    setShowSignOutConfirm(false);
    await supabase.auth.signOut();
    onClose();
    onSignedOut();
  }

  const avatar = profile?.avatar_url || "";
  const initials =
    `${(firstName?.[0] ?? "").toUpperCase()}${(lastName?.[0] ?? "").toUpperCase()}` || "🙂";

  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        display: "flex",
        alignItems: isMobile ? "flex-end" : "center",
        justifyContent: "center",
        padding: isMobile ? 0 : 16,
        zIndex: 50,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: isMobile ? "100%" : "min(720px, 100%)",
          background: "white",
          borderRadius: isMobile ? "16px 16px 0 0" : 16,
          padding: 0,
          boxShadow: "0 18px 48px rgba(0,0,0,0.22)",
          color: "#111",
          maxHeight: isMobile ? "90vh" : "auto",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ padding: 16, borderBottom: "1px solid rgba(0,0,0,0.08)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexShrink: 0 }}>
          {selectedSection === "menu" ? (
            <div style={{ fontWeight: 800, fontSize: 16 }}>Menu</div>
          ) : (
            <button
              onClick={() => setSelectedSection("menu")}
              style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 16, fontWeight: 600, color: "#2563eb", padding: "4px 8px", display: "flex", alignItems: "center", gap: 4 }}
            >
              ← Back
            </button>
          )}
          <button
            onClick={onClose}
            style={{ border: "none", background: "transparent", fontSize: 24, cursor: "pointer", padding: "4px 8px", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "unset", minWidth: "unset", color: "#111", lineHeight: "1" }}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {selectedSection === "menu" ? (
          /* Menu Screen */
          <div style={{ flex: 1, overflow: "auto", padding: 32, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>👤</div>
            <button
              onClick={() => setSelectedSection("profile")}
              onTouchStart={(e) => e.preventDefault()}
              type="button"
              style={{
                width: "100%",
                maxWidth: 300,
                padding: "20px 24px",
                borderRadius: 16,
                border: "2px solid #2563eb",
                background: "white",
                cursor: "pointer",
                fontSize: 16,
                fontWeight: 700,
                color: "#2563eb",
                transition: "all 0.2s",
                boxShadow: "0 4px 12px rgba(37, 99, 235, 0.12)",
              }}
              onMouseEnter={(e) => {
                (e.target as HTMLElement).style.background = "rgba(37, 99, 235, 0.05)";
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLElement).style.background = "white";
              }}
            >
              👤 Profile Info
            </button>

            <div style={{ fontSize: 48, marginTop: 16, marginBottom: 16 }}>🔖</div>
            <button
              onClick={() => setSelectedSection("saved")}
              onTouchStart={(e) => e.preventDefault()}
              type="button"
              style={{
                width: "100%",
                maxWidth: 300,
                padding: "20px 24px",
                borderRadius: 16,
                border: "2px solid #16a34a",
                background: "white",
                cursor: "pointer",
                fontSize: 16,
                fontWeight: 700,
                color: "#16a34a",
                transition: "all 0.2s",
                boxShadow: "0 4px 12px rgba(22, 163, 74, 0.12)",
              }}
              onMouseEnter={(e) => {
                (e.target as HTMLElement).style.background = "rgba(22, 163, 74, 0.05)";
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLElement).style.background = "white";
              }}
            >
              🔖 Saved
            </button>
          </div>
        ) : loading ? (
          <div style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            padding: 32,
            minHeight: isMobile ? 300 : 400,
          }}>
            <div
              style={{
                width: 48,
                height: 48,
                border: "4px solid #e5e7eb",
                borderTop: "4px solid #2563eb",
                borderRadius: "50%",
                animation: "spin 1s linear infinite",
              }}
            />
            <div style={{ fontSize: 14, color: "#666", fontWeight: 500 }}>Loading profile…</div>
            <style>{`
              @keyframes spin {
                to { transform: rotate(360deg); }
              }
            `}</style>
          </div>
        ) : selectedSection === "profile" ? (
          <>
            <div style={{ flex: 1, overflow: "auto", padding: 16, display: "flex", flexDirection: "column" }}>
              {/* Avatar */}
              <div style={{ display: "grid", justifyItems: "center", gap: 10, marginBottom: 16 }}>
                <div
                  style={{
                    width: isMobile ? 90 : 110,
                    height: isMobile ? 90 : 110,
                    borderRadius: "999px",
                    overflow: "hidden",
                    background: "rgba(0,0,0,0.06)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: isMobile ? 28 : 34,
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
                    padding: isMobile ? "12px 16px" : "8px 12px",
                    borderRadius: 10,
                    border: "1px solid rgba(0,0,0,0.18)",
                    background: "white",
                    cursor: busyAvatar ? "not-allowed" : "pointer",
                    fontWeight: 700,
                    opacity: busyAvatar ? 0.6 : 1,
                    fontSize: 14,
                    minHeight: 44,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {busyAvatar ? "Uploading…" : "Add photo"}
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
              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
                <Field label="Name">
                  <input value={firstName} onChange={(e) => setFirstName(e.target.value)} style={inputStyle} />
                </Field>

                <Field label="Surname">
                  <input value={lastName} onChange={(e) => setLastName(e.target.value)} style={inputStyle} />
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
                    <div style={{ marginTop: 6, fontSize: 12, opacity: 0.85, color: "#111" }}>
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
                    <div style={{ marginTop: 6, fontSize: 12, opacity: 0.85, color: "#111" }}>
                      Selected: {COUNTRIES.find((x) => x.code === countryCode)?.flag}{" "}
                      {COUNTRIES.find((x) => x.code === countryCode)?.name}
                    </div>
                  )}
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
              </div>

              {/* Errors / messages */}
              {err && <div style={{ marginTop: 12, color: "crimson", fontSize: 13 }}>{err}</div>}
              {msg && <div style={{ marginTop: 12, color: "green", fontSize: 13 }}>{msg}</div>}
            </div>

            {/* Actions - Save button and Sign out */}
            <div style={{ padding: 16, borderTop: "1px solid rgba(0,0,0,0.08)", display: "flex", flexDirection: "column", gap: 10, flexShrink: 0 }}>
              <button onClick={onSave} disabled={saving} style={primaryBtn(saving)}>
                {saving ? "Saving…" : "Save"}
              </button>

              <button onClick={() => setShowSignOutConfirm(true)} style={dangerBtn}>
                Sign out
              </button>
            </div>
          </>
        ) : selectedSection === "saved" ? (
          /* Saved Pins Section */
          <div style={{ flex: 1, overflow: "auto", padding: 16, display: "flex", flexDirection: "column" }}>
            {selectedPin ? (
              /* Pin Detail View */
              <>
                <button
                  onClick={() => setSelectedPin(null)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontSize: 18,
                    color: "#2563eb",
                    fontWeight: 600,
                    marginBottom: 12,
                    padding: 0,
                    textAlign: "left",
                  }}
                >
                  ← Back
                </button>

                {/* Pin Image */}
                {selectedPin.images && selectedPin.images.length > 0 && (
                  <div style={{
                    width: "100%",
                    height: 200,
                    borderRadius: 12,
                    overflow: "hidden",
                    marginBottom: 16,
                    background: "#f3f4f6",
                  }}>
                    <img
                      src={selectedPin.images[0]}
                      alt={selectedPin.title}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                  </div>
                )}

                {/* Pin Title */}
                <div style={{
                  fontSize: isMobile ? 18 : 20,
                  fontWeight: 700,
                  color: "#111",
                  marginBottom: 8,
                }}>
                  {selectedPin.title}
                </div>

                {/* Pin Category */}
                {selectedPin.category && (
                  <div style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#0066cc",
                    background: "rgba(0, 102, 204, 0.1)",
                    borderRadius: 6,
                    padding: "4px 10px",
                    width: "fit-content",
                    textTransform: "capitalize",
                    marginBottom: 12,
                  }}>
                    {selectedPin.category}
                  </div>
                )}

                {/* Pin Description */}
                {selectedPin.description && (
                  <div style={{
                    fontSize: 14,
                    color: "#333",
                    lineHeight: 1.6,
                    marginBottom: 16,
                  }}>
                    {selectedPin.description}
                  </div>
                )}

                {/* Pin Stats */}
                <div style={{
                  display: "flex",
                  gap: 16,
                  flexWrap: "wrap",
                  marginBottom: 16,
                  paddingTop: 12,
                  borderTop: "1px solid rgba(0,0,0,0.08)",
                }}>
                  {selectedPin.bookmark_count > 0 && (
                    <div style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      fontSize: 14,
                      color: "#666",
                    }}>
                      <span>❤️</span>
                      <span>{selectedPin.bookmark_count} bookmarks</span>
                    </div>
                  )}
                  {selectedPin.likes_count > 0 && (
                    <div style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      fontSize: 14,
                      color: "#666",
                    }}>
                      <span>👍</span>
                      <span>{selectedPin.likes_count} likes</span>
                    </div>
                  )}
                </div>

                {/* Pin Tips */}
                {selectedPin.tips && selectedPin.tips.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#666",
                      marginBottom: 8,
                      textTransform: "uppercase",
                    }}>
                      Tips
                    </div>
                    <div style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                    }}>
                      {selectedPin.tips.map((tip: string, idx: number) => (
                        <div
                          key={idx}
                          style={{
                            fontSize: 13,
                            color: "#555",
                            padding: "6px 8px",
                            background: "rgba(0,0,0,0.04)",
                            borderRadius: 6,
                          }}
                        >
                          • {tip}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : loadingBookmarks ? (
              <div style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 16,
              }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    border: "3px solid #e5e7eb",
                    borderTop: "3px solid #2563eb",
                    borderRadius: "50%",
                    animation: "spin 1s linear infinite",
                  }}
                />
                <div style={{ fontSize: 13, color: "#666", fontWeight: 500 }}>Loading saved pins…</div>
              </div>
            ) : bookmarkedPins.length === 0 ? (
              <div style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 12,
                color: "#666",
              }}>
                <div style={{ fontSize: 32 }}>🔖</div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>No saved pins yet</div>
                <div style={{ fontSize: 12, opacity: 0.75, textAlign: "center" }}>
                  Bookmark pins from the map to save them here
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%" }}>
                {/* Export Actions */}
                <div style={{ display: "flex", gap: 10, width: "100%" }}>
                  <button
                    onClick={() => {
                      const kml = generateKML(bookmarkedPins);
                      downloadKML(kml);
                      showImportInstructions();
                    }}
                    style={{
                      flex: 1,
                      padding: "12px 16px",
                      borderRadius: 10,
                      border: "1px solid rgba(37, 99, 235, 0.3)",
                      background: "rgba(37, 99, 235, 0.08)",
                      color: "#2563eb",
                      cursor: "pointer",
                      fontWeight: 700,
                      fontSize: 14,
                      transition: "all 0.2s",
                    }}
                    onMouseEnter={(e) => {
                      (e.target as HTMLElement).style.background = "rgba(37, 99, 235, 0.15)";
                    }}
                    onMouseLeave={(e) => {
                      (e.target as HTMLElement).style.background = "rgba(37, 99, 235, 0.08)";
                    }}
                  >
                    📥 Download KML
                  </button>

                  <button
                    onClick={openGoogleMyMaps}
                    style={{
                      flex: 1,
                      padding: "12px 16px",
                      borderRadius: 10,
                      border: "1px solid rgba(34, 197, 94, 0.3)",
                      background: "rgba(34, 197, 94, 0.08)",
                      color: "#22c55e",
                      cursor: "pointer",
                      fontWeight: 700,
                      fontSize: 14,
                      transition: "all 0.2s",
                    }}
                    onMouseEnter={(e) => {
                      (e.target as HTMLElement).style.background = "rgba(34, 197, 94, 0.15)";
                    }}
                    onMouseLeave={(e) => {
                      (e.target as HTMLElement).style.background = "rgba(34, 197, 94, 0.08)";
                    }}
                  >
                    🗺️ Open My Maps
                  </button>
                </div>

                {/* Pins Grid */}
                <div style={{
                  display: "grid",
                  gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(3, 1fr)",
                  gap: isMobile ? 12 : 16,
                }}>
                {bookmarkedPins.map((pin) => (
                  <div
                    key={pin.id}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      borderRadius: 12,
                      border: "1px solid rgba(0,0,0,0.08)",
                      overflow: "hidden",
                      background: "white",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                      minHeight: isMobile ? 140 : 160,
                      touchAction: "manipulation",
                    }}
                    onClick={() => setSelectedPin(pin)}
                    role="button"
                    tabIndex={0}
                  >
                    {/* Pin Image or Placeholder */}
                    <div style={{
                      flex: 1,
                      background: "#f3f4f6",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: isMobile ? 28 : 32,
                      overflow: "hidden",
                      position: "relative",
                    }}>
                      {pin.images && pin.images.length > 0 ? (
                        <img
                          src={pin.images[0]}
                          alt={pin.title}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                          }}
                          onError={(e) => {
                            console.error(`❌ Failed to load image for pin "${pin.title}": ${pin.images[0]}`);
                            e.currentTarget.style.display = "none";
                          }}
                          onLoad={() => {
                            console.log(`✅ Loaded image for pin "${pin.title}": ${pin.images[0]}`);
                          }}
                        />
                      ) : (
                        <div>📍</div>
                      )}
                    </div>

                    {/* Pin Info */}
                    <div style={{
                      padding: isMobile ? 10 : 12,
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                    }}>
                      {/* Title */}
                      <div style={{
                        fontSize: isMobile ? 12 : 13,
                        fontWeight: 600,
                        color: "#111",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}>
                        {pin.title}
                      </div>

                      {/* Category Badge */}
                      {pin.category && (
                        <div style={{
                          fontSize: 10,
                          fontWeight: 500,
                          color: "#0066cc",
                          background: "rgba(0, 102, 204, 0.1)",
                          borderRadius: 4,
                          padding: "2px 6px",
                          width: "fit-content",
                          textTransform: "capitalize",
                        }}>
                          {pin.category}
                        </div>
                      )}

                      {/* Bookmark Count */}
                      {pin.bookmark_count > 0 && (
                        <div style={{
                          fontSize: 10,
                          color: "#666",
                          marginTop: 2,
                        }}>
                          ❤️ {pin.bookmark_count}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              </div>
            )}
          </div>
        ) : null}
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
                onClick={onSignOut}
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
  padding: "12px 14px",
  borderRadius: 10,
  border: "1px solid rgba(0,0,0,0.2)",
  outline: "none",
  color: "#111",
  background: "white",
  minHeight: 44,
};

const smallBtn: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid rgba(0,0,0,0.18)",
  background: "white",
  color: "#111",
  cursor: "pointer",
  fontWeight: 800,
  minHeight: 44,
};

function primaryBtn(disabled: boolean): React.CSSProperties {
  return {
    padding: "12px 16px",
    borderRadius: 10,
    border: "none",
    background: disabled ? "rgba(0,0,0,0.25)" : "#111",
    color: "white",
    cursor: disabled ? "not-allowed" : "pointer",
    fontWeight: 900,
    minHeight: 44,
    width: "100%",
  };
}

const dangerBtn: React.CSSProperties = {
  padding: "12px 16px",
  borderRadius: 10,
  border: "1px solid rgba(220,38,38,0.35)",
  background: "rgba(220,38,38,0.08)",
  color: "#991b1b",
  cursor: "pointer",
  fontWeight: 900,
  minHeight: 44,
  width: "100%",
};