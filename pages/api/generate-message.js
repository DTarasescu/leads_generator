import { openrouter } from "../../lib/openrouter";
import { createRequestClient } from "../../lib/supabase";
import { getAccessToken } from "../../lib/api-utils";

const COUNTRY_LANG = {
  romania: "Romanian", moldova: "Romanian",
  france: "French", belgium: "French",
  germany: "German", austria: "German",
  italy: "Italian",
  portugal: "Portuguese", brazil: "Portuguese",
  spain: "Spanish", mexico: "Spanish", argentina: "Spanish",
};

function detectLanguage(country) {
  const key = String(country || "").toLowerCase().trim();
  return COUNTRY_LANG[key] || "English";
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const token = getAccessToken(req);
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  const db = createRequestClient(token);
  const { data: { user }, error: authErr } = await db.auth.getUser();
  if (authErr || !user) return res.status(401).json({ error: "Invalid token" });

  const {
    name, business_type, city, country, website,
    campaign = "outreach",
    discount = null,
  } = req.body || {};

  if (!name || !business_type) {
    return res.status(400).json({ error: "name and business_type are required" });
  }

  const language = detectLanguage(country);
  const discountLine = discount ? ` Mention a ${discount}% introductory discount.` : "";

  const prompt = `Write a short, friendly cold-outreach message in ${language} to a ${business_type} business called "${name}" located in ${city || "their city"}${country ? `, ${country}` : ""}.
The message is from a business growth consultant offering to help them attract more clients.${discountLine}
${website ? `Their website is ${website}.` : ""}
Keep it under 120 words. Be warm, specific, and professional. Do not use generic opener like "I hope this message finds you well".
Reply ONLY with the message text — no subject line, no signature.`;

  try {
    const result = await Promise.race([
      openrouter.chat.completions.create({
        model: "mistralai/mistral-7b-instruct",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 300,
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 20000)),
    ]);

    const message = result.choices?.[0]?.message?.content?.trim() || "";
    if (!message) return res.status(502).json({ error: "AI returned empty response" });
    return res.status(200).json({ message });
  } catch (err) {
    // Fallback template
    const fallback = `Hi ${name} team! I'm reaching out because I help ${business_type} businesses${city ? ` in ${city}` : ""} attract more clients through AI-powered outreach. I'd love to share a few ideas that have worked well for similar businesses. Would you be open to a quick chat? Looking forward to connecting!`;
    return res.status(200).json({ message: fallback, fallback: true });
  }
}
