import { createRequestClient, createAdminClient } from '../../lib/supabase';
import { getAccessToken } from '../../lib/api-utils';

// Discover leads from company news signals (funding, hiring, expansion, partnerships)
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const token = getAccessToken(req);
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const client = createRequestClient(token);
    const { data: { user }, error: authErr } = await client.auth.getUser();
    if (authErr || !user) return res.status(401).json({ error: 'Invalid token' });

    const {
      query = 'startup funding OR opens office OR hiring OR partnership',
      country = 'us',
      max = 15,
    } = req.body || {};

    const apiKey = process.env.GNEWS_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'GNEWS_API_KEY not configured' });
    }

    const params = new URLSearchParams({
      q: query,
      country,
      lang: 'en',
      max: String(Math.min(25, Math.max(1, max))),
      apikey: apiKey,
    });

    const apiRes = await fetch(`https://gnews.io/api/v4/search?${params.toString()}`);
    if (!apiRes.ok) {
      const detail = await apiRes.text();
      return res.status(502).json({ error: 'GNews API error', detail });
    }

    const data = await apiRes.json();
    const leads = (data.articles || []).map((article) => {
      const sourceName = article?.source?.name || 'Press Source';
      return {
        owner_email: user.email,
        name: sourceName,
        business_type: 'Company',
        website: article.url || null,
        city: null,
        country: country.toUpperCase(),
        source: 'press_release',
        status: 'new',
        ai_score: 72,
        ai_score_reason: 'Recent news activity indicates potential buying momentum',
        notes: `${article.title || 'News signal'}${article.description ? ` - ${article.description}` : ''}`,
      };
    });

    if (!leads.length) return res.status(200).json({ success: true, found: 0, imported: 0 });

    const admin = createAdminClient();
    const { data: inserted, error } = await admin.from('leads').insert(leads).select();
    if (error) throw error;

    return res.status(200).json({ success: true, found: leads.length, imported: inserted.length });
  } catch (err) {
    console.error('[press-release-monitor]', err);
    return res.status(500).json({ error: err.message });
  }
}
