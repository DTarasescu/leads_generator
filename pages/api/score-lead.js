import { openrouter } from "../../lib/openrouter";
import { createRequestClient } from "../../lib/supabase";
import { getAccessToken } from "../../lib/api-utils";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const token = getAccessToken(req);
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  const db = createRequestClient(token);
  const { data: { user }, error: authErr } = await db.auth.getUser();
  if (authErr || !user) return res.status(401).json({ error: "Invalid token" });

  const { business_name, business_type, city, country, google_rating, google_review_count, website } = req.body || {};
  if (!business_name || !business_type) {
    return res.status(400).json({ error: "business_name and business_type are required" });
  }

  const prompt = `Score this business as a sales lead from 1 to 100 for a service business outreach campaign.
Business: ${business_name}, Type: ${business_type}, Location: ${city || "unknown"} ${country || ""},
Google Rating: ${google_rating || "N/A"} (${google_review_count || 0} reviews), Website: ${website || "none"}.
Reply ONLY with valid JSON, no markdown: { "score": number, "reason": "string max 20 words" }`;

  try {
    const result = await Promise.race([
      openrouter.chat.completions.create({
        model: "mistralai/mistral-7b-instruct",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 80,
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 10000)),
    ]);

    const raw = result.choices?.[0]?.message?.content?.trim() || "";
    // Strip markdown code fences if present
    const cleaned = raw.replace(/```[a-z]*\n?/gi, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    return res.status(200).json({
      score: Math.min(100, Math.max(0, Number(parsed.score) || 50)),
      reason: String(parsed.reason || "").slice(0, 100),
    });
  } catch {
    return res.status(200).json({ score: 50, reason: "AI scoring unavailable" });
  }
}
