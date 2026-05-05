import { createRequestClient } from '../../lib/supabase';
import { getAccessToken } from '../../lib/api-utils';

// Cold email deliverability verifier
// Validates a list of emails before a campaign — avoids hard bounces & protects domain reputation
// Requires: ZEROBOUNCE_API_KEY or falls back to basic MX check
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const token = getAccessToken(req);
    const supabase = createRequestClient(token);

    const { emails } = req.body;

    if (!Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({ error: 'emails array required' });
    }

    if (emails.length > 200) {
      return res.status(400).json({ error: 'Max 200 emails per request' });
    }

    const apiKey = process.env.ZEROBOUNCE_API_KEY;

    const results = [];

    if (apiKey) {
      // ZeroBounce batch validation (up to 200 per call)
      const payload = emails.slice(0, 200).map(email => ({ email_address: email }));
      const zbRes = await fetch('https://bulkapi.zerobounce.net/v2/validatebatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: apiKey, email_batch: payload }),
      });

      const zbData = await zbRes.json();

      for (const item of zbData.email_batch || []) {
        results.push({
          email: item.address,
          status: item.status,           // 'valid' | 'invalid' | 'catch-all' | 'unknown' | 'spamtrap' | 'abuse'
          sub_status: item.sub_status,
          score: item.quality_score,     // 0-10
          is_deliverable: item.status === 'valid',
        });
      }
    } else {
      // Fallback: basic format + MX record check via dns module
      const dns = await import('dns').then(m => m.promises);

      for (const email of emails) {
        const [, domain] = email.split('@');
        let hasMx = false;

        try {
          const records = await dns.resolveMx(domain);
          hasMx = records.length > 0;
        } catch (_) {
          hasMx = false;
        }

        const formatOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        results.push({
          email,
          status: hasMx && formatOk ? 'likely_valid' : 'invalid',
          is_deliverable: hasMx && formatOk,
          score: hasMx && formatOk ? 7 : 0,
        });
      }
    }

    // Update lead records with deliverability info
    for (const r of results.filter(r => !r.is_deliverable)) {
      await supabase
        .from('leads')
        .update({ tags: ['undeliverable', r.status] })
        .eq('email', r.email)
        .catch(() => {});
    }

    const valid = results.filter(r => r.is_deliverable);
    const invalid = results.filter(r => !r.is_deliverable);

    return res.status(200).json({
      success: true,
      total: results.length,
      valid: valid.length,
      invalid: invalid.length,
      deliverability_rate: `${Math.round((valid.length / results.length) * 100)}%`,
      results,
    });
  } catch (err) {
    console.error('[verify-emails]', err);
    return res.status(500).json({ error: err.message });
  }
}
