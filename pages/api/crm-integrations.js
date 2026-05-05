import { createRequestClient, createAdminClient } from "../../lib/supabase";
import { getAccessToken } from "../../lib/api-utils";

export default async function handler(req, res) {
  const token = getAccessToken(req);
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  const db = createRequestClient(token);
  const { data: { user }, error: authErr } = await db.auth.getUser();
  if (authErr || !user) return res.status(401).json({ error: "Invalid token" });

  const admin = createAdminClient();

  // GET /api/crm-integrations
  if (req.method === "GET") {
    const { data, error } = await db
      .from("crm_integrations")
      .select("id, crm_type, workspace_id, org_id, is_active, auto_sync, last_synced_at")
      .eq("owner_email", user.email);

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ integrations: data || [] });
  }

  // POST /api/crm-integrations — configure CRM
  if (req.method === "POST") {
    const { crm_type, api_key, api_url, workspace_id, org_id, auto_sync } = req.body || {};

    if (!crm_type || !["pipedrive", "hubspot", "salesforce"].includes(crm_type)) {
      return res.status(400).json({ error: "Valid crm_type is required" });
    }

    if (!api_key) return res.status(400).json({ error: "api_key is required" });

    // Encrypt API key before storing (in production, use proper encryption)
    const encryptedKey = Buffer.from(api_key).toString("base64");

    const { data, error } = await admin
      .from("crm_integrations")
      .upsert(
        {
          owner_email: user.email,
          crm_type,
          api_key: encryptedKey,
          api_url: api_url || "",
          workspace_id: workspace_id || null,
          org_id: org_id || null,
          is_active: true,
          auto_sync: auto_sync || false,
        },
        { onConflict: "owner_email,crm_type" }
      )
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ integration: data });
  }

  // PATCH /api/crm-integrations?id=uuid — update integration
  if (req.method === "PATCH") {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: "id is required" });

    const { is_active, auto_sync, api_key } = req.body || {};
    const updates = {};
    if (is_active !== undefined) updates.is_active = is_active;
    if (auto_sync !== undefined) updates.auto_sync = auto_sync;
    if (api_key) updates.api_key = Buffer.from(api_key).toString("base64");

    if (!Object.keys(updates).length) {
      return res.status(400).json({ error: "No fields to update" });
    }

    const { data, error } = await admin
      .from("crm_integrations")
      .update(updates)
      .eq("id", id)
      .eq("owner_email", user.email)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: "Integration not found" });
    return res.status(200).json({ integration: data });
  }

  // DELETE /api/crm-integrations?id=uuid
  if (req.method === "DELETE") {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: "id is required" });

    const { error } = await admin
      .from("crm_integrations")
      .delete()
      .eq("id", id)
      .eq("owner_email", user.email);

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  res.status(405).json({ error: "Method not allowed" });
}
