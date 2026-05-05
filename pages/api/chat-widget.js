import { createAdminClient } from '../../lib/supabase';
import openrouter from '../../lib/openrouter';

// Embeddable website chat widget backend
// Receives visitor chat messages, replies with AI, captures as leads when ready
// Public endpoint — uses admin client with server-side owner assignment
// CHAT_WIDGET_OWNER_EMAIL must be set so captured leads go to the right account

export default async function handler(req, res) {
  // Set CORS headers for cross-origin embeds
  res.setHeader('Access-Control-Allow-Origin', process.env.CHAT_WIDGET_ALLOWED_ORIGINS || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const supabase = createAdminClient();
    const {
      action,        // 'message' | 'capture'
      session_id,    // client-side UUID for conversation continuity
      message,       // visitor's message
      name,          // for 'capture' action
      email,         // for 'capture' action
      phone,         // for 'capture' action (optional)
      history = [],  // previous messages for context
    } = req.body;

    if (!session_id) return res.status(400).json({ error: 'session_id required' });

    if (action === 'capture') {
      if (!email) return res.status(400).json({ error: 'email required for capture' });

      const ownerEmail = process.env.CHAT_WIDGET_OWNER_EMAIL;
      if (!ownerEmail) {
        return res.status(500).json({ error: 'CHAT_WIDGET_OWNER_EMAIL not configured' });
      }

      const { error } = await supabase.from('leads').upsert({
        name: name || 'Chat Widget Visitor',
        email: email.toLowerCase(),
        phone: phone || null,
        business_type: 'Other',
        website: null,
        city: null,
        state: null,
        country: null,
        status: 'new',
        source: 'chat_widget',
        score: 70, // Self-identified via chat = good intent signal
        tags: ['chat-widget', `session-${session_id}`],
        created_at: new Date().toISOString(),
      }, { onConflict: 'email' });

      if (error) throw error;

      return res.status(200).json({
        success: true,
        message: "Thanks! We'll be in touch shortly.",
      });
    }

    if (action === 'message') {
      if (!message) return res.status(400).json({ error: 'message required' });

      const systemPrompt = process.env.CHAT_WIDGET_SYSTEM_PROMPT ||
        "You are a friendly sales assistant. Help website visitors understand how we can help them, collect their contact info when appropriate, and answer questions about our services. Be conversational, helpful, and brief (1-3 sentences).";

      const messages = [
        { role: 'system', content: systemPrompt },
        ...history.slice(-6).map(h => ({ role: h.role, content: h.content })),
        { role: 'user', content: message },
      ];

      let reply = "Thanks for your message! Let me connect you with someone who can help.";

      try {
        const result = await openrouter.chat.completions.create({
          model: 'mistralai/mistral-7b-instruct',
          messages,
          max_tokens: 150,
          temperature: 0.7,
        });
        reply = result.choices[0].message.content.trim();
      } catch (e) {
        console.log('[chat-widget] AI error:', e.message);
      }

      // Detect if visitor shared contact info in message
      const emailMatch = message.match(/[^\s@]+@[^\s@]+\.[^\s@]+/);
      const shouldAskCapture = history.length >= 2 && !emailMatch;

      return res.status(200).json({
        success: true,
        reply,
        suggest_capture: shouldAskCapture, // frontend shows contact form when true
        captured_email: emailMatch?.[0] || null,
      });
    }

    return res.status(400).json({ error: 'Invalid action. Use "message" or "capture"' });
  } catch (err) {
    console.error('[chat-widget]', err);
    return res.status(500).json({ error: err.message });
  }
}
