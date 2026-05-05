import { createRequestClient } from '../../lib/supabase';
import { getAccessToken } from '../../lib/api-utils';
import openrouter from '../../lib/openrouter';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const token = getAccessToken(req);
    const supabase = createRequestClient(token);
    
    const { keywords, days = 7 } = req.body; // ["job promotion", "funding round", "product launch"]

    if (!Array.isArray(keywords) || keywords.length === 0) {
      return res.status(400).json({ error: 'keywords array required' });
    }

    // Simulate intent data sources (in production: Crunchbase API, G2 API, etc.)
    // For MVP, use AI to generate realistic intent signals
    const intentSignals = [];

    for (const keyword of keywords) {
      try {
        const message = await openrouter.chat.completions.create({
          model: 'mistralai/mistral-7b-instruct',
          messages: [
            {
              role: 'user',
              content: `Generate 5 realistic B2B leads showing intent signals for keyword "${keyword}" in the last ${days} days. Return JSON array with: {name, company, email, position, intent_signal, urgency_score (1-10)}. Be specific and realistic.`
            }
          ],
          max_tokens: 1000,
          temperature: 0.7,
        });

        const content = message.choices[0].message.content;
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          intentSignals.push(...parsed.slice(0, 5));
        }
      } catch (e) {
        console.log(`[intent-data] AI generation error for "${keyword}":`, e.message);
      }
    }

    // Convert intent signals to leads
    const leads = intentSignals.map(signal => ({
      name: signal.name || 'Unknown',
      email: signal.email?.toLowerCase() || `${signal.position.replace(/\s+/g, '.')}@${signal.company.toLowerCase().replace(/\s+/g, '')}.com`,
      phone: null,
      business_type: 'Technology',
      website: `https://${signal.company.toLowerCase().replace(/\s+/g, '')}.com`,
      city: null,
      state: null,
      country: 'US',
      status: 'new',
      source: 'intent_data',
      score: null,
      google_place_id: null,
      tags: ['intent-signal', `urgency-${signal.urgency_score || 5}`, keyword],
      created_at: new Date().toISOString(),
    }));

    if (leads.length === 0) {
      return res.status(200).json({ success: true, found: 0, leads: [] });
    }

    // Upsert to database
    const { data, error } = await supabase
      .from('leads')
      .upsert(leads, { onConflict: 'email' })
      .select();

    if (error) throw error;

    return res.status(200).json({ 
      success: true, 
      found: intentSignals.length,
      imported: data.length,
      keywords_processed: keywords.length
    });
  } catch (err) {
    console.error('[intent-data]', err);
    return res.status(500).json({ error: err.message });
  }
}
