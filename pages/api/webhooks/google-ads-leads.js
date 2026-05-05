import { createAdminClient } from '../../lib/supabase';
import crypto from 'crypto';

// Google Ads Lead Form Extension webhook
// Setup: Google Ads → Extensions → Lead Form → Webhook URL → this endpoint
// Requires: GOOGLE_ADS_WEBHOOK_KEY in env

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // Verify Google Ads webhook key
    const googleKey = req.headers['google-ads-webhook-key'];
    if (process.env.GOOGLE_ADS_WEBHOOK_KEY && googleKey !== process.env.GOOGLE_ADS_WEBHOOK_KEY) {
      return res.status(401).json({ error: 'Invalid webhook key' });
    }

    const supabase = createAdminClient();
    const payload = req.body;

    // Google Ads Lead Form payload structure
    const {
      google_key,
      lead_id,
      user_column_data = [],
      campaign_id,
      adgroup_id,
      creative_id,
      api_version,
    } = payload;

    // Parse user_column_data into field map
    const fields = {};
    for (const col of user_column_data) {
      fields[col.column_name] = col.string_value || '';
    }

    const email = fields['EMAIL'] || fields['email'] || null;
    const phone = fields['PHONE_NUMBER'] || fields['phone'] || null;

    if (!email && !phone) {
      return res.status(200).json({ success: true, message: 'No email/phone, skipped' });
    }

    await supabase.from('leads').upsert({
      name: [fields['FULL_NAME'], fields['first_name'], 'Google Ads Lead'].find(Boolean),
      email: email?.toLowerCase() || null,
      phone: phone || null,
      business_type: fields['BUSINESS_NAME'] || 'Other',
      website: null,
      city: fields['CITY'] || null,
      state: fields['PROVINCE'] || fields['STATE'] || null,
      country: fields['COUNTRY'] || 'US',
      status: 'new',
      source: 'google_ads',
      score: 75, // Paid Google Ads leads are high-intent
      tags: [`campaign-${campaign_id}`, `adgroup-${adgroup_id}`, 'paid-lead', 'google-ads'],
      created_at: new Date().toISOString(),
    }, { onConflict: 'email' });

    return res.status(200).json({ success: true, lead_id });
  } catch (err) {
    console.error('[google-ads-leads]', err);
    return res.status(500).json({ error: err.message });
  }
}
