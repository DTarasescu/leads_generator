import { createRequestClient } from '../../lib/supabase';
import { getAccessToken, isValidEmail } from '../../lib/api-utils';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const token = getAccessToken(req);
      const supabase = createRequestClient(token);

      // Get referral stats for current user
      const { data, error } = await supabase
        .from('referral_leads')
        .select('referred_by, COUNT(*) as total, COUNT(CASE WHEN status = "converted" THEN 1 END) as converted')
        .eq('owner_email', req.user?.email)
        .groupBy('referred_by');

      if (error) throw error;

      return res.status(200).json({ 
        success: true, 
        referrals: data || [],
        total_referred: data?.reduce((sum, r) => sum + r.total, 0) || 0
      });
    } catch (err) {
      console.error('[referral-leads] GET:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method === 'POST') {
    try {
      const token = getAccessToken(req);
      const supabase = createRequestClient(token);
      
      const { referral_emails, incentive_type = 'credit', incentive_value = 50 } = req.body;
      // incentive_type: 'credit', 'discount', 'feature_unlock'

      if (!Array.isArray(referral_emails) || referral_emails.length === 0) {
        return res.status(400).json({ error: 'referral_emails array required' });
      }

      // Create referral invites
      const invites = referral_emails
        .filter(isValidEmail)
        .map(email => ({
          referrer_email: req.user?.email,
          referred_email: email.toLowerCase(),
          incentive_type,
          incentive_value,
          status: 'pending',
          created_at: new Date().toISOString(),
        }));

      if (invites.length === 0) {
        return res.status(400).json({ error: 'No valid emails provided' });
      }

      const { data, error } = await supabase
        .from('referral_leads')
        .insert(invites)
        .select();

      if (error) throw error;

      // TODO: Send referral emails with personalized links

      return res.status(201).json({ 
        success: true, 
        invites_sent: data.length
      });
    } catch (err) {
      console.error('[referral-leads] POST:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
