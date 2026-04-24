import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";

const inputClass =
  "px-3 py-2.5 rounded-[10px] border border-black/20 outline-none text-slate-900 bg-white";

const secondaryBtnClass =
  "px-3 py-2.5 rounded-[10px] border border-black/20 bg-white text-slate-900 font-bold cursor-pointer";

function primaryBtnClass(disabled: boolean): string {
  return [
    "px-3 py-2.5 rounded-[10px] border-none text-white font-extrabold",
    disabled ? "bg-black/25 cursor-not-allowed" : "bg-slate-900 cursor-pointer",
  ].join(" ");
}

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
          emailRedirectTo: `${window.location.origin}/`, // Redirect to home after email confirmation
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
    <div className="max-w-[min(420px,100vw-20px)] mx-auto my-10 p-4 bg-white rounded-xl border border-black/[0.12] shadow-[0_18px_48px_rgba(0,0,0,0.10)] text-slate-900">
      <h2 className="m-0">{mode === "signin" ? "Sign in" : "Create account"}</h2>

      <form onSubmit={handleSubmit} className="grid gap-2.5 mt-3">
        {mode === "signup" && (
          <>
            <div className="grid grid-cols-2 gap-2.5">
              <input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="First name"
                autoComplete="given-name"
                className={inputClass}
              />
              <input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Last name"
                autoComplete="family-name"
                className={inputClass}
              />
            </div>

            <input
              type="date"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              placeholder="Date of birth"
              className={inputClass}
              max={new Date().toISOString().split("T")[0]}
            />

            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              autoComplete="username"
              className={inputClass}
            />
          </>
        )}

        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          autoComplete="email"
          className={inputClass}
        />

        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          type="password"
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          className={inputClass}
        />

        {err && <div className="text-[crimson] text-[13px]">{err}</div>}
        {msg && <div className="text-green-700 text-[13px]">{msg}</div>}

        <button type="submit" disabled={busy} className={primaryBtnClass(busy)}>
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
          className={secondaryBtnClass}
        >
          {mode === "signin" ? "Create an account" : "I already have an account"}
        </button>
      </form>

      <div className="mt-2.5 text-xs opacity-75">
        If you don't receive the confirmation email, check spam/junk.
      </div>
    </div>
  );
}
