import { createRequestClient } from '../../lib/supabase';
import { getAccessToken } from '../../lib/api-utils';
import openrouter from '../../lib/openrouter';

// Monitor subreddits for buying signals — finds people actively seeking services
// Uses Reddit's public JSON API (no key required for read-only)
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const token = getAccessToken(req);
    const supabase = createRequestClient(token);

    const {
      subreddits = ['entrepreneur', 'smallbusiness', 'marketing', 'startups'],
      keywords,   // e.g. ["need a website", "looking for accountant", "hire developer"]
      limit = 25,
    } = req.body;

    if (!Array.isArray(keywords) || keywords.length === 0) {
      return res.status(400).json({ error: 'keywords array required' });
    }

    const potentialLeads = [];

    for (const sub of subreddits.slice(0, 5)) {
      try {
        const resp = await fetch(
          `https://www.reddit.com/r/${sub}/new.json?limit=100`,
          { headers: { 'User-Agent': 'leads-generator-bot/1.0' } }
        );
        if (!resp.ok) continue;

        const { data: subredditData } = await resp.json();

        for (const post of subredditData?.children || []) {
          const p = post.data;
          const text = `${p.title} ${p.selftext || ''}`.toLowerCase();
          const matched = keywords.some(kw => text.includes(kw.toLowerCase()));

          if (matched) {
            potentialLeads.push({
              username: p.author,
              title: p.title,
              url: `https://reddit.com${p.permalink}`,
              subreddit: sub,
              score: p.score,
              created_utc: p.created_utc,
            });
          }
        }
      } catch (e) {
        console.log(`[reddit-monitor] Error on r/${sub}:`, e.message);
      }
    }

    if (potentialLeads.length === 0) {
      return res.status(200).json({ success: true, found: 0, leads: [] });
    }

    // Use AI to extract contact info or generate lead record from each post
    const leads = [];

    for (const pl of potentialLeads.slice(0, 20)) {
      try {
        const msg = await openrouter.chat.completions.create({
          model: 'mistralai/mistral-7b-instruct',
          messages: [{
            role: 'user',
            content: `A Reddit post from u/${pl.username} in r/${pl.subreddit} says: "${pl.title}". 
Infer: {name, email_guess, business_type, intent_summary, urgency (1-10), recommended_approach}.
Return valid JSON only.`,
          }],
          max_tokens: 300,
          temperature: 0.4,
        });

        const raw = msg.choices[0].message.content;
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (!jsonMatch) continue;

        const parsed = JSON.parse(jsonMatch[0]);

        leads.push({
          name: parsed.name || `u/${pl.username}`,
          email: parsed.email_guess || null,
          phone: null,
          business_type: parsed.business_type || 'Other',
          website: pl.url,
          city: null,
          state: null,
          country: 'US',
          status: 'new',
          source: 'reddit',
          score: Math.min(100, (parsed.urgency || 5) * 10),
          google_place_id: null,
          tags: ['reddit', pl.subreddit, 'buying-signal'],
          created_at: new Date().toISOString(),
        });
      } catch (e) {
        console.log('[reddit-monitor] AI parse error:', e.message);
      }
    }

    if (leads.length === 0) {
      return res.status(200).json({ success: true, found: potentialLeads.length, imported: 0 });
    }

    const { data, error } = await supabase
      .from('leads')
      .upsert(leads.filter(l => l.email), { onConflict: 'email' })
      .select();

    if (error) throw error;

    return res.status(200).json({
      success: true,
      posts_matched: potentialLeads.length,
      imported: data.length,
      raw_posts: potentialLeads.slice(0, 10), // return posts for manual review
    });
  } catch (err) {
    console.error('[reddit-monitor]', err);
    return res.status(500).json({ error: err.message });
  }
}
