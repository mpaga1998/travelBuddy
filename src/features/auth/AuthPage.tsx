import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export function AuthPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dob, setDob] = useState("");
  const [username, setUsername] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);

    const cleanEmail = email.trim();
    const cleanPassword = password;

    if (!cleanEmail || !cleanPassword) {
      setErr("Email and password are required.");
      return;
    }

    if (mode === "signup") {
      if (!firstName.trim() || !lastName.trim()) {
        setErr("First name and last name are required.");
        return;
      }
      if (!username.trim()) {
        setErr("Username is required.");
        return;
      }
      if (!dob.trim()) {
        setErr("Date of birth is required.");
        return;
      }
      // Validate age is 18+
      const birthDate = new Date(dob);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      if (age < 18) {
        setErr("You must be at least 18 years old.");
        return;
      }
    }

    setBusy(true);
    try {
      if (mode === "signin") {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: cleanPassword,
        });
        if (signInError) throw signInError;
        return; // App.tsx handles session -> redirect
      }

      // SIGN UP (with metadata for trigger-based profile creation)
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: cleanEmail,
        password: cleanPassword,
        options: {
          emailRedirectTo: `${window.location.origin}/`,  // Redirect to home after email confirmation
          data: {
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            username: username.trim(),
            dob: dob,
          },
        },
      });

      if (signUpError) throw signUpError;

      // If email confirmations are ON, there is no session yet.
      if (!signUpData.session) {
        setMsg("Account created! Please check your email to confirm your account.");
      } else {
        setMsg("Account created! You are now signed in.");
      }

      setMode("signin");
      setPassword("");
    } catch (e: any) {
      setErr(e?.message ?? "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        maxWidth: "min(420px, 100vw - 20px)",
        margin: "40px auto",
        padding: "16px",
        background: "white",
        borderRadius: 12,
        border: "1px solid rgba(0,0,0,0.12)",
        boxShadow: "0 18px 48px rgba(0,0,0,0.10)",
        color: "#111",
      }}
    >
      <h2 style={{ margin: 0 }}>{mode === "signin" ? "Sign in" : "Create account"}</h2>

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 10, marginTop: 12 }}>
        {mode === "signup" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="First name"
                autoComplete="given-name"
                style={inputStyle}
              />
              <input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Last name"
                autoComplete="family-name"
                style={inputStyle}
              />
            </div>

            <input
              type="date"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              placeholder="Date of birth"
              style={inputStyle}
              max={new Date().toISOString().split('T')[0]}
            />

            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              autoComplete="username"
              style={inputStyle}
            />
          </>
        )}

        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          autoComplete="email"
          style={inputStyle}
        />

        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          type="password"
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          style={inputStyle}
        />

        {err && <div style={{ color: "crimson", fontSize: 13 }}>{err}</div>}
        {msg && <div style={{ color: "green", fontSize: 13 }}>{msg}</div>}

        <button type="submit" disabled={busy} style={primaryBtnStyle(busy)}>
          {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Sign up"}
        </button>

        <button
          type="button"
          onClick={() => {
            setErr(null);
            setMsg(null);
            setMode(mode === "signin" ? "signup" : "signin");
            setDob("");
            setPassword("");
          }}
          style={secondaryBtnStyle}
        >
          {mode === "signin" ? "Create an account" : "I already have an account"}
        </button>
      </form>

      <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
        If you don’t receive the confirmation email, check spam/junk.
      </div>
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

function primaryBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 10,
    border: "none",
    background: disabled ? "rgba(0,0,0,0.25)" : "#111",
    color: "white",
    fontWeight: 800,
    cursor: disabled ? "not-allowed" : "pointer",
  };
}

const secondaryBtnStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(0,0,0,0.2)",
  background: "white",
  color: "#111",
  fontWeight: 700,
  cursor: "pointer",
};