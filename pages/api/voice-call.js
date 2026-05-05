import { createRequestClient } from '../../lib/supabase';
import { getAccessToken } from '../../lib/api-utils';
import openrouter from '../../lib/openrouter';

// Outbound AI voice call via Twilio Voice API
// Places an automated discovery/qualification call using a TwiML script
// Requires: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_FROM
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const token = getAccessToken(req);
    const supabase = createRequestClient(token);

    const { lead_id, script_type = 'discovery' } = req.body;
    // script_type: 'discovery' | 'followup' | 'qualification' | 'reactivation'

    if (!lead_id) return res.status(400).json({ error: 'lead_id required' });

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_PHONE_FROM;

    if (!accountSid || !authToken || !fromNumber) {
      return res.status(500).json({ error: 'Twilio credentials not configured' });
    }

    // Fetch lead
    const { data: lead, error: leadErr } = await supabase
      .from('leads')
      .select('*')
      .eq('id', lead_id)
      .single();

    if (leadErr || !lead) return res.status(404).json({ error: 'Lead not found' });
    if (!lead.phone) return res.status(400).json({ error: 'Lead has no phone number' });

    // AI-generate personalized call script
    let callScript = '';
    try {
      const msg = await openrouter.chat.completions.create({
        model: 'mistralai/mistral-7b-instruct',
        messages: [{
          role: 'user',
          content: `Write a 30-second ${script_type} phone call script for a sales rep calling ${lead.name} who runs a ${lead.business_type} business in ${lead.city || 'their city'}. Be conversational, professional, and end with a clear ask. Plain text only, no stage directions.`,
        }],
        max_tokens: 200,
        temperature: 0.6,
      });
      callScript = msg.choices[0].message.content.trim();
    } catch (_) {
      callScript = `Hello, this is a message for ${lead.name}. We help ${lead.business_type} businesses grow their client base. I'd love to connect and learn more about your goals. Please call us back at your convenience. Thank you!`;
    }

    // Encode script for TwiML (Twilio's XML format)
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Pause length="1"/>
  <Say voice="Polly.Matthew" rate="90%">${callScript.replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c])}</Say>
  <Pause length="1"/>
  <Say voice="Polly.Matthew">Press 1 to speak with someone now, or hang up and we will follow up by email.</Say>
  <Gather numDigits="1" action="/api/voice-call-response" method="POST"/>
</Response>`;

    // Place call via Twilio REST API
    const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    const callRes = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To: lead.phone,
          From: fromNumber,
          Twiml: twiml,
          StatusCallback: `${process.env.NEXT_PUBLIC_APP_BASE}/api/voice-call-status`,
          StatusCallbackMethod: 'POST',
        }),
      }
    );

    const callData = await callRes.json();

    if (!callRes.ok) {
      return res.status(502).json({ error: 'Twilio call failed', detail: callData });
    }

    // Log to outreach history
    await supabase.from('lead_outreach_history').insert({
      lead_id,
      channel: 'voice',
      message: callScript,
      sent_at: new Date().toISOString(),
      external_id: callData.sid,
      status: callData.status,
    });

    // Update lead status
    await supabase.from('leads').update({
      status: 'contacted',
      last_contacted_at: new Date().toISOString(),
    }).eq('id', lead_id);

    return res.status(200).json({
      success: true,
      call_sid: callData.sid,
      status: callData.status,
      to: lead.phone,
      script_preview: callScript.slice(0, 100) + '...',
    });
  } catch (err) {
    console.error('[voice-call]', err);
    return res.status(500).json({ error: err.message });
  }
}
