import { createRequestClient, createAdminClient } from "../../../lib/supabase";
import { getAccessToken } from "../../../lib/api-utils";

export default async function handler(req, res) {
  const token = getAccessToken(req);
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  const db = createRequestClient(token);
  const { data: { user }, error: authErr } = await db.auth.getUser();
  if (authErr || !user) return res.status(401).json({ error: "Invalid token" });

  const admin = createAdminClient();

  // GET /api/sequences
  if (req.method === "GET") {
    const { data, error } = await db
      .from("nurture_sequences")
      .select("*")
      .eq("owner_email", user.email)
      .order("created_at", { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ sequences: data || [] });
  }

  // POST /api/sequences — create sequence
  if (req.method === "POST") {
    const { name, description, channel } = req.body || {};

    if (!name || !channel || !["email", "sms", "whatsapp"].includes(channel)) {
      return res.status(400).json({ error: "name and valid channel (email/sms/whatsapp) are required" });
    }

    const { data, error } = await admin
      .from("nurture_sequences")
      .insert({
        owner_email: user.email,
        name,
        description: description || "",
        channel,
        is_active: true,
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ sequence: data });
  }

  // PATCH /api/sequences?id=uuid — update sequence
  if (req.method === "PATCH") {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: "id is required" });

    const { name, description, is_active } = req.body || {};
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (is_active !== undefined) updates.is_active = is_active;

    if (!Object.keys(updates).length) {
      return res.status(400).json({ error: "No fields to update" });
    }

    const { data, error } = await admin
      .from("nurture_sequences")
      .update(updates)
      .eq("id", id)
      .eq("owner_email", user.email)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: "Sequence not found" });
    return res.status(200).json({ sequence: data });
  }

  // DELETE /api/sequences?id=uuid
  if (req.method === "DELETE") {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: "id is required" });

    const { error } = await admin
      .from("nurture_sequences")
      .delete()
      .eq("id", id)
      .eq("owner_email", user.email);

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  res.status(405).json({ error: "Method not allowed" });
}
