import type { VercelRequest, VercelResponse } from '@vercel/node';
import dotenv from 'dotenv';
import { requireAdmin } from '../lib/requireAdmin.js';
import { validateBodySize } from '../lib/validateBodySize.js';
import { initSupabase } from '../lib/supabaseServer.js';

dotenv.config();

/**
 * POST /api/admin/action
 *
 * Body: { pinId: string, action: 'hide' | 'restore' | 'delete' }
 *
 * - hide:     set pins.is_hidden = true. Removes the pin from the public
 *             listPins query (own-author override still applies).
 * - restore:  set pins.is_hidden = false. Use when admin reviewed reports
 *             and decided the pin is fine. Does NOT clear pin_reports —
 *             the report history stays for audit and so the pin can be
 *             re-flagged by the auto-hide trigger if more reports come in.
 * - delete:   permanent. Cascades to pin_reports + pin_reactions +
 *             pin_bookmarks via existing FK ON DELETE CASCADE.
 *
 * Service-role client bypasses RLS — admin gate already authorized.
 */

type AdminAction = 'hide' | 'restore' | 'delete';
const ACTIONS = new Set<AdminAction>(['hide', 'restore', 'delete']);

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  const admin = await requireAdmin(req, res);
  if (!admin) return;

  if (!validateBodySize(req, res)) return;

  const body = (req.body ?? {}) as { pinId?: unknown; action?: unknown };
  const pinId = typeof body.pinId === 'string' ? body.pinId : '';
  const action = typeof body.action === 'string' ? (body.action as AdminAction) : '';

  if (!pinId) {
    res.status(400).json({ success: false, error: 'pinId is required' });
    return;
  }
  if (!ACTIONS.has(action as AdminAction)) {
    res.status(400).json({
      success: false,
      error: `action must be one of: ${Array.from(ACTIONS).join(', ')}`,
    });
    return;
  }

  try {
    const supabase = initSupabase();

    if (action === 'delete') {
      const { error } = await supabase.from('pins').delete().eq('id', pinId);
      if (error) throw error;
      console.log(`🛡️ [ADMIN] ${admin.id} deleted pin ${pinId}`);
      res.status(200).json({ success: true });
      return;
    }

    // hide | restore — both UPDATE the same column.
    const isHidden = action === 'hide';
    const { error } = await supabase
      .from('pins')
      .update({ is_hidden: isHidden })
      .eq('id', pinId);
    if (error) throw error;
    console.log(`🛡️ [ADMIN] ${admin.id} ${action}d pin ${pinId}`);
    res.status(200).json({ success: true });
  } catch (err) {
    console.error('🛡️ [ADMIN] /api/admin/action failed:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Action failed',
    });
  }
}
