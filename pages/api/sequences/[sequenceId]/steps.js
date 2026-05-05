import { createRequestClient, createAdminClient } from "../../../lib/supabase";
import { getAccessToken } from "../../../lib/api-utils";

export default async function handler(req, res) {
  const token = getAccessToken(req);
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  const db = createRequestClient(token);
  const { data: { user }, error: authErr } = await db.auth.getUser();
  if (authErr || !user) return res.status(401).json({ error: "Invalid token" });

  const { sequenceId } = req.query;
  if (!sequenceId) return res.status(400).json({ error: "sequenceId is required" });

  const admin = createAdminClient();

  // GET /api/sequences/[sequenceId]/steps
  if (req.method === "GET") {
    const { data, error } = await db
      .from("sequence_steps")
      .select("*")
      .eq("sequence_id", sequenceId)
      .order("step_number", { ascending: true });

    if (error) return res.status(500).json({ error: error.message });

    // Verify owner
    const { data: seq } = await db
      .from("nurture_sequences")
      .select("owner_email")
      .eq("id", sequenceId)
      .single();

    if (!seq || seq.owner_email !== user.email) {
      return res.status(403).json({ error: "Access denied" });
    }

    return res.status(200).json({ steps: data || [] });
  }

  // POST /api/sequences/[sequenceId]/steps — add step
  if (req.method === "POST") {
    const { step_number, delay_hours, template_type, template_id, custom_message } = req.body || {};

    if (step_number === undefined || !template_type || !["email", "sms", "whatsapp"].includes(template_type)) {
      return res.status(400).json({ error: "step_number and valid template_type are required" });
    }

    if (!template_id && !custom_message) {
      return res.status(400).json({ error: "Either template_id or custom_message is required" });
    }

    const { data, error } = await admin
      .from("sequence_steps")
      .insert({
        sequence_id: sequenceId,
        step_number,
        delay_hours: delay_hours || 24,
        template_type,
        template_id: template_id || null,
        custom_message: custom_message || null,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return res.status(409).json({ error: "Step number already exists in this sequence" });
      }
      return res.status(500).json({ error: error.message });
    }

    return res.status(201).json({ step: data });
  }

  // DELETE /api/sequences/[sequenceId]/steps?stepId=uuid
  if (req.method === "DELETE") {
    const { stepId } = req.query;
    if (!stepId) return res.status(400).json({ error: "stepId is required" });

    const { error } = await admin
      .from("sequence_steps")
      .delete()
      .eq("id", stepId)
      .eq("sequence_id", sequenceId);

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  res.status(405).json({ error: "Method not allowed" });
}
