import { createRequestClient, createAdminClient } from '../../lib/supabase';
import { getAccessToken } from '../../lib/api-utils';

// Hiring signals importer (LinkedIn or job feeds prepared by automation)
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const token = getAccessToken(req);
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const client = createRequestClient(token);
    const { data: { user }, error: authErr } = await client.auth.getUser();
    if (authErr || !user) return res.status(401).json({ error: 'Invalid token' });

    const { jobs = [] } = req.body || {};
    if (!Array.isArray(jobs) || jobs.length === 0) {
      return res.status(400).json({ error: 'jobs array is required' });
    }

    const leads = jobs.slice(0, 100).map((job) => ({
      owner_email: user.email,
      name: job.company_name || 'Hiring company',
      website: job.company_website || null,
      business_type: job.industry || 'Company',
      city: job.city || null,
      country: job.country || null,
      source: 'linkedin_hiring',
      status: 'new',
      ai_score: 76,
      ai_score_reason: 'Active hiring indicates growth phase and budget allocation',
      notes: `Role: ${job.role_title || 'unknown role'}; link: ${job.job_url || 'n/a'}`,
    }));

    const admin = createAdminClient();
    const { data: inserted, error } = await admin.from('leads').insert(leads).select();
    if (error) throw error;

    return res.status(200).json({ success: true, imported: inserted.length });
  } catch (err) {
    console.error('[linkedin-hiring-signals]', err);
    return res.status(500).json({ error: err.message });
  }
}
