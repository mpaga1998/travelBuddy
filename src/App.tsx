import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Toaster } from "sonner";
import { supabase } from "./lib/supabaseClient";
import { ensureProfile } from "./lib/ensureProfile";

import { AuthPage } from "./features/auth/AuthPage";
import { LoadingPage } from "./features/auth/LoadingPage";
import { InitialPage } from "./features/auth/InitialPage";
import { MapView } from "./features/map/MapView";
import { AdminPage } from "./features/admin/AdminPage";
import { isCurrentUserAdmin } from "./features/admin/adminApi";
import { TermsPage } from "./features/legal/TermsPage";
import { GuidelinesPage } from "./features/legal/GuidelinesPage";
import { PublicProfilePage } from "./features/profile/PublicProfilePage";
import { FeedPage } from "./features/feed/FeedPage";
import { FeatureErrorBoundary } from "./components/FeatureErrorBoundary";
import { ConfirmDialogProvider } from "./components/ConfirmDialog";
import { PromptDialogProvider } from "./components/PromptDialog";

type AppPage =
  | "loading"
  | "auth"
  | "initial"
  | "map"
  | "admin"
  | "notfound"
  | "terms"
  | "guidelines"
  | "user"
  | "feed";

/**
 * Parse a /u/<handle> URL. Returns the lowercased handle or null when the
 * path doesn't match. Trailing slashes are tolerated. The handle itself is
 * lowercased here to match the DB CHECK constraint.
 */
