import { createRequestClient } from '../../lib/supabase';
import { getAccessToken } from '../../lib/api-utils';

// Job board monitoring — companies hiring = they have budget.
// Calls Adzuna public API (free tier). No key needed for basic searches.
// Premium: integrate Greenhouse, Lever, Workday webhooks or LinkedIn Jobs API.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const token = getAccessToken(req);
    const supabase = createRequestClient(token);

    const {
      roles = ['marketing manager', 'head of growth', 'sales director'],
      location = 'us',
      max_salary_usd,   // optional: filter by salary range (signals budget)
      limit = 20,
    } = req.body;

    if (!Array.isArray(roles) || roles.length === 0) {
      return res.status(400).json({ error: 'roles array required' });
    }

    const appId = process.env.ADZUNA_APP_ID;
    const appKey = process.env.ADZUNA_APP_KEY;

    const allJobs = [];

    for (const role of roles.slice(0, 3)) {
      try {
        const params = new URLSearchParams({
          app_id: appId || 'demo',
          app_key: appKey || 'demo',
          results_per_page: String(Math.ceil(limit / roles.length)),
          what: role,
          where: location,
          ...(max_salary_usd && { salary_max: String(max_salary_usd) }),
          content_type: 'application/json',
        });

        const resp = await fetch(
          `https://api.adzuna.com/v1/api/jobs/${location}/search/1?${params}`,
          { headers: { Accept: 'application/json' } }
        );

        if (!resp.ok) continue;
        const { results = [] } = await resp.json();

        for (const job of results) {
          allJobs.push({
            company: job.company?.display_name || 'Unknown',
            title: job.title,
            location: job.location?.display_name,
            salary_max: job.salary_max,
            role_searched: role,
            job_url: job.redirect_url,
          });
        }
      } catch (e) {
        console.log(`[job-board-leads] Error for role "${role}":`, e.message);
      }
    }

    // Convert to leads (target the hiring company as a prospect)
    // Companies hiring senior roles have budget and scaling pains = hot leads
    const seen = new Set();
    const leads = allJobs
      .filter(j => {
        const key = j.company.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map(j => ({
        name: `${j.company} (Hiring ${j.role_searched})`,
        email: null,
        phone: null,
        business_type: 'Technology',
        website: j.job_url,
        city: j.location?.split(',')[0] || null,
        state: j.location?.split(',')[1]?.trim() || null,
        country: 'US',
        status: 'new',
        source: 'job_board',
        score: j.salary_max ? Math.min(100, Math.round(j.salary_max / 2000)) : 60,
        google_place_id: null,
        tags: ['hiring-signal', j.role_searched.replace(/\s+/g, '-'), 'has-budget'],
        created_at: new Date().toISOString(),
      }));

    if (leads.length === 0) {
      return res.status(200).json({ success: true, jobs_found: allJobs.length, imported: 0 });
    }

    const { data, error } = await supabase
      .from('leads')
      .insert(leads)  // insert only, no upsert since emails are null
      .select();

    if (error && !error.message.includes('duplicate')) throw error;

    return res.status(200).json({
      success: true,
      jobs_found: allJobs.length,
      companies_found: leads.length,
      imported: data?.length || 0,
    });
  } catch (err) {
    console.error('[job-board-leads]', err);
    return res.status(500).json({ error: err.message });
  }
}
