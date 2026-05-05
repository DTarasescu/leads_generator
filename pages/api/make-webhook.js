import { createAdminClient } from '../../lib/supabase';

// Make.com custom webhook target for inbound leads
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const secret = req.headers['x-make-secret'];
    if (process.env.MAKE_WEBHOOK_SECRET && secret !== process.env.MAKE_WEBHOOK_SECRET) {
      return res.status(401).json({ error: 'Invalid secret' });
    }

    const payload = req.body || {};
    const ownerEmail = payload.owner_email || payload.ownerEmail;

    if (!ownerEmail || !payload.name) {
      return res.status(400).json({ error: 'owner_email and name are required' });
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from('leads')
      .insert({
        owner_email: ownerEmail,
        name: payload.name,
        email: payload.email || null,
        phone: payload.phone || null,
        business_type: payload.business_type || payload.businessType || null,
        city: payload.city || null,
        country: payload.country || null,
        website: payload.website || null,
        source: payload.source || 'make',
        status: 'new',
        notes: payload.notes || 'Captured via Make.com webhook',
      })
      .select()
      .single();

    if (error) throw error;
    return res.status(200).json({ success: true, lead: data });
  } catch (err) {
    console.error('[make-webhook]', err);
    return res.status(500).json({ error: err.message });
  }
}
