import { createAdminClient } from "../../../lib/supabase";

// JotForm does not support HMAC signature verification — document this limitation.
// Protect this endpoint by keeping the URL secret (use a random path suffix in production).

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const body = req.body || {};

  // Field names are configurable via env vars so you can adapt to any JotForm layout
  const nameField = process.env.JOTFORM_FIELD_NAME || "q3_fullName";
  const emailField = process.env.JOTFORM_FIELD_EMAIL || "q4_email";
  const phoneField = process.env.JOTFORM_FIELD_PHONE || "q5_phone";
  const typeField = process.env.JOTFORM_FIELD_BUSINESS_TYPE || "q6_businessType";
  const cityField = process.env.JOTFORM_FIELD_CITY || "q7_city";

  const name = String(body[nameField] || "").trim();
  const email = String(body[emailField] || "").trim().toLowerCase();
  const phone = String(body[phoneField] || "").trim();
  const business_type = String(body[typeField] || "").trim();
  const city = String(body[cityField] || "").trim();

  if (!name || !email) return res.status(200).json({ received: true, skipped: "missing name or email" });

  const ownerEmail = process.env.NEXT_PUBLIC_CAPTURE_OWNER_EMAIL || process.env.GOOGLE_EMAIL_USER || "admin@leads-generator.com";

  const admin = createAdminClient();
  await admin.from("leads").upsert(
    { owner_email: ownerEmail, name, email, phone: phone || null, business_type: business_type || null, city: city || null, source: "jotform", status: "new" },
    { onConflict: "email,owner_email", ignoreDuplicates: false }
  ).catch(() => {});

  return res.status(200).json({ received: true });
}
