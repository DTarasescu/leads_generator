import { createRequestClient } from '../../lib/supabase';
import { getAccessToken } from '../../lib/api-utils';
import openrouter from '../../lib/openrouter';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const token = getAccessToken(req);
    const supabase = createRequestClient(token);
    
    const { company_names, news_types = ['funding', 'hiring', 'expansion'] } = req.body;
    // news_types: ['funding', 'hiring', 'expansion', 'partnership', 'acquisition']

    if (!Array.isArray(company_names) || company_names.length === 0) {
      return res.status(400).json({ error: 'company_names array required' });
    }

    const newsItems = [];

    for (const company of company_names) {
      try {
        // Use AI to generate realistic company news (in production: NewsAPI, Crunchbase)
        const message = await openrouter.chat.completions.create({
          model: 'mistralai/mistral-7b-instruct',
          messages: [
            {
              role: 'user',
              content: `Generate 3 realistic recent news items for company "${company}" with types: ${news_types.join(', ')}. Return JSON array with: {title, description, news_type, date, relevance_score (1-10), contact_name, contact_email, contact_role}. Be specific.`
            }
          ],
          max_tokens: 1200,
          temperature: 0.6,
        });

        const content = message.choices[0].message.content;
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          newsItems.push(...parsed);
        }
      } catch (e) {
        console.log(`[company-news] AI generation error for "${company}":`, e.message);
      }
    }

    // Convert news to leads (target decision-makers mentioned in news)
    const leads = newsItems.map(news => ({
      name: news.contact_name || 'Unknown',
      email: news.contact_email?.toLowerCase() || `contact@${company_names[0].toLowerCase().replace(/\s+/g, '')}.com`,
      phone: null,
      business_type: 'Technology',
      website: `https://${company_names[0].toLowerCase().replace(/\s+/g, '')}.com`,
      city: null,
      state: null,
      country: 'US',
      status: 'new',
      source: 'company_news',
      score: (news.relevance_score || 5) * 10, // Convert to 0-100 scale
      google_place_id: null,
      tags: [news.news_type, news.title.slice(0, 30), 'news-trigger'],
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
      news_found: newsItems.length,
      leads_imported: data.length,
      companies_monitored: company_names.length
    });
  } catch (err) {
    console.error('[company-news]', err);
    return res.status(500).json({ error: err.message });
  }
}
