import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./lib/supabaseClient";
import { ensureProfile } from "./lib/ensureProfile";

import { AuthPage } from "./features/auth/AuthPage";
import { MapView } from "./features/map/MapView";

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // 1️⃣ Get session on first load
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  // 2️⃣ ENSURE PROFILE — put it HERE
  useEffect(() => {
    if (!session) return;

    ensureProfile().catch((e) => {
      console.error("ensureProfile failed:", e);
    });
  }, [session]);

  // log to check if profile is saved
  useEffect(() => {
    if (!session) return;
    console.log("SESSION USER:", session.user.id, session.user.email);

    ensureProfile()
      .then((p) => console.log("PROFILE OK:", p))
      .catch((e) => console.error("ensureProfile failed:", e));
  }, [session]);

  // 3️⃣ Render logic
  if (loading) return <div style={{ padding: 16 }}>Loading…</div>;
  if (!session) return <AuthPage />;

  return <MapView />;
}