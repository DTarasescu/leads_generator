import { createRequestClient } from '../../lib/supabase';
import { getAccessToken } from '../../lib/api-utils';

// Yelp Fusion API — discover local businesses by type and location
// Requires: YELP_API_KEY in env
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const token = getAccessToken(req);
    const supabase = createRequestClient(token);

    const {
      term,          // e.g. "plumbers", "dentists", "web designers"
      location,      // e.g. "Chicago, IL"
      radius = 10000, // metres, max 40000
      limit = 20,
      sort_by = 'rating', // 'best_match'|'rating'|'review_count'|'distance'
    } = req.body;

    if (!term || !location) {
      return res.status(400).json({ error: 'term and location required' });
    }

    const apiKey = process.env.YELP_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'YELP_API_KEY not configured' });

    const params = new URLSearchParams({
      term, location, radius: String(Math.min(radius, 40000)),
      limit: String(Math.min(limit, 50)), sort_by,
    });

    const yelpRes = await fetch(`https://api.yelp.com/v3/businesses/search?${params}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!yelpRes.ok) {
      const err = await yelpRes.json();
      return res.status(502).json({ error: 'Yelp API error', detail: err });
    }

    const { businesses = [] } = await yelpRes.json();

    const leads = businesses.map(biz => ({
      name: biz.name,
      email: null,
      phone: biz.phone || null,
      business_type: biz.categories?.[0]?.title || term,
      website: biz.url || null,
      city: biz.location?.city || null,
      state: biz.location?.state || null,
      country: biz.location?.country || 'US',
      status: 'new',
      source: 'yelp',
      score: Math.round((biz.rating / 5) * 100), // normalize Yelp 0-5 to 0-100
      google_place_id: null,
      tags: ['yelp', ...(biz.categories?.map(c => c.alias) || [])],
      created_at: new Date().toISOString(),
    }));

    const { data, error } = await supabase
      .from('leads')
      .upsert(leads, { onConflict: 'phone' })
      .select();

    if (error) throw error;

    return res.status(200).json({ success: true, found: businesses.length, imported: data.length });
  } catch (err) {
    console.error('[yelp-discover]', err);
    return res.status(500).json({ error: err.message });
  }
}
