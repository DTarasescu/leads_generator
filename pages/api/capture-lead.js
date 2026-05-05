import { createAdminClient } from "../../lib/supabase";
import { isValidEmail } from "../../lib/api-utils";
import crypto from "crypto";

// In-memory rate limiter: 5 submissions per IP per hour
const ipMap = new Map();
function checkIpLimit(ip) {
  const now = Date.now();
  const entry = ipMap.get(ip) || { count: 0, reset: now + 3600000 };
  if (now > entry.reset) { entry.count = 0; entry.reset = now + 3600000; }
  entry.count++;
  ipMap.set(ip, entry);
  return entry.count <= 5;
}

function getIp(req) {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    "unknown"
  );
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const ip = getIp(req);
  if (!checkIpLimit(ip)) return res.status(429).json({ error: "Too many requests. Try again later." });

  const { name, email, phone, business_type, city } = req.body || {};

  if (!name || String(name).trim().length < 2) return res.status(400).json({ error: "Name is required" });
  if (!email || !isValidEmail(email)) return res.status(400).json({ error: "Valid email is required" });
  if (!business_type || String(business_type).trim().length < 2) return res.status(400).json({ error: "Business type is required" });
  if (!city || String(city).trim().length < 2) return res.status(400).json({ error: "City is required" });

  const ownerEmail = process.env.NEXT_PUBLIC_CAPTURE_OWNER_EMAIL || process.env.GOOGLE_EMAIL_USER || "admin@leads-generator.com";

  const admin = createAdminClient();
  const { error } = await admin.from("leads").insert({
    owner_email: ownerEmail,
    name: String(name).trim(),
    email: String(email).trim().toLowerCase(),
    phone: phone || null,
    business_type: String(business_type).trim(),
    city: String(city).trim(),
    source: "inbound",
    status: "new",
  });

  if (error) {
    console.error("[capture-lead]", new Date().toISOString(), email, error.message);
    return res.status(500).json({ error: "Could not save your submission. Please try again." });
  }

  console.log("[capture-lead]", new Date().toISOString(), email);
  return res.status(200).json({ success: true });
}
