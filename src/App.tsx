import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./lib/supabaseClient";
import { ensureProfile } from "./lib/ensureProfile";

import { AuthPage } from "./features/auth/AuthPage";
import { LoadingPage } from "./features/auth/LoadingPage";
import { InitialPage } from "./features/auth/InitialPage";
import { MapView } from "./features/map/MapView";

type AppPage = "loading" | "auth" | "initial" | "map";

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [showInitialPage, setShowInitialPage] = useState(true);
  const [currentPage, setCurrentPage] = useState<AppPage>("loading");
  const [mapCenter, setMapCenter] = useState<{ lng: number; lat: number } | null>(null);

  // 1️⃣ Get session on first load
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
      setInitialLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  // 2️⃣ ENSURE PROFILE
  useEffect(() => {
    if (!session) return;

    ensureProfile().catch((e) => {
      console.error("ensureProfile failed:", e);
    });
  }, [session]);

  // 3️⃣ Determine which page to show
  useEffect(() => {
    if (initialLoading) {
      setCurrentPage("loading");
      return;
    }

    if (!session) {
      setCurrentPage("auth");
      return;
    }

    // Logged in: show initial page first
    if (showInitialPage) {
      setCurrentPage("initial");
    } else {
      setCurrentPage("map");
    }
  }, [initialLoading, session, showInitialPage]);

  // Handle loading completion
  const handleLoadingComplete = () => {
    // If not logged in, go to auth. If logged in, stay on initial page
    if (!session) {
      setCurrentPage("auth");
    }
  };

  // Render based on current page
  if (currentPage === "loading") {
    return <LoadingPage onLoadingComplete={handleLoadingComplete} />;
  }

  if (currentPage === "auth") {
    return <AuthPage />;
  }

  if (currentPage === "initial") {
    return (
      <InitialPage
        onGoToMap={(location) => {
          setMapCenter(location);
          setShowInitialPage(false);
        }}
      />
    );
  }

  if (currentPage === "map") {
    return <MapView onBack={() => setShowInitialPage(true)} initialCenter={mapCenter} />;
  }

  return <div>Unknown page state</div>;
}