import { createRequestClient, createAdminClient } from '../../lib/supabase';
import { getAccessToken } from '../../lib/api-utils';

// Import externally prepared Trustpilot/G2 risk signals into the lead pipeline
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const token = getAccessToken(req);
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const client = createRequestClient(token);
    const { data: { user }, error: authErr } = await client.auth.getUser();
    if (authErr || !user) return res.status(401).json({ error: 'Invalid token' });

    const { companies = [] } = req.body || {};
    if (!Array.isArray(companies) || companies.length === 0) {
      return res.status(400).json({ error: 'companies array is required' });
    }

    const leads = companies.slice(0, 100).map((company) => {
      const rating = Number(company.rating || 0);
      const reviewCount = Number(company.review_count || 0);
      const computed = Math.max(40, Math.min(92, Math.round((4.2 - rating) * 18 + Math.min(20, reviewCount / 50))));

      return {
        owner_email: user.email,
        name: company.name || 'Review-signal company',
        business_type: company.business_type || 'Company',
        website: company.website || null,
        city: company.city || null,
        country: company.country || null,
        source: company.source || 'trustpilot_signal',
        status: 'new',
        ai_score: computed,
        ai_score_reason: 'Review sentiment signal indicates potential churn-prevention demand',
        notes: `Rating ${rating || 'n/a'} from ${reviewCount || 0} reviews`,
      };
    });

    const admin = createAdminClient();
    const { data: inserted, error } = await admin.from('leads').insert(leads).select();
    if (error) throw error;

    return res.status(200).json({ success: true, imported: inserted.length });
  } catch (err) {
    console.error('[trustpilot-monitor]', err);
    return res.status(500).json({ error: err.message });
  }
}
