import nodemailer from "nodemailer";
import { createRequestClient } from "../../lib/supabase";
import { getAccessToken } from "../../lib/api-utils";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const token = getAccessToken(req);
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  const db = createRequestClient(token);
  const { data: { user }, error: authErr } = await db.auth.getUser();
  if (authErr || !user) return res.status(401).json({ error: "Invalid token" });

  const { to, subject, message, leadId } = req.body || {};
  if (!to || !subject || !message) {
    return res.status(400).json({ error: "to, subject, and message are required" });
  }

  const smtpUser = process.env.GOOGLE_EMAIL_USER;
  const smtpPass = process.env.GOOGLE_EMAIL_PASS;

  if (!process.env.SMTP_HOST || !smtpUser || !smtpPass) {
    return res.status(500).json({ error: "Email service not configured" });
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: smtpUser, pass: smtpPass },
  });

  try {
    await transporter.sendMail({ from: smtpUser, to, subject, text: message });
  } catch (err) {
    return res.status(500).json({ error: "Failed to send email: " + err.message });
  }

  // Log outreach in Supabase
  if (leadId) {
    const { createAdminClient } = await import("../../lib/supabase");
    const admin = createAdminClient();
    await admin.from("lead_outreach_history").insert({
      lead_id: leadId,
      owner_email: user.email,
      channel: "email",
      message,
    }).catch(() => {});

    // Update last_contacted_at and status
    await admin.from("leads")
      .update({ last_contacted_at: new Date().toISOString(), status: "contacted" })
      .eq("id", leadId)
      .eq("owner_email", user.email)
      .catch(() => {});
  }

  return res.status(200).json({ success: true });
}
