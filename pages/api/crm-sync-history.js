import { createRequestClient } from "../../lib/supabase";
import { getAccessToken } from "../../lib/api-utils";

// Get CRM sync history
export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const token = getAccessToken(req);
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  const db = createRequestClient(token);
  const { data: { user }, error: authErr } = await db.auth.getUser();
  if (authErr || !user) return res.status(401).json({ error: "Invalid token" });

  const { crm_type, limit = 20 } = req.query;

  try {
    // Get CRM config
    let query = db
      .from("crm_sync_history")
      .select("*")
      .eq("owner_email", user.email)
      .order("synced_at", { ascending: false })
      .limit(parseInt(limit));

    if (crm_type) {
      const { data: config } = await db
        .from("crm_integrations")
        .select("id")
        .eq("owner_email", user.email)
        .eq("crm_type", crm_type)
        .single();

      if (config) {
        query = query.eq("crm_integration_id", config.id);
      }
    }

    const { data, error } = await query;

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ history: data || [] });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
