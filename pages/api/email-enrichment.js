import { createRequestClient } from '../../lib/supabase';
import { getAccessToken, isValidEmail } from '../../lib/api-utils';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const token = getAccessToken(req);
    const supabase = createRequestClient(token);
    
    const { emails } = req.body;

    if (!Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({ error: 'emails array required' });
    }

    // Validate emails
    const validEmails = emails.filter(isValidEmail);
    if (validEmails.length === 0) {
      return res.status(400).json({ error: 'No valid emails provided' });
    }

    // Enrich using Hunter.io email verification + data API
    const enrichedData = [];

    for (const email of validEmails) {
      try {
        // Hunter.io Email Verifier API
        const verifyRes = await fetch(`https://api.hunter.io/v2/email-verifier?email=${email}`, {
          headers: { 'User-Agent': 'leads-generator' }
        });

        const verifyData = await verifyRes.json();

        if (verifyData.data) {
          enrichedData.push({
            email: email.toLowerCase(),
            status: verifyData.data.status, // 'valid', 'invalid', 'accept_all'
            first_name: verifyData.data.first_name,
            last_name: verifyData.data.last_name,
            domain: verifyData.data.domain,
            company: verifyData.data.organization,
            position: verifyData.data.position,
            seniority: verifyData.data.seniority,
            score: verifyData.data.score * 100, // Convert to 0-100 scale
            sources: verifyData.data.sources || [],
          });
        }
      } catch (e) {
        console.log(`[email-enrichment] Error enriching ${email}:`, e.message);
      }
    }

    // Convert enriched data to leads
    const leads = enrichedData
      .filter(d => d.status === 'valid') // Only import valid emails
      .map(d => ({
        name: (d.first_name && d.last_name) ? `${d.first_name} ${d.last_name}` : d.first_name || 'Unknown',
        email: d.email,
        phone: null,
        business_type: 'Technology',
        website: d.domain ? `https://${d.domain}` : null,
        city: null,
        state: null,
        country: 'US',
        status: 'new',
        source: 'email_enrichment',
        score: d.score,
        google_place_id: null,
        tags: [d.company || 'unknown-company', d.position || 'unknown-role', `seniority-${d.seniority || 'unknown'}`],
        created_at: new Date().toISOString(),
      }));

    if (leads.length === 0) {
      return res.status(200).json({ 
        success: true, 
        enriched: enrichedData.length,
        imported: 0,
        message: 'No valid leads found'
      });
    }

    // Upsert to database
    const { data, error } = await supabase
      .from('leads')
      .upsert(leads, { onConflict: 'email' })
      .select();

    if (error) throw error;

    return res.status(200).json({ 
      success: true, 
      enriched: enrichedData.length,
      valid_leads: leads.length,
      imported: data.length
    });
  } catch (err) {
    console.error('[email-enrichment]', err);
    return res.status(500).json({ error: err.message });
  }
}
