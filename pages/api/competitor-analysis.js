import { createRequestClient } from '../../lib/supabase';
import { getAccessToken } from '../../lib/api-utils';
import openrouter from '../../lib/openrouter';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const token = getAccessToken(req);
    const supabase = createRequestClient(token);
    
    const { competitor_domains, num_leads = 20 } = req.body;

    if (!Array.isArray(competitor_domains) || competitor_domains.length === 0) {
      return res.status(400).json({ error: 'competitor_domains array required' });
    }

    const competitorLeads = [];

    for (const domain of competitor_domains) {
      try {
        // Use Hunter.io to extract leads from competitor domains
        const response = await fetch(
          `https://api.hunter.io/v2/domain-search?domain=${domain}&limit=${Math.ceil(num_leads / competitor_domains.length)}`,
          { headers: { 'User-Agent': 'leads-generator' } }
        );

        const data = await response.json();

        if (data.data?.emails) {
          competitorLeads.push(
            ...data.data.emails
              .filter(e => e.confidence > 0.75)
              .map(e => ({
                email: e.value,
                name: e.first_name && e.last_name ? `${e.first_name} ${e.last_name}` : `${e.first_name || 'Lead'}`,
                position: e.position || 'Unknown',
                domain,
              }))
          );
        }
      } catch (e) {
        console.log(`[competitor-analysis] Error fetching ${domain}:`, e.message);
      }
    }

    if (competitorLeads.length === 0) {
      return res.status(200).json({ success: true, found: 0, leads: [] });
    }

    // AI-rank competitors' leads by conversion likelihood
    try {
      const message = await openrouter.chat.completions.create({
        model: 'mistralai/mistral-7b-instruct',
        messages: [
          {
            role: 'user',
            content: `Given these ${competitorLeads.length} leads from competitor domains [${competitorLeads.map(l => l.position).join(', ')}], rank them 1-10 by likelihood of being a customer (decision-maker quality). Return JSON with email: rank_score.`
          }
        ],
        max_tokens: 1000,
        temperature: 0.7,
      });

      const content = message.choices[0].message.content;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const scores = JSON.parse(jsonMatch[0]);
        for (const lead of competitorLeads) {
          lead.score = (scores[lead.email] || 5) * 10;
        }
      }
    } catch (e) {
      console.log('[competitor-analysis] AI ranking error:', e.message);
      for (const lead of competitorLeads) {
        lead.score = 60; // Default score
      }
    }

    // Convert to lead records
    const leads = competitorLeads.map(cl => ({
      name: cl.name,
      email: cl.email.toLowerCase(),
      phone: null,
      business_type: 'Technology',
      website: `https://${cl.domain}`,
      city: null,
      state: null,
      country: 'US',
      status: 'new',
      source: 'competitor_analysis',
      score: cl.score || 60,
      google_place_id: null,
      tags: ['competitor-lead', cl.domain.split('.')[0], cl.position?.toLowerCase() || 'unknown'],
      created_at: new Date().toISOString(),
    }));

    // Upsert to database
    const { data, error } = await supabase
      .from('leads')
      .upsert(leads, { onConflict: 'email' })
      .select();

    if (error) throw error;

    return res.status(200).json({ 
      success: true, 
      competitors_analyzed: competitor_domains.length,
      leads_found: leads.length,
      leads_imported: data.length
    });
  } catch (err) {
    console.error('[competitor-analysis]', err);
    return res.status(500).json({ error: err.message });
  }
}
