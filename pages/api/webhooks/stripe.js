import { createAdminClient } from '../../lib/supabase';

// Stripe webhook — paying customers from other products become warm leads
// Also captures checkout.session.completed for payment form leads
// Requires: STRIPE_WEBHOOK_SECRET in env
// Install stripe: npm install stripe

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let event;

  try {
    const stripe = (await import('stripe')).default(process.env.STRIPE_SECRET_KEY);
    const sig = req.headers['stripe-signature'];
    const rawBody = req.body; // requires bodyParser: false in config

    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('[stripe-webhook] Signature error:', err.message);
    return res.status(400).json({ error: `Webhook error: ${err.message}` });
  }

  const supabase = createAdminClient();

  try {
    const relevantEvents = [
      'checkout.session.completed',
      'customer.created',
      'payment_intent.succeeded',
    ];

    if (!relevantEvents.includes(event.type)) {
      return res.status(200).json({ success: true, message: `Event "${event.type}" ignored` });
    }

    const obj = event.data.object;

    const email = obj.customer_email || obj.email || obj.receipt_email || null;
    if (!email) return res.status(200).json({ success: true, message: 'No email, skipped' });

    const metadata = obj.metadata || {};

    await supabase.from('leads').upsert({
      name: obj.customer_details?.name || metadata.name || 'Stripe Customer',
      email: email.toLowerCase(),
      phone: obj.customer_details?.phone || null,
      business_type: metadata.business_type || 'Other',
      website: metadata.website || null,
      city: obj.customer_details?.address?.city || null,
      state: obj.customer_details?.address?.state || null,
      country: obj.customer_details?.address?.country || 'US',
      status: 'converted', // Paying customer = converted
      source: 'stripe',
      score: 100, // Paying = maximum intent
      tags: ['stripe', 'paying-customer', event.type, `amount-${Math.round((obj.amount_total || 0) / 100)}`],
      last_contacted_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    }, { onConflict: 'email' });

    return res.status(200).json({ success: true, event: event.type });
  } catch (err) {
    console.error('[stripe-webhook]', err);
    return res.status(500).json({ error: err.message });
  }
}

// Disable Next.js body parsing — Stripe requires raw body for signature verification
export const config = { api: { bodyParser: false } };
