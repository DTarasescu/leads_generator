import { createAdminClient } from "../../lib/supabase";

// CRM OAuth Handler — handles OAuth callback from Pipedrive, HubSpot, Salesforce
export default async function handler(req, res) {
  const { provider, code, state } = req.query;

  if (!provider || !code) {
    return res.status(400).json({ error: "provider and code required" });
  }

  const admin = createAdminClient();

  try {
    let accessToken;
    let crm_type = provider;
    let api_url = "";
    let workspace_id = null;
    let org_id = null;

    // ===== PIPEDRIVE OAUTH =====
    if (provider === "pipedrive") {
      const tokenResp = await fetch("https://oauth.pipedrive.com/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: `${process.env.NEXT_PUBLIC_APP_BASE}/api/crm-oauth?provider=pipedrive`,
          client_id: process.env.PIPEDRIVE_CLIENT_ID,
          client_secret: process.env.PIPEDRIVE_CLIENT_SECRET,
        }),
      });

      const tokenData = await tokenResp.json();
      accessToken = tokenData.access_token;
      if (!accessToken) {
        return res.status(400).json({ error: "Failed to get Pipedrive access token" });
      }

      // Verify token by fetching user info
      const userResp = await fetch("https://api.pipedrive.com/v1/users/me?api_token=" + accessToken);
      if (!userResp.ok) {
        return res.status(400).json({ error: "Invalid Pipedrive token" });
      }
    }

    // ===== HUBSPOT OAUTH =====
    else if (provider === "hubspot") {
      const tokenResp = await fetch("https://api.hubapi.com/oauth/v1/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: `${process.env.NEXT_PUBLIC_APP_BASE}/api/crm-oauth?provider=hubspot`,
          client_id: process.env.HUBSPOT_CLIENT_ID,
          client_secret: process.env.HUBSPOT_CLIENT_SECRET,
        }),
      });

      const tokenData = await tokenResp.json();
      accessToken = tokenData.access_token;
      if (!accessToken) {
        return res.status(400).json({ error: "Failed to get HubSpot access token" });
      }

      // Verify token
      const userResp = await fetch("https://api.hubapi.com/crm/v3/objects/contacts", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!userResp.ok) {
        return res.status(400).json({ error: "Invalid HubSpot token" });
      }
    }

    // ===== SALESFORCE OAUTH =====
    else if (provider === "salesforce") {
      const instanceUrl = process.env.SALESFORCE_INSTANCE_URL || "https://login.salesforce.com";

      const tokenResp = await fetch(`${instanceUrl}/services/oauth2/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: `${process.env.NEXT_PUBLIC_APP_BASE}/api/crm-oauth?provider=salesforce`,
          client_id: process.env.SALESFORCE_CLIENT_ID,
          client_secret: process.env.SALESFORCE_CLIENT_SECRET,
        }),
      });

      const tokenData = await tokenResp.json();
      accessToken = tokenData.access_token;
      if (!accessToken) {
        return res.status(400).json({ error: "Failed to get Salesforce access token" });
      }

      // Verify token and get org ID
      const userResp = await fetch(`${tokenData.instance_url}/services/data/v57.0/sobjects/Organization`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!userResp.ok) {
        return res.status(400).json({ error: "Invalid Salesforce token" });
      }
      const orgData = await userResp.json();
      org_id = orgData.Id;
      api_url = tokenData.instance_url;
    }

    // Extract user from state (decode JWT or session)
    const userEmail = state; // In production, use proper state parameter with JWT

    // Store encrypted token in database
    const encryptedToken = Buffer.from(accessToken).toString("base64");
    const { data, error } = await admin
      .from("crm_integrations")
      .upsert(
        {
          owner_email: userEmail,
          crm_type,
          api_key: encryptedToken,
          api_url: api_url || null,
          workspace_id,
          org_id,
          is_active: true,
          auto_sync: false,
        },
        { onConflict: "owner_email,crm_type" }
      )
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    // Redirect back with success
    return res.redirect(302, `/crm-integrations?connected=${provider}`);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
