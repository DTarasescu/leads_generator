import { createRequestClient, createAdminClient } from '../../lib/supabase';
import { getAccessToken } from '../../lib/api-utils';

// Finds businesses with weak ratings/recent negative review context for outreach timing
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const token = getAccessToken(req);
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const client = createRequestClient(token);
    const { data: { user }, error: authErr } = await client.auth.getUser();
    if (authErr || !user) return res.status(401).json({ error: 'Invalid token' });

    const {
      query,
      location,
      min_reviews = 10,
      max_rating = 3.9,
      limit = 20,
    } = req.body || {};

    if (!query || !location) {
      return res.status(400).json({ error: 'query and location are required' });
    }

    const key = process.env.GOOGLE_PLACES_API_KEY;
    if (!key) return res.status(500).json({ error: 'GOOGLE_PLACES_API_KEY not configured' });

    const params = new URLSearchParams({
      query: `${query} in ${location}`,
      key,
    });

    const placesRes = await fetch(`https://maps.googleapis.com/maps/api/place/textsearch/json?${params.toString()}`);
    if (!placesRes.ok) {
      const detail = await placesRes.text();
      return res.status(502).json({ error: 'Google Places API error', detail });
    }

    const placesData = await placesRes.json();
    const filtered = (placesData.results || [])
      .filter((x) => (x.user_ratings_total || 0) >= min_reviews)
      .filter((x) => (x.rating || 5) <= max_rating)
      .slice(0, Math.min(50, Math.max(1, limit)));

    const leads = filtered.map((p) => ({
      owner_email: user.email,
      name: p.name,
      business_type: query,
      city: p.formatted_address || null,
      country: null,
      website: null,
      google_place_id: p.place_id || null,
      google_rating: p.rating || null,
      google_review_count: p.user_ratings_total || null,
      source: 'google_reviews_alert',
      status: 'new',
      ai_score: 78,
      ai_score_reason: 'Low rating indicates likely demand for growth or reputation help',
      notes: `Google review signal: rating ${p.rating || 'n/a'} from ${p.user_ratings_total || 0} reviews`,
    }));

    if (!leads.length) return res.status(200).json({ success: true, found: 0, imported: 0 });

    const admin = createAdminClient();
    const { data: inserted, error } = await admin
      .from('leads')
      .upsert(leads, { onConflict: 'google_place_id', ignoreDuplicates: true })
      .select();

    if (error) throw error;

    return res.status(200).json({ success: true, found: filtered.length, imported: inserted.length });
  } catch (err) {
    console.error('[google-reviews-alerts]', err);
    return res.status(500).json({ error: err.message });
  }
}
