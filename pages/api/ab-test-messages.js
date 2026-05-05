import { createRequestClient } from '../../lib/supabase';
import { getAccessToken } from '../../lib/api-utils';
import openrouter from '../../lib/openrouter';

// A/B test outreach message variants — generates variants, tracks open/click/reply rates
// POST /api/ab-test → generates variants for a lead segment
// PATCH /api/ab-test → records a conversion event (open/click/reply)
// GET /api/ab-test → get results for a test
export default async function handler(req, res) {
  const token = getAccessToken(req);
  const supabase = createRequestClient(token);

  if (req.method === 'POST') {
    const {
      name,             // e.g. "Q1 cold email test"
      channel = 'email',
      segment_filters,  // same as lead-list-builder filters
      variants = 2,     // number of variants to generate (2-4)
      goal,             // e.g. "book a discovery call"
      base_message,     // optional human-written base
    } = req.body;

    if (!name) return res.status(400).json({ error: 'name required' });

    // Generate message variants using AI
    const generatedVariants = [];

    for (let i = 0; i < Math.min(variants, 4); i++) {
      const style = ['direct and concise', 'story-driven', 'question-based', 'value-first'][i];

      try {
        const msg = await openrouter.chat.completions.create({
          model: 'mistralai/mistral-7b-instruct',
          messages: [{
            role: 'user',
            content: `Write a cold ${channel} outreach message in a ${style} style. Goal: ${goal || 'book a discovery call'}. ${base_message ? `Base idea: ${base_message}` : ''}
Keep it under 100 words. Return JSON with {subject, body}.`,
          }],
          max_tokens: 300,
          temperature: 0.8,
        });

        const raw = msg.choices[0].message.content;
        const match = raw.match(/\{[\s\S]*\}/);
        const parsed = match ? JSON.parse(match[0]) : { subject: `Variant ${i + 1}`, body: raw };

        generatedVariants.push({
          variant_index: i,
          style,
          subject: parsed.subject || `Variant ${i + 1}`,
          body: parsed.body || raw,
          sends: 0,
          opens: 0,
          clicks: 0,
          replies: 0,
          conversions: 0,
        });
      } catch (e) {
        console.log('[ab-test] Variant generation error:', e.message);
      }
    }

    const { data, error } = await supabase
      .from('ab_tests')
      .insert({
        name,
        channel,
        goal: goal || 'book a discovery call',
        segment_filters: segment_filters || null,
        variants: generatedVariants,
        winner_variant: null,
        status: 'active',
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      // Table may not exist yet — return variants without persisting
      if (error.message.includes('does not exist')) {
        return res.status(200).json({ success: true, test_id: null, variants: generatedVariants, warning: 'ab_tests table not migrated yet' });
      }
      throw error;
    }

    return res.status(200).json({ success: true, test_id: data.id, variants: generatedVariants });
  }

  if (req.method === 'PATCH') {
    // Record event: { test_id, variant_index, event: 'send'|'open'|'click'|'reply'|'conversion' }
    const { test_id, variant_index, event } = req.body;

    if (!test_id || variant_index === undefined || !event) {
      return res.status(400).json({ error: 'test_id, variant_index, event required' });
    }

    const allowed = ['sends', 'opens', 'clicks', 'replies', 'conversions'];
    const field = event.endsWith('s') ? event : event + 's';
    if (!allowed.includes(field)) return res.status(400).json({ error: `event must be one of: ${allowed.join(', ')}` });

    const { data: test } = await supabase.from('ab_tests').select('variants').eq('id', test_id).single();
    if (!test) return res.status(404).json({ error: 'Test not found' });

    const variants = test.variants;
    if (!variants[variant_index]) return res.status(404).json({ error: 'Variant not found' });

    variants[variant_index][field] = (variants[variant_index][field] || 0) + 1;

    // Calculate winner by reply rate if we have enough data
    let winner_variant = null;
    const enough = variants.every(v => v.sends >= 20);
    if (enough) {
      const best = variants.reduce((best, v, i) => {
        const rate = v.replies / (v.sends || 1);
        return rate > best.rate ? { rate, index: i } : best;
      }, { rate: -1, index: -1 });
      if (best.rate > 0) winner_variant = best.index;
    }

    await supabase.from('ab_tests').update({ variants, winner_variant }).eq('id', test_id);

    return res.status(200).json({ success: true, winner_variant });
  }

  if (req.method === 'GET') {
    const { test_id } = req.query;

    const query = supabase.from('ab_tests').select('*').order('created_at', { ascending: false });
    if (test_id) query.eq('id', test_id);

    const { data, error } = await query.limit(20);
    if (error) throw error;

    return res.status(200).json({ success: true, tests: data });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
