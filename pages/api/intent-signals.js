import { createRequestClient } from '../../lib/supabase';
import { getAccessToken } from '../../lib/api-utils';
import openrouter from '../../lib/openrouter';

export default async function handler(req, res) {
  if (req.method === 'POST') {
    try {
      const token = getAccessToken(req);
      const supabase = createRequestClient(token);
      
      const { lead_id, signal_type, signal_data } = req.body;
      // signal_type: 'website_visit', 'email_open', 'link_click', 'form_submission', 'page_view', 'content_download'

      if (!lead_id || !signal_type) {
        return res.status(400).json({ error: 'lead_id and signal_type required' });
      }

      // Record intent signal
      const { data: signal, error: signalError } = await supabase
        .from('lead_intent_signals')
        .insert({
          lead_id,
          owner_email: req.user?.email,
          signal_type,
          signal_data: signal_data || {},
          timestamp: new Date().toISOString(),
        })
        .select();

      if (signalError) throw signalError;

      // Get lead
      const { data: leads } = await supabase
        .from('leads')
        .select('*')
        .eq('id', lead_id)
        .single();

      // Update lead score based on intent signal
      const signalWeights = {
        'website_visit': 5,
        'email_open': 10,
        'link_click': 15,
        'form_submission': 25,
        'page_view': 3,
        'content_download': 20,
      };

      const scoreIncrease = signalWeights[signal_type] || 5;
      const newScore = Math.min(100, (leads?.score || 0) + scoreIncrease);

      await supabase
        .from('leads')
        .update({ 
          score: newScore,
          tags: [...(leads?.tags || []), `signal-${signal_type}`]
        })
        .eq('id', lead_id);

      return res.status(201).json({ 
        success: true, 
        signal_recorded: true,
        lead_id,
        signal_type,
        new_score: newScore
      });
    } catch (err) {
      console.error('[intent-signals] POST:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method === 'GET') {
    try {
      const token = getAccessToken(req);
      const supabase = createRequestClient(token);
      
      const { lead_id } = req.query;

      if (!lead_id) {
        return res.status(400).json({ error: 'lead_id query param required' });
      }

      // Get all signals for lead
      const { data: signals, error } = await supabase
        .from('lead_intent_signals')
        .select('*')
        .eq('lead_id', lead_id)
        .order('timestamp', { ascending: false })
        .limit(100);

      if (error) throw error;

      // Calculate engagement score
      const engagementScore = signals?.reduce((sum, s) => {
        const weights = {
          'website_visit': 5, 'email_open': 10, 'link_click': 15,
          'form_submission': 25, 'page_view': 3, 'content_download': 20,
        };
        return sum + (weights[s.signal_type] || 5);
      }, 0) || 0;

      return res.status(200).json({ 
        success: true, 
        lead_id,
        signal_count: signals?.length || 0,
        engagement_score: Math.min(100, engagementScore),
        signals: signals || []
      });
    } catch (err) {
      console.error('[intent-signals] GET:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
