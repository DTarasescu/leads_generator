import { createRequestClient, createAdminClient } from "../../lib/supabase";
import { getAccessToken } from "../../lib/api-utils";

export default async function handler(req, res) {
  const token = getAccessToken(req);
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  const db = createRequestClient(token);
  const { data: { user }, error: authErr } = await db.auth.getUser();
  if (authErr || !user) return res.status(401).json({ error: "Invalid token" });

  // GET /api/templates/email
  if (req.method === "GET") {
    const { data, error } = await db
      .from("email_templates")
      .select("*")
      .eq("owner_email", user.email)
      .order("created_at", { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ templates: data || [] });
  }

  // POST /api/templates/email — create new template
  if (req.method === "POST") {
    const { name, subject_line, body, variables, is_default } = req.body || {};

    if (!name || !subject_line || !body) {
      return res.status(400).json({ error: "name, subject_line, and body are required" });
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("email_templates")
      .insert({
        owner_email: user.email,
        name,
        subject_line,
        body,
        variables: variables || [],
        is_default: is_default || false,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return res.status(409).json({ error: "Template name already exists" });
      }
      return res.status(500).json({ error: error.message });
    }

    return res.status(201).json({ template: data });
  }

  // PATCH /api/templates/email?id=uuid — update template
  if (req.method === "PATCH") {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: "id is required" });

    const { name, subject_line, body, variables, is_default } = req.body || {};
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (subject_line !== undefined) updates.subject_line = subject_line;
    if (body !== undefined) updates.body = body;
    if (variables !== undefined) updates.variables = variables;
    if (is_default !== undefined) updates.is_default = is_default;

    if (!Object.keys(updates).length) {
      return res.status(400).json({ error: "No fields to update" });
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("email_templates")
      .update(updates)
      .eq("id", id)
      .eq("owner_email", user.email)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: "Template not found" });
    return res.status(200).json({ template: data });
  }

  // DELETE /api/templates/email?id=uuid
  if (req.method === "DELETE") {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: "id is required" });

    const admin = createAdminClient();
    const { error } = await admin
      .from("email_templates")
      .delete()
      .eq("id", id)
      .eq("owner_email", user.email);

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  res.status(405).json({ error: "Method not allowed" });
}
