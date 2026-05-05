import { createAdminClient } from "../../lib/supabase";
import nodemailer from "nodemailer";

// Scheduler endpoint (should be called every 5-15 min by external cron)
// Requires CRON_SECRET env var for authentication

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // Verify cron secret
  const secret = req.headers["x-cron-secret"] || req.body?.secret;
  if (secret !== process.env.CRON_SECRET) {
    return res.status(403).json({ error: "Invalid cron secret" });
  }

  const admin = createAdminClient();
  const now = new Date();

  try {
    // Find all pending sequence steps that are ready to send
    const { data: pendingEnrollments } = await admin
      .from("lead_sequence_progress")
      .select("*, nurture_sequences(*)")
      .eq("is_paused", false)
      .eq("is_completed", false)
      .lte("next_step_scheduled_at", now.toISOString())
      .limit(100);

    if (!pendingEnrollments || pendingEnrollments.length === 0) {
      return res.status(200).json({ processed: 0 });
    }

    let processed = 0;
    let failed = 0;

    for (const enrollment of pendingEnrollments) {
      try {
        const { lead_id, sequence_id, owner_email, current_step, nurture_sequences: sequence } = enrollment;

        // Fetch next step
        const { data: nextStep } = await admin
          .from("sequence_steps")
          .select("*")
          .eq("sequence_id", sequence_id)
          .eq("step_number", current_step + 1)
          .single();

        if (!nextStep) {
          // No more steps — mark complete
          await admin
            .from("lead_sequence_progress")
            .update({ is_completed: true })
            .eq("id", enrollment.id);
          processed++;
          continue;
        }

        // Fetch lead data
        const { data: lead } = await admin
          .from("leads")
          .select("*")
          .eq("id", lead_id)
          .single();

        if (!lead) continue;

        // Fetch template/message
        let messageBody = nextStep.custom_message || "";

        if (nextStep.template_id) {
          const templateTable = nextStep.template_type === "email" ? "email_templates" : "sms_templates";
          const { data: template } = await admin
            .from(templateTable)
            .select("body, subject_line")
            .eq("id", nextStep.template_id)
            .single();

          if (template) {
            messageBody = template.body;
          }
        }

        // Variable substitution
        messageBody = messageBody
          .replace(/{{name}}/g, lead.name || "")
          .replace(/{{business_type}}/g, lead.business_type || "")
          .replace(/{{city}}/g, lead.city || "")
          .replace(/{{email}}/g, lead.email || "");

        // Send message based on channel
        if (nextStep.template_type === "email" && lead.email) {
          const smtpUser = process.env.GOOGLE_EMAIL_USER;
          const smtpPass = process.env.GOOGLE_EMAIL_PASS;

          if (process.env.SMTP_HOST && smtpUser && smtpPass) {
            const transporter = nodemailer.createTransport({
              host: process.env.SMTP_HOST,
              port: Number(process.env.SMTP_PORT) || 587,
              secure: Number(process.env.SMTP_PORT) === 465,
              auth: { user: smtpUser, pass: smtpPass },
            });

            await transporter.sendMail({
              from: smtpUser,
              to: lead.email,
              subject: "Follow-up",
              text: messageBody,
            });
          }
        } else if (nextStep.template_type === "sms" && lead.phone) {
          // Call send-sms API
          const phone = String(lead.phone).replace(/\D/g, "");
          if (phone) {
            fetch(`${process.env.NEXT_PUBLIC_APP_BASE || "http://localhost:3400"}/api/send-sms`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "X-Internal-Secret": process.env.CRON_SECRET },
              body: JSON.stringify({ to: `+${phone}`, message: messageBody, leadId: lead_id }),
            }).catch(() => {});
          }
        } else if (nextStep.template_type === "whatsapp" && lead.phone) {
          // Call send-whatsapp API
          const phone = String(lead.phone).replace(/\D/g, "");
          if (phone) {
            fetch(`${process.env.NEXT_PUBLIC_APP_BASE || "http://localhost:3400"}/api/send-whatsapp`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "X-Internal-Secret": process.env.CRON_SECRET },
              body: JSON.stringify({ to: `+${phone}`, message: messageBody, leadId: lead_id }),
            }).catch(() => {});
          }
        }

        // Schedule next step
        const nextStepDelay = nextStep.delay_hours || 24;
        const nextScheduledAt = new Date(now.getTime() + nextStepDelay * 60 * 60 * 1000);

        await admin
          .from("lead_sequence_progress")
          .update({
            current_step: current_step + 1,
            last_step_sent_at: now.toISOString(),
            next_step_scheduled_at: nextScheduledAt.toISOString(),
          })
          .eq("id", enrollment.id);

        processed++;
      } catch (err) {
        console.error("[sequence-scheduler] Step error:", err.message);
        failed++;
      }
    }

    return res.status(200).json({ processed, failed, message: `Processed ${processed} sequence steps` });
  } catch (err) {
    console.error("[sequence-scheduler]", err.message);
    return res.status(500).json({ error: "Scheduler error: " + err.message });
  }
}
