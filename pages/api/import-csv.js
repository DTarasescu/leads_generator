import { createRequestClient } from '../../lib/supabase';
import { getAccessToken, isValidEmail } from '../../lib/api-utils';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const token = getAccessToken(req);
    const supabase = createRequestClient(token);
    
    const { csvData } = req.body; // Array of {name, email, phone, business_type, website, city, state, country}
    
    if (!Array.isArray(csvData) || csvData.length === 0) {
      return res.status(400).json({ error: 'csvData must be non-empty array' });
    }

    // Validate and deduplicate
    const seen = new Set();
    const leads = [];
    
    for (const row of csvData) {
      if (!isValidEmail(row.email)) continue;
      
      const key = `${row.email}|${row.business_type}`;
      if (seen.has(key)) continue;
      seen.add(key);

      leads.push({
        name: row.name || 'N/A',
        email: row.email.toLowerCase(),
        phone: row.phone || null,
        business_type: row.business_type || 'Other',
        website: row.website || null,
        city: row.city || null,
        state: row.state || null,
        country: row.country || 'US',
        status: 'new',
        source: 'csv_import',
        score: null,
        google_place_id: null,
        last_contacted_at: null,
        tags: ['imported'],
        created_at: new Date().toISOString(),
      });
    }

    // Insert with conflict handling (upsert on email)
    const { data, error } = await supabase
      .from('leads')
      .upsert(leads, { onConflict: 'email' })
      .select();

    if (error) throw error;

    return res.status(200).json({ 
      success: true, 
      imported: data.length,
      deduplicated: csvData.length - leads.length
    });
  } catch (err) {
    console.error('[import-csv]', err);
    return res.status(500).json({ error: err.message });
  }
}
