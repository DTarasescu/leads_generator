import { createRequestClient, createAdminClient } from '../../lib/supabase';
import { getAccessToken } from '../../lib/api-utils';

// Funding-based lead discovery from Crunchbase
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const token = getAccessToken(req);
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const client = createRequestClient(token);
    const { data: { user }, error: authErr } = await client.auth.getUser();
    if (authErr || !user) return res.status(401).json({ error: 'Invalid token' });

    const {
      limit = 20,
      min_funding_usd = 1000000,
    } = req.body || {};

    const apiKey = process.env.CRUNCHBASE_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'CRUNCHBASE_API_KEY not configured' });

    const payload = {
      field_ids: ['identifier', 'website_url', 'location_identifiers', 'short_description', 'last_funding_total_usd'],
      query: [
        {
          type: 'predicate',
          field_id: 'last_funding_total_usd',
          operator_id: 'gte',
          values: [min_funding_usd],
        },
      ],
      limit: Math.min(50, Math.max(1, limit)),
    };

    const cbRes = await fetch('https://api.crunchbase.com/api/v4/searches/organizations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-cb-user-key': apiKey,
      },
      body: JSON.stringify(payload),
    });

    if (!cbRes.ok) {
      const detail = await cbRes.text();
      return res.status(502).json({ error: 'Crunchbase API error', detail });
    }

    const cbData = await cbRes.json();
    const entities = cbData.entities || [];

    const leads = entities.map((item) => {
      const p = item.properties || {};
      const location = Array.isArray(p.location_identifiers) && p.location_identifiers[0]?.value;
      return {
        owner_email: user.email,
        name: p.identifier?.value || 'Funded company',
        business_type: 'Startup',
        website: p.website_url || null,
        city: location || null,
        country: null,
        source: 'crunchbase_funding',
        status: 'new',
        ai_score: 84,
        ai_score_reason: 'Recent funding event suggests buying power',
        notes: `Total funding: $${p.last_funding_total_usd || 0}`,
      };
    });

    if (!leads.length) return res.status(200).json({ success: true, found: 0, imported: 0 });

    const admin = createAdminClient();
    const { data: inserted, error } = await admin.from('leads').insert(leads).select();
    if (error) throw error;

    return res.status(200).json({ success: true, found: leads.length, imported: inserted.length });
  } catch (err) {
    console.error('[crunchbase-funding]', err);
    return res.status(500).json({ error: err.message });
  }
}
