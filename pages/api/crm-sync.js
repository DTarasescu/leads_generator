import { createRequestClient, createAdminClient } from "../../lib/supabase";
import { getAccessToken } from "../../lib/api-utils";

// Sync lead to Pipedrive (create or update deal)
async function syncToPipedrive(lead, apiKey, ownerEmail) {
  const decrypted = Buffer.from(apiKey, "base64").toString("utf-8");

  // Check if deal already exists
  const searchUrl = `https://api.pipedrive.com/v1/deals/search?term=${encodeURIComponent(lead.email)}&api_token=${decrypted}`;
  let existingDealId = null;

  try {
    const r = await fetch(searchUrl);
    const data = await r.json();
    if (data.success && data.data?.items?.length > 0) {
      existingDealId = data.data.items[0].id;
    }
  } catch {}

  // Create or update deal
  const dealData = {
    title: `${lead.name} - ${lead.business_type}`,
    person_id: { name: lead.name, email: lead.email, phone: lead.phone },
    custom_fields: {
      city: lead.city || "",
      country: lead.country || "",
      status_value: lead.status,
      ai_score: lead.ai_score || 0,
    },
  };

  const url = existingDealId
    ? `https://api.pipedrive.com/v1/deals/${existingDealId}?api_token=${decrypted}`
    : `https://api.pipedrive.com/v1/deals?api_token=${decrypted}`;

  const method = existingDealId ? "PUT" : "POST";

  const r = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dealData),
  });

  const result = await r.json();
  if (!result.success) throw new Error(result.error || "Pipedrive sync failed");
  return result.data.id;
}

// Sync lead to HubSpot (create or update contact)
async function syncToHubSpot(lead, apiKey, workspaceId) {
  const headers = { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };

  // Create or update contact by email
  const contactData = {
    properties: {
      firstname: lead.name.split(" ")[0] || lead.name,
      lastname: lead.name.split(" ").slice(1).join(" ") || "",
      email: lead.email,
      phone: lead.phone || "",
      city: lead.city || "",
      country: lead.country || "",
      lifecyclestage: lead.status === "converted" ? "customer" : "lead",
      hs_lead_status: lead.status,
    },
  };

  const r = await fetch(
    `https://api.hubapi.com/crm/v3/objects/contacts?idProperty=email`,
    {
      method: "POST",
      headers,
      body: JSON.stringify(contactData),
    }
  );

  const result = await r.json();
  if (!r.ok) throw new Error(result.message || "HubSpot sync failed");
  return result.id;
}

// Sync lead to Salesforce (create or update contact)
async function syncToSalesforce(lead, apiKey, orgId) {
  // Salesforce requires OAuth token refresh, simplified version
  const headers = { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };

  const contactData = {
    FirstName: lead.name.split(" ")[0] || lead.name,
    LastName: lead.name.split(" ").slice(1).join(" ") || "Lead",
    Email: lead.email,
    Phone: lead.phone || "",
    BillingCity: lead.city || "",
    BillingCountry: lead.country || "",
  };

  const r = await fetch(
    `https://${orgId}.salesforce.com/services/data/v57.0/sobjects/Contact`,
    {
      method: "POST",
      headers,
      body: JSON.stringify(contactData),
    }
  );

  const result = await r.json();
  if (!r.ok) throw new Error(result.error || "Salesforce sync failed");
  return result.id;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const token = getAccessToken(req);
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  const db = createRequestClient(token);
  const { data: { user }, error: authErr } = await db.auth.getUser();
  if (authErr || !user) return res.status(401).json({ error: "Invalid token" });

  const { leadId, crmId } = req.body || {};
  if (!leadId || !crmId) {
    return res.status(400).json({ error: "leadId and crmId are required" });
  }

  const admin = createAdminClient();

  try {
    // Fetch lead
    const { data: lead } = await db
      .from("leads")
      .select("*")
      .eq("id", leadId)
      .eq("owner_email", user.email)
      .single();

    if (!lead) return res.status(404).json({ error: "Lead not found" });

    // Fetch CRM config
    const { data: crm } = await db
      .from("crm_integrations")
      .select("*")
      .eq("id", crmId)
      .eq("owner_email", user.email)
      .single();

    if (!crm) return res.status(404).json({ error: "CRM integration not found" });

    let externalId;

    // Sync based on CRM type
    if (crm.crm_type === "pipedrive") {
      externalId = await syncToPipedrive(lead, crm.api_key, user.email);
    } else if (crm.crm_type === "hubspot") {
      externalId = await syncToHubSpot(lead, crm.api_key, crm.workspace_id);
    } else if (crm.crm_type === "salesforce") {
      externalId = await syncToSalesforce(lead, crm.api_key, crm.org_id);
    }

    // Record sync status
    await admin
      .from("lead_crm_sync_status")
      .upsert(
        {
          lead_id: leadId,
          crm_integration_id: crmId,
          external_id: externalId,
          sync_status: "synced",
          last_sync_at: new Date().toISOString(),
        },
        { onConflict: "lead_id,crm_integration_id" }
      );

    // Update CRM config last_synced_at
    await admin
      .from("crm_integrations")
      .update({ last_synced_at: new Date().toISOString() })
      .eq("id", crmId);

    return res.status(200).json({ success: true, externalId });
  } catch (err) {
    console.error("[crm-sync]", err.message);

    // Record sync failure
    const { data: existing } = await admin
      .from("lead_crm_sync_status")
      .select("id")
      .eq("lead_id", leadId)
      .eq("crm_integration_id", crmId)
      .single();

    if (existing) {
      await admin
        .from("lead_crm_sync_status")
        .update({
          sync_status: "failed",
          sync_error_message: err.message.slice(0, 500),
        })
        .eq("id", existing.id);
    }

    return res.status(500).json({ error: "CRM sync failed: " + err.message });
  }
}
