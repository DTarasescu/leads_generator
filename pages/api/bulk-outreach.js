import { createRequestClient } from '../../lib/supabase';
import { getAccessToken } from '../../lib/api-utils';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const token = getAccessToken(req);
    const supabase = createRequestClient(token);
    
    const { 
      lead_ids, 
      channel = 'email', // 'email', 'sms', 'whatsapp', 'sequence_enrollment'
      template_id,
      delay_ms = 1000, // Delay between sends to avoid rate limiting
      tag_for_tracking = 'bulk-outreach'
    } = req.body;

    if (!Array.isArray(lead_ids) || lead_ids.length === 0) {
      return res.status(400).json({ error: 'lead_ids array required' });
    }

    if (!template_id && channel !== 'sequence_enrollment') {
      return res.status(400).json({ error: 'template_id required for non-sequence channels' });
    }

    // Validate leads exist
    const { data: leads, error: fetchError } = await supabase
      .from('leads')
      .select('id, email, phone, name')
      .in('id', lead_ids);

    if (fetchError) throw fetchError;

    if (leads.length === 0) {
      return res.status(404).json({ error: 'No leads found' });
    }

    // Create outreach batch record
    const { data: batch, error: batchError } = await supabase
      .from('outreach_batches')
      .insert({
        owner_email: req.user?.email,
        channel,
        template_id,
        total_leads: leads.length,
        status: 'queued',
        created_at: new Date().toISOString(),
      })
      .select();

    if (batchError) throw batchError;

    const batch_id = batch[0]?.id;

    // Queue outreach tasks (in production: use job queue like Bull/Bee-Queue)
    const outreachTasks = leads.map((lead, idx) => ({
      batch_id,
      lead_id: lead.id,
      channel,
      template_id,
      scheduled_for: new Date(Date.now() + idx * delay_ms).toISOString(),
      status: 'pending',
      created_at: new Date().toISOString(),
    }));

    const { error: tasksError } = await supabase
      .from('outreach_tasks')
      .insert(outreachTasks);

    if (tasksError) throw tasksError;

    // Tag leads for tracking
    for (const lead of leads) {
      await supabase
        .from('leads')
        .update({ 
          tags: [...(lead.tags || []), tag_for_tracking, `batch-${batch_id}`]
        })
        .eq('id', lead.id)
        .catch(e => console.log('Tag error:', e));
    }

    // TODO: Trigger async job processor to execute queued tasks

    return res.status(202).json({ 
      success: true, 
      batch_id,
      channel,
      leads_queued: leads.length,
      status: 'processing',
      message: 'Outreach batch queued for processing'
    });
  } catch (err) {
    console.error('[bulk-outreach]', err);
    return res.status(500).json({ error: err.message });
  }
}
