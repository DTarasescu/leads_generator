import { createRequestClient, createAdminClient } from '../../lib/supabase';
import { getAccessToken } from '../../lib/api-utils';

// Imports TikTok ad/activity signals into leads
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const token = getAccessToken(req);
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const client = createRequestClient(token);
    const { data: { user }, error: authErr } = await client.auth.getUser();
    if (authErr || !user) return res.status(401).json({ error: 'Invalid token' });

    const { advertisers = [] } = req.body || {};
    if (!Array.isArray(advertisers) || advertisers.length === 0) {
      return res.status(400).json({ error: 'advertisers array is required' });
    }

    const leads = advertisers.slice(0, 100).map((a) => ({
      owner_email: user.email,
      name: a.name || a.handle || 'TikTok advertiser',
      website: a.website || null,
      business_type: a.business_type || 'Ecommerce',
      city: a.city || null,
      country: a.country || null,
      source: 'tiktok_ads_signal',
      status: 'new',
      ai_score: 80,
      ai_score_reason: 'Active ad spend indicates immediate acquisition intent',
      notes: a.notes || `TikTok handle: ${a.handle || 'unknown'}`,
    }));

    const admin = createAdminClient();
    const { data: inserted, error } = await admin.from('leads').insert(leads).select();
    if (error) throw error;

    return res.status(200).json({ success: true, imported: inserted.length });
  } catch (err) {
    console.error('[tiktok-business-discovery]', err);
    return res.status(500).json({ error: err.message });
  }
}
