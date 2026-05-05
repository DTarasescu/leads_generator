import { createAdminClient } from '../../lib/supabase';

// Zapier Catch Hook target for inbound leads
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const secret = req.headers['x-zapier-secret'];
    if (process.env.ZAPIER_WEBHOOK_SECRET && secret !== process.env.ZAPIER_WEBHOOK_SECRET) {
      return res.status(401).json({ error: 'Invalid secret' });
    }

    const {
      owner_email,
      name,
      email,
      phone,
      business_type,
      city,
      country,
      website,
      notes,
      source = 'zapier',
    } = req.body || {};

    if (!owner_email || !name) {
      return res.status(400).json({ error: 'owner_email and name are required' });
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from('leads')
      .insert({
        owner_email,
        name,
        email: email || null,
        phone: phone || null,
        business_type: business_type || null,
        city: city || null,
        country: country || null,
        website: website || null,
        source,
        status: 'new',
        notes: notes || 'Captured via Zapier webhook',
      })
      .select()
      .single();

    if (error) throw error;
    return res.status(200).json({ success: true, lead: data });
  } catch (err) {
    console.error('[zapier-webhook]', err);
    return res.status(500).json({ error: err.message });
  }
}
