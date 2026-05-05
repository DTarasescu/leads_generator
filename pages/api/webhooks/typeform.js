import crypto from "crypto";
import { createAdminClient } from "../../../lib/supabase";

function verifyTypeformSignature(rawBody, signature, secret) {
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(rawBody);
  const computed = "sha256=" + hmac.digest("base64");
  try {
    return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(signature));
  } catch {
    return false;
  }
}

export const config = { api: { bodyParser: false } };

async function readRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const rawBody = await readRawBody(req);
  const signature = req.headers["typeform-signature"] || req.headers["x-typeform-signature"] || "";
  const secret = process.env.TYPEFORM_WEBHOOK_SECRET || "";

  if (secret && !verifyTypeformSignature(rawBody, signature, secret)) {
    return res.status(401).json({ error: "Invalid signature" });
  }

  let payload;
  try { payload = JSON.parse(rawBody); } catch { return res.status(400).json({ error: "Invalid JSON" }); }

  const answers = payload?.form_response?.answers || [];
  const definitions = payload?.form_response?.definition?.fields || [];

  function getAnswer(ref) {
    const defIdx = definitions.findIndex((d) => d.ref === ref);
    if (defIdx < 0) return "";
    const ans = answers[defIdx];
    if (!ans) return "";
    return ans.text || ans.email || ans.phone_number || ans.choice?.label || "";
  }

  const name = getAnswer("name") || getAnswer("full_name");
  const email = getAnswer("email");
  const phone = getAnswer("phone");
  const business_type = getAnswer("business_type") || getAnswer("businessType");
  const city = getAnswer("city");

  if (!name || !email) return res.status(200).json({ received: true, skipped: "missing name or email" });

  const ownerEmail = process.env.NEXT_PUBLIC_CAPTURE_OWNER_EMAIL || process.env.GOOGLE_EMAIL_USER || "admin@leads-generator.com";

  const admin = createAdminClient();
  await admin.from("leads").upsert(
    { owner_email: ownerEmail, name, email: email.toLowerCase(), phone: phone || null, business_type: business_type || null, city: city || null, source: "typeform", status: "new" },
    { onConflict: "email,owner_email", ignoreDuplicates: false }
  ).catch(() => {});

  return res.status(200).json({ received: true });
}
