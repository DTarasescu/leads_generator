import { createAdminClient } from '../../lib/supabase';
import crypto from 'crypto';

// Calendly webhook — every meeting booked becomes a high-intent lead
// Setup: Calendly → Integrations → Webhooks → Subscribe: invitee.created
// Requires: CALENDLY_WEBHOOK_SECRET in env

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // Verify Calendly webhook signature
    const signature = req.headers['calendly-webhook-signature'];
    if (process.env.CALENDLY_WEBHOOK_SECRET && signature) {
      const tolerance = 5 * 60 * 1000; // 5 minutes
      const [tPart, v1Part] = signature.split(',');
      const timestamp = tPart?.split('=')[1];
      const receivedSig = v1Part?.split('=')[1];

      if (Date.now() - Number(timestamp) * 1000 > tolerance) {
        return res.status(401).json({ error: 'Webhook timestamp too old' });
      }

      const payload = `${timestamp}.${JSON.stringify(req.body)}`;
      const expected = crypto
        .createHmac('sha256', process.env.CALENDLY_WEBHOOK_SECRET)
        .update(payload)
        .digest('hex');

      if (receivedSig !== expected) {
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }

    const supabase = createAdminClient();
    const { event, payload } = req.body;

    // Only process new bookings
    if (event !== 'invitee.created') {
      return res.status(200).json({ success: true, message: `Event "${event}" ignored` });
    }

    const invitee = payload?.invitee || {};
    const questions = payload?.questions_and_answers || [];

    // Extract answers from Calendly intake form
    const answers = {};
    for (const qa of questions) {
      const key = qa.question?.toLowerCase().replace(/\s+/g, '_');
      answers[key] = qa.answer;
    }

    const email = invitee.email;
    if (!email) return res.status(200).json({ success: true, message: 'No email, skipped' });

    await supabase.from('leads').upsert({
      name: invitee.name || 'Calendly Booking',
      email: email.toLowerCase(),
      phone: answers['phone'] || answers['phone_number'] || null,
      business_type: answers['business_type'] || answers['company_type'] || 'Other',
      website: answers['website'] || answers['company_website'] || null,
      city: null,
      state: null,
      country: 'US',
      status: 'contacted', // Already booked a meeting — they're warm
      source: 'calendly',
      score: 85, // Meeting-booked leads have very high intent
      tags: ['calendly', 'meeting-booked', payload?.event_type?.name || 'discovery-call'],
      last_contacted_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    }, { onConflict: 'email' });

    return res.status(200).json({ success: true, imported: 1, name: invitee.name });
  } catch (err) {
    console.error('[calendly-webhook]', err);
    return res.status(500).json({ error: err.message });
  }
}
