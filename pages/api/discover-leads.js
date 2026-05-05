import { createRequestClient } from "../../lib/supabase";
import { getAccessToken } from "../../lib/api-utils";

// In-memory rate limiter: max 3 searches per user per minute
const rateLimitMap = new Map();

function checkRateLimit(email) {
  const now = Date.now();
  const entry = rateLimitMap.get(email) || { count: 0, reset: now + 60000 };
  if (now > entry.reset) { entry.count = 0; entry.reset = now + 60000; }
  entry.count++;
  rateLimitMap.set(email, entry);
  return entry.count <= 3;
}

async function fetchPlaceDetails(placeId, apiKey) {
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=formatted_phone_number,website&key=${apiKey}`;
  try {
    const r = await fetch(url);
    const json = await r.json();
    return json.result || {};
  } catch {
    return {};
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const token = getAccessToken(req);
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  const db = createRequestClient(token);
  const { data: { user }, error: authErr } = await db.auth.getUser();
  if (authErr || !user) return res.status(401).json({ error: "Invalid token" });

  if (!checkRateLimit(user.email)) {
    return res.status(429).json({ error: "Rate limit: max 3 searches per minute" });
  }

  const { businessType, city, country, radius = 10000 } = req.body || {};
  if (!businessType || !city) {
    return res.status(400).json({ error: "businessType and city are required" });
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "Google Places API not configured" });

  const radiusM = Math.min(50000, Math.max(500, Number(radius) || 10000));
  const query = encodeURIComponent(`${businessType} in ${city}${country ? " " + country : ""}`);
  const textSearchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${query}&radius=${radiusM}&key=${apiKey}`;

  let places;
  try {
    const r = await fetch(textSearchUrl);
    const json = await r.json();
    if (json.status !== "OK" && json.status !== "ZERO_RESULTS") {
      return res.status(502).json({ error: `Google API error: ${json.status}` });
    }
    places = (json.results || []).slice(0, 20);
  } catch (err) {
    return res.status(502).json({ error: "Failed to reach Google Places API" });
  }

  // Enrich with phone + website via Place Details (parallel)
  const leads = await Promise.all(
    places.map(async (p) => {
      const details = await fetchPlaceDetails(p.place_id, apiKey);
      const addressParts = (p.formatted_address || "").split(",");
      return {
        business_name: p.name,
        address: p.formatted_address || "",
        city: addressParts[1]?.trim() || city,
        country: country || "",
        phone: details.formatted_phone_number || "",
        website: details.website || "",
        google_place_id: p.place_id,
        google_rating: p.rating || null,
        google_review_count: p.user_ratings_total || 0,
        business_type: businessType,
      };
    })
  );

  return res.status(200).json({ leads });
}
