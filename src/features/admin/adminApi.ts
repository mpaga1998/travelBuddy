import { supabase } from '../../lib/supabaseClient';

/**
 * 4.5: Frontend client for the admin endpoints.
 *
 * Mirrors the auth pattern used in itineraryApi.ts — pulls the JWT from the
 * current Supabase session and attaches it as a Bearer token. Server gates
 * on profiles.is_admin = true via requireAdmin.
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

export interface AdminPinReport {
  reason: string;
  createdAt: string;
}

export interface AdminPin {
  id: string;
  title: string;
  description: string;
  category: string;
  lat: number;
  lng: number;
  imageUrls: string[];
  authorLabel: string;
  authorId: string;
  reportCount: number;
  isHidden: boolean;
  createdAt: string;
  recentReports: AdminPinReport[];
}

export interface AdminPinsResponse {
  reported: AdminPin[];
  hidden: AdminPin[];
}

export type AdminAction = 'hide' | 'restore' | 'delete';

async function getAccessToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error('Could not read your session. Please sign in again.');
  const token = data.session?.access_token;
  if (!token) throw new Error('You need to be signed in to do that.');
  return token;
}

/**
 * Fetch the admin moderation queue. Throws on any non-OK response. The
 * 403-vs-200 distinction is what `useIsAdmin` below uses to decide whether
 * to render the admin UI or the 404-style "Not found" page.
 */
export async function fetchAdminPins(): Promise<AdminPinsResponse> {
  const token = await getAccessToken();
  const res = await fetch(`${API_BASE}/admin/pins`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body?.error || `Failed to load admin pins (${res.status})`);
    (err as Error & { status?: number }).status = res.status;
    throw err;
  }
  const data = (await res.json()) as { reported: AdminPin[]; hidden: AdminPin[] };
  return { reported: data.reported, hidden: data.hidden };
}

/**
 * Apply a moderation action to a pin. The server logs the admin id alongside
 * the pin id so we have a (loose) audit trail in Vercel logs.
 */
export async function applyAdminAction(
  pinId: string,
  action: AdminAction
): Promise<void> {
  const token = await getAccessToken();
  const res = await fetch(`${API_BASE}/admin/action`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ pinId, action }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || `Action failed (${res.status})`);
  }
}

/**
 * One-shot admin check used by App.tsx routing. Reads profiles.is_admin for
 * the currently signed-in user. Returns false on any failure (no session,
 * RLS, etc.) — we'd rather hide the admin route than expose it on a fluke.
 */
export async function isCurrentUserAdmin(): Promise<boolean> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return false;

  const { data, error } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', userId)
    .single();

  if (error) {
    console.warn('[admin] is_admin check failed:', error.message);
    return false;
  }
  return Boolean(data?.is_admin);
}
