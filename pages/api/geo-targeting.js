import { createRequestClient } from '../../lib/supabase';
import { getAccessToken } from '../../lib/api-utils';

// Geo-targeting: discover leads near a GPS coordinate using Google Places Nearby Search
// More precise than text search — target leads within X meters of a location
// Requires: GOOGLE_PLACES_API_KEY
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const token = getAccessToken(req);
    const supabase = createRequestClient(token);

    const {
      lat,
      lng,
      radius_meters = 5000, // 5km default
      business_type,        // e.g. 'restaurant', 'gym', 'accountant'
      keyword,              // additional keyword filter
      min_rating = 0,       // filter by Google rating (0-5)
      open_now = false,
    } = req.body;

    if (!lat || !lng) return res.status(400).json({ error: 'lat and lng required' });

    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'GOOGLE_PLACES_API_KEY not configured' });

    if (radius_meters > 50000) {
      return res.status(400).json({ error: 'radius_meters must be ≤ 50000 (50km)' });
    }

    const params = new URLSearchParams({
      location: `${lat},${lng}`,
      radius: String(radius_meters),
      key: apiKey,
      ...(business_type && { type: business_type }),
      ...(keyword && { keyword }),
      ...(open_now && { opennow: 'true' }),
    });

    const placesRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/nearbysearch/json?${params}`
    );

    const placesData = await placesRes.json();

    if (placesData.status !== 'OK' && placesData.status !== 'ZERO_RESULTS') {
      return res.status(502).json({ error: placesData.status, message: placesData.error_message });
    }

    const places = (placesData.results || []).filter(p => p.rating >= min_rating);

    const leads = places.map(p => ({
      name: p.name,
      email: null,
      phone: null,
      business_type: p.types?.[0]?.replace(/_/g, ' ') || business_type || 'Local Business',
      website: null,
      city: p.vicinity?.split(',').pop()?.trim() || null,
      state: null,
      country: 'US',
      status: 'new',
      source: 'geo_targeting',
      score: p.rating ? Math.round((p.rating / 5) * 100) : 50,
      google_place_id: p.place_id,
      tags: [
        'geo-targeted',
        ...(p.types?.slice(0, 2) || []),
        `rating-${p.rating || 'unknown'}`,
        `reviews-${p.user_ratings_total || 0}`,
      ],
      lat: p.geometry?.location?.lat || null,
      lng: p.geometry?.location?.lng || null,
      created_at: new Date().toISOString(),
    }));

    if (leads.length === 0) {
      return res.status(200).json({ success: true, found: 0, imported: 0 });
    }

    // Enrich top 5 with phone + website via Place Details
    for (let i = 0; i < Math.min(5, leads.length); i++) {
      const placeId = places[i].place_id;
      try {
        const detailRes = await fetch(
          `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=formatted_phone_number,website,formatted_address&key=${apiKey}`
        );
        const detail = await detailRes.json();
        if (detail.result) {
          leads[i].phone = detail.result.formatted_phone_number || null;
          leads[i].website = detail.result.website || null;
          // Parse city from formatted_address
          const parts = detail.result.formatted_address?.split(',');
          if (parts?.length >= 2) leads[i].city = parts[parts.length - 3]?.trim() || leads[i].city;
        }
      } catch (_) {}
    }

    const { data, error } = await supabase
      .from('leads')
      .upsert(leads, { onConflict: 'google_place_id', ignoreDuplicates: true })
      .select();

    if (error) throw error;

    return res.status(200).json({
      success: true,
      found: places.length,
      imported: data.length,
      search: { lat, lng, radius_meters, business_type, keyword },
    });
  } catch (err) {
    console.error('[geo-targeting]', err);
    return res.status(500).json({ error: err.message });
  }
}
