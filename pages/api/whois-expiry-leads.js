import { createRequestClient, createAdminClient } from '../../lib/supabase';
import { getAccessToken } from '../../lib/api-utils';

// Finds domains nearing expiry (indicates neglected operations/opportunity)
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const token = getAccessToken(req);
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const client = createRequestClient(token);
    const { data: { user }, error: authErr } = await client.auth.getUser();
    if (authErr || !user) return res.status(401).json({ error: 'Invalid token' });

    const { domains = [], max_days = 45 } = req.body || {};
    if (!Array.isArray(domains) || domains.length === 0) {
      return res.status(400).json({ error: 'domains array is required' });
    }

    const apiKey = process.env.WHOISXML_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'WHOISXML_API_KEY not configured' });

    const leads = [];

    for (const domain of domains.slice(0, 25)) {
      const params = new URLSearchParams({
        apiKey,
        domainName: domain,
        outputFormat: 'JSON',
      });

      const whoisRes = await fetch(`https://www.whoisxmlapi.com/whoisserver/WhoisService?${params.toString()}`);
      if (!whoisRes.ok) continue;

      const whoisData = await whoisRes.json();
      const expiryRaw = whoisData?.WhoisRecord?.expiresDate || whoisData?.WhoisRecord?.registryData?.expiresDate;
      if (!expiryRaw) continue;

      const expiresAt = new Date(expiryRaw);
      const daysLeft = Math.ceil((expiresAt.getTime() - Date.now()) / 86400000);
      if (daysLeft < 0 || daysLeft > max_days) continue;

      leads.push({
        owner_email: user.email,
        name: domain,
        website: `https://${domain}`,
        business_type: 'Domain owner',
        source: 'whois_expiry',
        status: 'new',
        ai_score: Math.min(96, 60 + Math.max(0, max_days - daysLeft)),
        ai_score_reason: 'Domain renewal risk can indicate need for urgent operational support',
        notes: `Domain expires in ${daysLeft} days (${expiresAt.toISOString().slice(0, 10)})`,
      });
    }

    if (!leads.length) return res.status(200).json({ success: true, found: 0, imported: 0 });

    const admin = createAdminClient();
    const { data: inserted, error } = await admin.from('leads').insert(leads).select();
    if (error) throw error;

    return res.status(200).json({ success: true, found: leads.length, imported: inserted.length });
  } catch (err) {
    console.error('[whois-expiry-leads]', err);
    return res.status(500).json({ error: err.message });
  }
}
