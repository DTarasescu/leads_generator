import { createRequestClient, createAdminClient } from "../../lib/supabase";
import { getAccessToken } from "../../lib/api-utils";

// Twilio WhatsApp API (requires TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_NUMBER)
async function sendWhatsAppViaTwilio(toPhone, message) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromPhone = process.env.TWILIO_WHATSAPP_NUMBER;

  if (!accountSid || !authToken || !fromPhone) {
    throw new Error("Twilio WhatsApp not configured");
  }

  const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

  const formData = new URLSearchParams();
  formData.append("From", fromPhone); // whatsapp:+14155552671
  formData.append("To", `whatsapp:${toPhone}`);
  formData.append("Body", message);

  const r = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: formData,
  });

  const data = await r.json();
  if (!r.ok) throw new Error(data.message || "Twilio error");
  return data.sid;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const token = getAccessToken(req);
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  const db = createRequestClient(token);
  const { data: { user }, error: authErr } = await db.auth.getUser();
  if (authErr || !user) return res.status(401).json({ error: "Invalid token" });

  const { to, message, leadId } = req.body || {};
  if (!to || !message) {
    return res.status(400).json({ error: "to and message are required" });
  }

  try {
    const sid = await sendWhatsAppViaTwilio(to, message);

    // Log in outreach history
    if (leadId) {
      const admin = createAdminClient();
      await admin.from("lead_outreach_history").insert({
        lead_id: leadId,
        owner_email: user.email,
        channel: "whatsapp",
        message,
      }).catch(() => {});

      // Update lead status
      await admin.from("leads")
        .update({ last_contacted_at: new Date().toISOString(), status: "contacted" })
        .eq("id", leadId)
        .eq("owner_email", user.email)
        .catch(() => {});
    }

    return res.status(200).json({ success: true, messageId: sid });
  } catch (err) {
    console.error("[send-whatsapp]", err.message);
    return res.status(500).json({ error: "Failed to send WhatsApp: " + err.message });
  }
}
