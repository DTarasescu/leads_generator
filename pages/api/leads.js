import { createRequestClient, createAdminClient } from "../../lib/supabase";
import { getAccessToken, isValidUuid } from "../../lib/api-utils";

export default async function handler(req, res) {
  const token = getAccessToken(req);
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  const db = createRequestClient(token);
  const { data: { user }, error: authErr } = await db.auth.getUser();
  if (authErr || !user) return res.status(401).json({ error: "Invalid token" });

  const ownerEmail = user.email;

  // ── GET — list leads ──────────────────────────────────────────────────────
  if (req.method === "GET") {
    const { status, source, search, page = "1", limit = "20" } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const from = (pageNum - 1) * pageSize;

    let q = db
      .from("leads")
      .select("*", { count: "exact" })
      .eq("owner_email", ownerEmail)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .range(from, from + pageSize - 1);

    if (status) q = q.eq("status", status);
    if (source) q = q.eq("source", source);
    if (search) {
      const s = `%${search}%`;
      q = q.or(`name.ilike.${s},email.ilike.${s},business_type.ilike.${s},city.ilike.${s}`);
    }

    const { data, error, count } = await q;
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ leads: data, total: count, page: pageNum, limit: pageSize });
  }

  // ── POST — create lead ────────────────────────────────────────────────────
  if (req.method === "POST") {
    const {
      name, email, phone, business_type, city, country, website,
      google_place_id, google_rating, google_review_count,
      ai_score, ai_score_reason, source = "manual",
    } = req.body || {};

    if (!name || String(name).trim().length < 2) {
      return res.status(400).json({ error: "name is required (min 2 chars)" });
    }

    // Duplicate guard for discovered leads
    if (google_place_id) {
      const { data: existing } = await db
        .from("leads")
        .select("id")
        .eq("owner_email", ownerEmail)
        .eq("google_place_id", google_place_id)
        .maybeSingle();
      if (existing) return res.status(409).json({ error: "Lead already in your pipeline" });
    }

    const admin = createAdminClient();
    const { data, error } = await admin.from("leads").insert({
      owner_email: ownerEmail,
      name: String(name).trim(),
      email: email || null,
      phone: phone || null,
      business_type: business_type || null,
      city: city || null,
      country: country || null,
      website: website || null,
      google_place_id: google_place_id || null,
      google_rating: google_rating || null,
      google_review_count: google_review_count || null,
      ai_score: ai_score || null,
      ai_score_reason: ai_score_reason || null,
      source,
      status: "new",
    }).select().single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ lead: data });
  }

  res.status(405).json({ error: "Method not allowed" });
}
