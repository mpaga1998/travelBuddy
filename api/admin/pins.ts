import type { VercelRequest, VercelResponse } from '@vercel/node';
import dotenv from 'dotenv';
import { requireAdmin } from '../lib/requireAdmin.js';
import { initSupabase } from '../lib/supabaseServer.js';

dotenv.config();

/**
 * GET /api/admin/pins
 *
 * Returns two arrays for the admin dashboard:
 *   - reported: pins with report_count > 0 AND is_hidden = false
 *   - hidden:   pins with is_hidden = true (regardless of report count —
 *               admins may have manually hidden pins below the threshold)
 *
 * Each pin carries author label + the 5 most recent report reasons. We use
 * the service-role client to bypass RLS on pins/profiles/pin_reports — the
 * admin gate has already authorized the caller.
 */

interface AdminPinReport {
  reason: string;
  createdAt: string;
}

interface AdminPin {
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

interface DbReportRow {
  reason: string | null;
  created_at: string;
}

interface DbPinRow {
  id: string;
  title: string;
  description: string | null;
  category: string;
  lat: number;
  lng: number;
  image_urls: string[] | null;
  created_by: string;
  report_count: number;
  is_hidden: boolean;
  created_at: string;
  profiles?: {
    username: string | null;
    role: string | null;
    hostel_name: string | null;
  } | null;
  pin_reports?: DbReportRow[] | null;
}

const SELECT = `
  id, title, description, category, lat, lng, image_urls,
  created_by, report_count, is_hidden, created_at,
  profiles:created_by(username, role, hostel_name),
  pin_reports(reason, created_at)
`;

function authorLabelFor(profile: DbPinRow['profiles']): string {
  if (!profile) return 'Unknown';
  if (profile.role === 'hostel') return profile.hostel_name ?? 'Hostel';
  return profile.username ?? 'Traveler';
}

function mapRow(row: DbPinRow): AdminPin {
  // Pin reports come back unordered; sort newest-first and clip to 5.
  const reports = (row.pin_reports ?? [])
    .slice()
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .slice(0, 5)
    .map((r) => ({ reason: r.reason ?? '', createdAt: r.created_at }));

  return {
    id: row.id,
    title: row.title,
    description: row.description ?? '',
    category: row.category,
    lat: row.lat,
    lng: row.lng,
    imageUrls: row.image_urls ?? [],
    authorLabel: authorLabelFor(row.profiles),
    authorId: row.created_by,
    reportCount: row.report_count,
    isHidden: row.is_hidden,
    createdAt: row.created_at,
    recentReports: reports,
  };
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  const admin = await requireAdmin(req, res);
  if (!admin) return;

  try {
    const supabase = initSupabase();

    // Reported (visible) pins: report_count > 0 AND not hidden, newest reports first.
    // We approximate "newest reports first" with descending created_at on the pin
    // — good enough for a moderation queue, and avoids a server-side aggregate.
    const reportedQ = supabase
      .from('pins')
      .select(SELECT)
      .gt('report_count', 0)
      .eq('is_hidden', false)
      .order('report_count', { ascending: false })
      .limit(200);

    const hiddenQ = supabase
      .from('pins')
      .select(SELECT)
      .eq('is_hidden', true)
      .order('created_at', { ascending: false })
      .limit(200);

    const [reportedRes, hiddenRes] = await Promise.all([reportedQ, hiddenQ]);

    if (reportedRes.error) throw reportedRes.error;
    if (hiddenRes.error) throw hiddenRes.error;

    const reported = ((reportedRes.data ?? []) as unknown as DbPinRow[]).map(mapRow);
    const hidden = ((hiddenRes.data ?? []) as unknown as DbPinRow[]).map(mapRow);

    res.status(200).json({ success: true, reported, hidden });
  } catch (err) {
    console.error('🛡️ [ADMIN] /api/admin/pins failed:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to load admin pins',
    });
  }
}
