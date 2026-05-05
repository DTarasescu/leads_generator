import { createRequestClient } from '../../lib/supabase';
import { getAccessToken } from '../../lib/api-utils';

export default async function handler(req, res) {
  if (req.method === 'POST') {
    try {
      const token = getAccessToken(req);
      const supabase = createRequestClient(token);
      
      const { 
        list_name, 
        filters = {}, // {source: ['google_places', 'linkedin'], score_min: 60, status: 'new', tags: ['intent-signal']}
        limit = 500
      } = req.body;

      if (!list_name) {
        return res.status(400).json({ error: 'list_name required' });
      }

      // Build dynamic query based on filters
      let query = supabase.from('leads').select('*').eq('owner_email', req.user?.email);

      if (filters.source && Array.isArray(filters.source) && filters.source.length > 0) {
        query = query.in('source', filters.source);
      }

      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      if (filters.score_min !== undefined) {
        query = query.gte('score', filters.score_min);
      }

      if (filters.score_max !== undefined) {
        query = query.lte('score', filters.score_max);
      }

      if (filters.business_type && Array.isArray(filters.business_type) && filters.business_type.length > 0) {
        query = query.in('business_type', filters.business_type);
      }

      if (filters.country) {
        query = query.eq('country', filters.country);
      }

      // Apply tag filters (requires contains check)
      if (filters.tags && Array.isArray(filters.tags) && filters.tags.length > 0) {
        // Supabase array contains: @> operator
        for (const tag of filters.tags) {
          query = query.contains('tags', [tag]);
        }
      }

      query = query.limit(limit);

      const { data: leads, error } = await query;

      if (error) throw error;

      // Save list for future reference
      const { data: savedList } = await supabase.from('saved_lists').insert({
        owner_email: req.user?.email,
        list_name,
        filters,
        lead_count: leads?.length || 0,
        created_at: new Date().toISOString(),
      }).select();

      return res.status(200).json({ 
        success: true, 
        list_name,
        leads_found: leads?.length || 0,
        sample_leads: leads?.slice(0, 5) || [],
        saved_list_id: savedList?.[0]?.id
      });
    } catch (err) {
      console.error('[lead-list-builder] POST:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method === 'GET') {
    try {
      const token = getAccessToken(req);
      const supabase = createRequestClient(token);

      // Get saved lists
      const { data: lists, error } = await supabase
        .from('saved_lists')
        .select('*')
        .eq('owner_email', req.user?.email)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return res.status(200).json({ success: true, lists: lists || [] });
    } catch (err) {
      console.error('[lead-list-builder] GET:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
