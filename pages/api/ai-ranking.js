import { createRequestClient } from '../../lib/supabase';
import { getAccessToken } from '../../lib/api-utils';
import openrouter from '../../lib/openrouter';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const token = getAccessToken(req);
    const supabase = createRequestClient(token);
    
    const { lead_ids, ranking_criteria = 'conversion_likelihood' } = req.body;
    // ranking_criteria: 'conversion_likelihood', 'engagement_potential', 'deal_size', 'budget_capacity'

    if (!Array.isArray(lead_ids) || lead_ids.length === 0) {
      return res.status(400).json({ error: 'lead_ids array required' });
    }

    // Fetch leads from database
    const { data: leads, error: fetchError } = await supabase
      .from('leads')
      .select('*')
      .in('id', lead_ids);

    if (fetchError) throw fetchError;

    if (leads.length === 0) {
      return res.status(404).json({ error: 'No leads found' });
    }

    // Prepare lead summaries for AI ranking
    const leadSummaries = leads.map(l => 
      `ID: ${l.id}, Name: ${l.name}, Company: ${l.business_type}, Score: ${l.score}, Source: ${l.source}, Tags: ${l.tags?.join(',') || 'none'}`
    ).join('\n');

    try {
      // Use AI to rank leads
      const message = await openrouter.chat.completions.create({
        model: 'mistralai/mistral-7b-instruct',
        messages: [
          {
            role: 'user',
            content: `Rank these ${leads.length} leads by ${ranking_criteria}. Return JSON: {lead_id: rank_score (1-100), reasoning: "brief explanation"}. Be precise.\n\n${leadSummaries}`
          }
        ],
        max_tokens: 1500,
        temperature: 0.5,
      });

      const content = message.choices[0].message.content;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const rankings = JSON.parse(jsonMatch[0]);
        
        // Update leads with new scores
        for (const lead of leads) {
          if (rankings[lead.id]) {
            const { error: updateError } = await supabase
              .from('leads')
              .update({ 
                score: rankings[lead.id],
                tags: [...(lead.tags || []), `ai-ranked-${ranking_criteria}`]
              })
              .eq('id', lead.id);

            if (updateError) console.error('[ai-ranking] Update error:', updateError);
          }
        }

        // Return ranked leads
        const { data: rankedLeads } = await supabase
          .from('leads')
          .select('*')
          .in('id', lead_ids)
          .order('score', { ascending: false });

        return res.status(200).json({ 
          success: true, 
          criteria: ranking_criteria,
          leads_ranked: rankedLeads?.length || 0,
          rankings: rankedLeads || []
        });
      }
    } catch (aiErr) {
      console.log('[ai-ranking] AI error:', aiErr.message);
      // Fallback: return leads sorted by existing score
      leads.sort((a, b) => (b.score || 0) - (a.score || 0));
      return res.status(200).json({ 
        success: true, 
        message: 'Fallback ranking (AI unavailable)',
        rankings: leads
      });
    }
  } catch (err) {
    console.error('[ai-ranking]', err);
    return res.status(500).json({ error: err.message });
  }
}
