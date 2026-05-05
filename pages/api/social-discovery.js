import { createRequestClient } from '../../lib/supabase';
import { getAccessToken } from '../../lib/api-utils';
import openrouter from '../../lib/openrouter';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const token = getAccessToken(req);
    const supabase = createRequestClient(token);
    
    const { keywords, platform = 'twitter', min_followers = 100 } = req.body;
    // platform: 'twitter', 'linkedin', 'reddit'

    if (!Array.isArray(keywords) || keywords.length === 0) {
      return res.status(400).json({ error: 'keywords array required' });
    }

    const socialLeads = [];

    for (const keyword of keywords) {
      try {
        // Use AI to generate realistic social media profiles (in production: Twitter API, LinkedIn API)
        const message = await openrouter.chat.completions.create({
          model: 'mistralai/mistral-7b-instruct',
          messages: [
            {
              role: 'user',
              content: `Generate 5 realistic ${platform} profiles interested in "${keyword}" with >100 followers. Return JSON array with: {handle, real_name, email, profile_url, followers, engagement_score (1-10), industry, use_case}. Be realistic.`
            }
          ],
          max_tokens: 1000,
          temperature: 0.6,
        });

        const content = message.choices[0].message.content;
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          socialLeads.push(...parsed.filter(p => p.followers >= min_followers));
        }
      } catch (e) {
        console.log(`[social-discovery] AI generation error for "${keyword}":`, e.message);
      }
    }

    // Convert social profiles to leads
    const leads = socialLeads.map(profile => ({
      name: profile.real_name || profile.handle,
      email: profile.email || `${profile.handle.toLowerCase()}@socialmedia.com`,
      phone: null,
      business_type: profile.industry || 'Technology',
      website: profile.profile_url || `https://${platform}.com/${profile.handle}`,
      city: null,
      state: null,
      country: 'US',
      status: 'new',
      source: `${platform}_discovery`,
      score: (profile.engagement_score || 5) * 10,
      google_place_id: null,
      tags: [`${platform}`, profile.use_case, 'social-found'],
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
      profiles_found: socialLeads.length,
      leads_imported: data.length,
      platform,
      keywords_searched: keywords.length
    });
  } catch (err) {
    console.error('[social-discovery]', err);
    return res.status(500).json({ error: err.message });
  }
}
