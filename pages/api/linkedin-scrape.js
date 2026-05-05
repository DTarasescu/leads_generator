import { createRequestClient, createAdminClient } from "../../lib/supabase";
import { getAccessToken } from "../../lib/api-utils";

// Hunter.io email finder API
// Requires HUNTER_API_KEY env var
// Hunter.io pricing: ~$50/month for 2000 searches/month

async function findEmailViaHunter(fullName, domain, companyName) {
  const hunterKey = process.env.HUNTER_API_KEY;
  if (!hunterKey) throw new Error("Hunter.io API key not configured");

  const firstName = fullName.split(" ")[0];
  const lastName = fullName.split(" ").slice(1).join(" ");

  // Hunter.io domain search
  const url = new URL("https://api.hunter.io/v2/email-finder");
  url.searchParams.set("domain", domain);
  url.searchParams.set("first_name", firstName);
  url.searchParams.set("last_name", lastName);
  url.searchParams.set("api_key", hunterKey);

  const r = await fetch(url);
  const data = await r.json();

  if (!data.data?.email) throw new Error("Email not found");
  return data.data.email;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const token = getAccessToken(req);
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  const db = createRequestClient(token);
  const { data: { user }, error: authErr } = await db.auth.getUser();
  if (authErr || !user) return res.status(401).json({ error: "Invalid token" });

  const { linkedinUrl, companyDomain } = req.body || {};
  if (!linkedinUrl || !companyDomain) {
    return res.status(400).json({ error: "linkedinUrl and companyDomain are required" });
  }

  try {
    // Parse LinkedIn URL to extract name
    // Format: https://www.linkedin.com/in/john-doe-abc123/
    const match = linkedinUrl.match(/\/in\/([^\/]+)/);
    if (!match) return res.status(400).json({ error: "Invalid LinkedIn URL" });

    const urlName = match[1].replace(/-\w{6,}$/, "").replace(/-/g, " ");
    const cleanDomain = companyDomain.replace("https://", "").replace("http://", "").split("/")[0];

    // Find email via Hunter.io
    const email = await findEmailViaHunter(urlName, cleanDomain, "");

    const admin = createAdminClient();

    // Check if lead already exists
    const { data: existing } = await db
      .from("leads")
      .select("id")
      .eq("email", email)
      .eq("owner_email", user.email)
      .single();

    if (existing) {
      return res.status(409).json({ error: "Lead already exists", leadId: existing.id });
    }

    // Create new lead
    const { data: lead, error } = await admin
      .from("leads")
      .insert({
        owner_email: user.email,
        name: urlName,
        email,
        business_type: "",
        city: "",
        source: "linkedin",
        status: "new",
      })
      .select()
      .single();

    if (error) throw error;

    return res.status(201).json({ lead });
  } catch (err) {
    console.error("[linkedin-scrape]", err.message);
    return res.status(500).json({ error: "Failed to extract lead: " + err.message });
  }
}
