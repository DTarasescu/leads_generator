import { createRequestClient, createAdminClient } from "../../../lib/supabase";
import { getAccessToken, isValidUuid } from "../../../lib/api-utils";

const VALID_STATUSES = ["new", "contacted", "qualified", "converted", "rejected"];

export default async function handler(req, res) {
  const { id } = req.query;
  if (!isValidUuid(id)) return res.status(400).json({ error: "Invalid lead id" });

  const token = getAccessToken(req);
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  const db = createRequestClient(token);
  const { data: { user }, error: authErr } = await db.auth.getUser();
  if (authErr || !user) return res.status(401).json({ error: "Invalid token" });

  const ownerEmail = user.email;

  // ── GET single lead ───────────────────────────────────────────────────────
  if (req.method === "GET") {
    const { data, error } = await db
      .from("leads")
      .select("*")
      .eq("id", id)
      .eq("owner_email", ownerEmail)
      .is("deleted_at", null)
      .single();
    if (error || !data) return res.status(404).json({ error: "Lead not found" });
    return res.status(200).json({ lead: data });
  }

  // ── PATCH — update status or outreach_message ─────────────────────────────
  if (req.method === "PATCH") {
    const { status, outreach_message, last_contacted_at } = req.body || {};
    const updates = {};

    if (status !== undefined) {
      if (!VALID_STATUSES.includes(status)) {
        return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(", ")}` });
      }
      updates.status = status;
    }
    if (outreach_message !== undefined) updates.outreach_message = outreach_message;
    if (last_contacted_at !== undefined) updates.last_contacted_at = last_contacted_at;

    if (!Object.keys(updates).length) {
      return res.status(400).json({ error: "Nothing to update" });
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("leads")
      .update(updates)
      .eq("id", id)
      .eq("owner_email", ownerEmail)
      .is("deleted_at", null)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: "Lead not found" });
    return res.status(200).json({ lead: data });
  }

  // ── DELETE — soft delete ──────────────────────────────────────────────────
  if (req.method === "DELETE") {
    const admin = createAdminClient();
    const { error } = await admin
      .from("leads")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .eq("owner_email", ownerEmail);

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  res.status(405).json({ error: "Method not allowed" });
}
