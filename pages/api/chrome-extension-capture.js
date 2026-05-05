import { createRequestClient, createAdminClient } from '../../lib/supabase';
import { getAccessToken } from '../../lib/api-utils';

// Browser extension endpoint: one-click lead capture while browsing
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const token = getAccessToken(req);
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const requestClient = createRequestClient(token);
    const { data: { user }, error: userErr } = await requestClient.auth.getUser();
    if (userErr || !user) return res.status(401).json({ error: 'Invalid token' });

    const {
      name,
      email,
      phone,
      business_type,
      city,
      country,
      website,
      notes,
      page_title,
      page_url,
    } = req.body || {};

    if (!name && !website) {
      return res.status(400).json({ error: 'name or website is required' });
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from('leads')
      .insert({
        owner_email: user.email,
        name: name || page_title || 'Captured lead',
        email: email || null,
        phone: phone || null,
        business_type: business_type || null,
        city: city || null,
        country: country || null,
        website: website || page_url || null,
        source: 'chrome_extension',
        status: 'new',
        notes: notes || `Captured from browser on ${page_url || 'unknown page'}`,
      })
      .select()
      .single();

    if (error) throw error;
    return res.status(200).json({ success: true, lead: data });
  } catch (err) {
    console.error('[chrome-extension-capture]', err);
    return res.status(500).json({ error: err.message });
  }
}
