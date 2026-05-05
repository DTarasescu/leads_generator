import { createRequestClient } from '../../lib/supabase';
import { getAccessToken, isValidEmail } from '../../lib/api-utils';

export default async function handler(req, res) {
  if (req.method === 'POST') {
    try {
      const token = getAccessToken(req);
      const supabase = createRequestClient(token);
      
      const { event_name, registrants, event_type = 'webinar', event_date } = req.body;
      // event_type: 'webinar', 'workshop', 'conference', 'meetup', 'summit'

      if (!Array.isArray(registrants) || registrants.length === 0) {
        return res.status(400).json({ error: 'registrants array required' });
      }

      // Validate and deduplicate registrants
      const seen = new Set();
      const validRegistrants = [];

      for (const reg of registrants) {
        if (!isValidEmail(reg.email)) continue;
        if (seen.has(reg.email)) continue;
        seen.add(reg.email);
        validRegistrants.push(reg);
      }

      // Convert registrants to leads
      const leads = validRegistrants.map(reg => ({
        name: reg.name || 'Attendee',
        email: reg.email.toLowerCase(),
        phone: reg.phone || null,
        business_type: reg.company_type || 'Technology',
        website: reg.company_website || null,
        city: reg.city || null,
        state: reg.state || null,
        country: reg.country || 'US',
        status: 'new',
        source: 'event_registration',
        score: null,
        google_place_id: null,
        tags: [event_type, event_name, 'event-attendee'],
        created_at: new Date().toISOString(),
      }));

      // Upsert to database
      const { data, error } = await supabase
        .from('leads')
        .upsert(leads, { onConflict: 'email' })
        .select();

      if (error) throw error;

      // Create event record for tracking
      await supabase.from('events').insert({
        owner_email: req.user?.email,
        event_name,
        event_type,
        event_date,
        total_registrants: registrants.length,
        imported_leads: data.length,
        created_at: new Date().toISOString(),
      });

      return res.status(201).json({ 
        success: true, 
        event: event_name,
        leads_imported: data.length,
        duplicates_skipped: registrants.length - validRegistrants.length
      });
    } catch (err) {
      console.error('[event-capture] POST:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method === 'GET') {
    try {
      const token = getAccessToken(req);
      const supabase = createRequestClient(token);

      // Get event history
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('owner_email', req.user?.email)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      return res.status(200).json({ success: true, events: data || [] });
    } catch (err) {
      console.error('[event-capture] GET:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
