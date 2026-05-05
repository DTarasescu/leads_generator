import { createRequestClient } from '../../lib/supabase';
import { getAccessToken, isValidEmail } from '../../lib/api-utils';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const token = getAccessToken(req);
    const supabase = createRequestClient(token);
    
    const { domain, company_name, country = 'US' } = req.body;

    if (!domain || !company_name) {
      return res.status(400).json({ error: 'domain and company_name required' });
    }

    // Call Hunter.io Domain Search API to get all emails for a domain
    const hunterRes = await fetch(`https://api.hunter.io/v2/domain-search?domain=${domain}&limit=100`, {
      headers: { 'User-Agent': 'leads-generator' },
    });

    const hunterData = await hunterRes.json();

    if (!hunterData.data?.emails) {
      return res.status(200).json({ success: true, found: 0, leads: [] });
    }

    // Transform to leads
    const leads = hunterData.data.emails
      .filter(e => e.confidence > 0.7) // High confidence emails only
      .slice(0, 50) // Max 50 per domain
      .map(e => ({
        name: e.first_name && e.last_name ? `${e.first_name} ${e.last_name}` : `${e.first_name || 'Unknown'}`,
        email: e.value,
        phone: null,
        business_type: 'Technology', // Inferred from domain search context
        website: `https://${domain}`,
        city: null,
        state: null,
        country,
        status: 'new',
        source: 'domain_enrichment',
        score: null,
        google_place_id: null,
        tags: [company_name, 'domain-enriched'],
        created_at: new Date().toISOString(),
      }));

    if (leads.length === 0) {
      return res.status(200).json({ success: true, found: 0, leads: [] });
    }

    // Upsert to database
    const { data, error } = await supabase
      .from('leads')
      .upsert(leads, { onConflict: 'email' })
      .select();

    if (error) throw error;

    return res.status(200).json({ 
      success: true, 
      found: hunterData.data.emails.length,
      imported: data.length
    });
  } catch (err) {
    console.error('[enrich-domain]', err);
    return res.status(500).json({ error: err.message });
  }
}