function parseUserHandle(path: string): string | null {
  const m = path.match(/^\/u\/([^/?#]+)\/?$/);
  if (!m) return null;
  try {
    return decodeURIComponent(m[1]).toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Read the current pathname. Memoized at call time only — we wire a popstate
 * listener separately so the back/forward buttons still work for /admin.
 */
function readPath(): string {
  if (typeof window === 'undefined') return '/';
  return window.location.pathname;
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [showInitialPage, setShowInitialPage] = useState(true);
  const [currentPage, setCurrentPage] = useState<AppPage>("loading");
  const [mapCenter, setMapCenter] = useState<{ lng: number; lat: number } | null>(null);

  // Path-based admin routing (no router dep). When the URL is /admin and the
  // user is signed in, we run an is_admin check. Non-admins see "notfound"
  // so the route does not reveal that admin tooling exists.
  const [pathname, setPathname] = useState<string>(readPath);
  const [adminCheck, setAdminCheck] = useState<'pending' | 'allow' | 'deny'>('pending');

  // Listen to back/forward so the admin URL behaves like a normal page.
  useEffect(() => {
    const onPop = () => setPathname(readPath());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

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

  // Run the is_admin check whenever the user lands on /admin while signed in.
  // Reset to 'pending' on path/session change so navigating away then back
  // re-checks (covers role changes and sign-in/out cycles).
  useEffect(() => {
    if (pathname !== '/admin') {
      setAdminCheck('pending');
      return;
    }
    if (!session) return;
    let cancelled = false;
    setAdminCheck('pending');
    isCurrentUserAdmin().then((ok) => {
      if (cancelled) return;
      setAdminCheck(ok ? 'allow' : 'deny');
    });
    return () => { cancelled = true; };
  }, [pathname, session]);

  // 3️⃣ Determine which page to show
  useEffect(() => {
    if (initialLoading) {
      setCurrentPage("loading");
      return;
    }

    // Public routes — short-circuit before the auth guard so these pages are
    // reachable while signed out (and also while signed in).
    if (pathname === '/terms') {
      setCurrentPage('terms');
      return;
    }
    if (pathname === '/guidelines') {
      setCurrentPage('guidelines');
      return;
    }
    if (parseUserHandle(pathname)) {
      setCurrentPage('user');
      return;
    }

    if (!session) {
      setCurrentPage("auth");
      return;
    }

    // /admin route handling — only kicks in for signed-in users.
    if (pathname === '/admin') {
      if (adminCheck === 'pending') {
        setCurrentPage("loading");
        return;
      }
      setCurrentPage(adminCheck === 'allow' ? 'admin' : 'notfound');
      return;
    }

    // 5.3: /feed activity timeline. Sits behind the auth gate because it's
    // inherently personal (your follow graph). Signed-out visitors will have
    // already been redirected to /auth above.
    if (pathname === '/feed') {
      setCurrentPage('feed');
      return;
    }

    // Logged in: show initial page first
    if (showInitialPage) {
      setCurrentPage("initial");
    } else {
      setCurrentPage("map");
    }
  }, [initialLoading, session, showInitialPage, pathname, adminCheck]);

  // Handle loading completion
  const handleLoadingComplete = () => {
    // If not logged in, go to auth. If logged in, stay on initial page
    if (!session) {
      setCurrentPage("auth");
    }
  };

  // The Toaster + confirm/prompt providers wrap every page so toast() and
  // useConfirm()/usePrompt() work from anywhere in the tree, including deep
  // children mounted inside modals.
  return (
    <ConfirmDialogProvider>
      <PromptDialogProvider>
        <Toaster position="top-center" richColors closeButton />
        {renderPage()}
      </PromptDialogProvider>
    </ConfirmDialogProvider>
  );

  function renderPage() {
    if (currentPage === "loading") {
      return <LoadingPage onLoadingComplete={handleLoadingComplete} />;
    }

    if (currentPage === "auth") {
      return <AuthPage />;
    }

    if (currentPage === "initial") {
      return (
        <FeatureErrorBoundary featureName="Home">
          <InitialPage
            onGoToMap={(location) => {
              setMapCenter(location);
              setShowInitialPage(false);
            }}
          />
        </FeatureErrorBoundary>
      );
    }

    if (currentPage === "map") {
      return (
        <FeatureErrorBoundary featureName="Map">
          <MapView onBack={() => { setShowInitialPage(true); }} initialCenter={mapCenter} />
        </FeatureErrorBoundary>
      );
    }

    if (currentPage === "admin") {
      return (
        <FeatureErrorBoundary featureName="Admin">
          <AdminPage
            onBack={() => {
              // pushState then sync local state so the URL stops being /admin.
              window.history.pushState({}, '', '/');
              setPathname('/');
            }}
          />
        </FeatureErrorBoundary>
      );
    }

    if (currentPage === "terms") {
      return (
        <TermsPage
          onBack={() => {
            window.history.pushState({}, '', '/');
            setPathname('/');
          }}
        />
      );
    }

    if (currentPage === "guidelines") {
      return (
        <GuidelinesPage
          onBack={() => {
            window.history.pushState({}, '', '/');
            setPathname('/');
          }}
        />
      );
    }

    if (currentPage === "feed") {
      return (
        <FeatureErrorBoundary featureName="Feed">
          <FeedPage
            onBack={() => {
              window.history.pushState({}, '', '/');
              setPathname('/');
            }}
            onOpenMap={() => {
              // Pop back to '/' first, then transition into the map view via
              // the existing showInitialPage flag. Keeps the URL clean and
              // matches how InitialPage opens the map.
              window.history.pushState({}, '', '/');
              setPathname('/');
              setShowInitialPage(false);
            }}
          />
        </FeatureErrorBoundary>
      );
    }

    if (currentPage === "user") {
      // Parse the handle at render time so it always tracks the current path —
      // covers the case where the user pastes a different /u/:handle URL while
      // already on a profile page (popstate updates `pathname`, which retriggers
      // PublicProfilePage's load via its `handle` prop).
      const handle = parseUserHandle(pathname);
      if (!handle) {
        // Defensive: pathname changed out from under us. Fall through to home.
        return (
          <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-gray-700 p-6 text-center">
            <h1 className="text-2xl font-bold mb-2">404</h1>
            <p className="text-sm text-gray-500 mb-6">This page could not be found.</p>
          </div>
        );
      }
      return (
        <FeatureErrorBoundary featureName="Profile">
          <PublicProfilePage
            handle={handle}
            onBack={() => {
              window.history.pushState({}, '', '/');
              setPathname('/');
            }}
          />
        </FeatureErrorBoundary>
      );
    }

    if (currentPage === "notfound") {
      // Deliberately generic — do not reveal the admin route exists.
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-gray-700 p-6 text-center">
          <h1 className="text-2xl font-bold mb-2">404</h1>
          <p className="text-sm text-gray-500 mb-6">This page could not be found.</p>
          <button
            type="button"
            onClick={() => {
              window.history.pushState({}, '', '/');
              setPathname('/');
            }}
            className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-semibold"
          >
            Go home
          </button>
        </div>
      );
    }

    return <div>Unknown page state</div>;
  }
}
