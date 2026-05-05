import { createAdminClient } from '../../lib/supabase';
import crypto from 'crypto';

// Facebook Lead Ads webhook — receives lead form submissions from Facebook Ads
// Setup: Facebook Business Manager → Leads Access → Webhook → this endpoint
// Requires: FB_VERIFY_TOKEN, FB_APP_SECRET, FB_PAGE_ACCESS_TOKEN in env

export default async function handler(req, res) {
  // Webhook verification (Facebook GET challenge)
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === process.env.FB_VERIFY_TOKEN) {
      console.log('[fb-lead-ads] Webhook verified');
      return res.status(200).send(challenge);
    }
    return res.status(403).json({ error: 'Verification failed' });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // Verify Facebook signature
    const signature = req.headers['x-hub-signature-256'];
    if (process.env.FB_APP_SECRET && signature) {
      const rawBody = JSON.stringify(req.body);
      const expected = 'sha256=' + crypto
        .createHmac('sha256', process.env.FB_APP_SECRET)
        .update(rawBody)
        .digest('hex');

      if (signature !== expected) {
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }

    const supabase = createAdminClient();
    const { entry = [] } = req.body;

    let totalImported = 0;

    for (const event of entry) {
      for (const change of event.changes || []) {
        if (change.field !== 'leadgen') continue;

        const { leadgen_id, page_id, form_id } = change.value;

        // Fetch lead data from Facebook Graph API
        const fbRes = await fetch(
          `https://graph.facebook.com/v19.0/${leadgen_id}?access_token=${process.env.FB_PAGE_ACCESS_TOKEN}`
        );

        if (!fbRes.ok) continue;
        const leadData = await fbRes.json();

        // Parse field_data array into key-value map
        const fields = {};
        for (const field of leadData.field_data || []) {
          fields[field.name] = field.values?.[0] || '';
        }

        const email = fields['email'] || fields['EMAIL'] || null;
        if (!email) continue;

        await supabase.from('leads').upsert({
          name: fields['full_name'] || fields['first_name'] || 'Facebook Lead',
          email: email.toLowerCase(),
          phone: fields['phone_number'] || fields['phone'] || null,
          business_type: fields['business_type'] || 'Other',
          website: null,
          city: fields['city'] || null,
          state: fields['state'] || null,
          country: 'US',
          status: 'new',
          source: 'facebook_lead_ads',
          score: null,
          tags: [`fb-form-${form_id}`, `fb-page-${page_id}`, 'paid-lead'],
          created_at: new Date().toISOString(),
        }, { onConflict: 'email' });

        totalImported++;
      }
    }

    return res.status(200).json({ success: true, imported: totalImported });
  } catch (err) {
    console.error('[fb-lead-ads]', err);
    return res.status(500).json({ error: err.message });
  }
}
