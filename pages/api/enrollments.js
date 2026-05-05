import { createRequestClient, createAdminClient } from "../../lib/supabase";
import { getAccessToken } from "../../lib/api-utils";
import { API_BASE } from "../../lib/api-utils";

export default async function handler(req, res) {
  const token = getAccessToken(req);
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  const db = createRequestClient(token);
  const { data: { user }, error: authErr } = await db.auth.getUser();
  if (authErr || !user) return res.status(401).json({ error: "Invalid token" });

  const admin = createAdminClient();

  // GET /api/enrollments — list enrollments
  if (req.method === "GET") {
    const { leadId } = req.query;

    let query = db.from("lead_sequence_progress").select("*").eq("owner_email", user.email);
    if (leadId) query = query.eq("lead_id", leadId);

    const { data, error } = await query.order("started_at", { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ enrollments: data || [] });
  }

  // POST /api/enrollments — enroll lead in sequence
  if (req.method === "POST") {
    const { leadId, sequenceId } = req.body || {};
    if (!leadId || !sequenceId) {
      return res.status(400).json({ error: "leadId and sequenceId are required" });
    }

    // Check if already enrolled
    const { data: existing } = await db
      .from("lead_sequence_progress")
      .select("id")
      .eq("lead_id", leadId)
      .eq("sequence_id", sequenceId)
      .single();

    if (existing) {
      return res.status(409).json({ error: "Lead already enrolled in this sequence" });
    }

    const { data, error } = await admin
      .from("lead_sequence_progress")
      .insert({
        lead_id: leadId,
        sequence_id: sequenceId,
        owner_email: user.email,
        current_step: 0,
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ enrollment: data });
  }

  // PATCH /api/enrollments?enrollmentId=uuid — pause/resume/complete
  if (req.method === "PATCH") {
    const { enrollmentId } = req.query;
    if (!enrollmentId) return res.status(400).json({ error: "enrollmentId is required" });

    const { is_paused, is_completed } = req.body || {};
    const updates = {};
    if (is_paused !== undefined) updates.is_paused = is_paused;
    if (is_completed !== undefined) updates.is_completed = is_completed;

    if (!Object.keys(updates).length) {
      return res.status(400).json({ error: "No fields to update" });
    }

    const { data, error } = await admin
      .from("lead_sequence_progress")
      .update(updates)
      .eq("id", enrollmentId)
      .eq("owner_email", user.email)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: "Enrollment not found" });
    return res.status(200).json({ enrollment: data });
  }

  // DELETE /api/enrollments?enrollmentId=uuid
  if (req.method === "DELETE") {
    const { enrollmentId } = req.query;
    if (!enrollmentId) return res.status(400).json({ error: "enrollmentId is required" });

    const { error } = await admin
      .from("lead_sequence_progress")
      .delete()
      .eq("id", enrollmentId)
      .eq("owner_email", user.email);

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  res.status(405).json({ error: "Method not allowed" });
}
