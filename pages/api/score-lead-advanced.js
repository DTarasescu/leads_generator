import { createRequestClient, createAdminClient } from "../../lib/supabase";
import { getAccessToken } from "../../lib/api-utils";
import { openrouter } from "../../lib/openrouter";

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

  // Fetch user's custom scoring rules
  const { data: rules } = await db
    .from("lead_scoring_rules")
    .select("*")
    .eq("owner_email", user.email)
    .eq("is_active", true);

  let baseScore = 50;

  // Apply rule-based scoring
  if (rules && rules.length > 0) {
    const lowerName = String(business_name).toLowerCase();
    const lowerType = String(business_type).toLowerCase();
    const lowerCity = String(city || "").toLowerCase();
    const lowerCountry = String(country || "").toLowerCase();

    rules.forEach((rule) => {
      const condValue = String(rule.condition_value).toLowerCase();
      const adjustment = rule.score_adjustment || 0;

      switch (rule.rule_type) {
        case "business_type":
          if (lowerType.includes(condValue) || condValue.includes(lowerType)) {
            baseScore += adjustment;
          }
          break;
        case "location":
          if (lowerCity.includes(condValue) || lowerCountry.includes(condValue)) {
            baseScore += adjustment;
          }
          break;
        case "website":
          if (website && (website.includes(condValue) || condValue === "has")) {
            baseScore += adjustment;
          } else if (!website && condValue === "no") {
            baseScore += adjustment;
          }
          break;
        case "reviews":
          const revCount = Number(google_review_count) || 0;
          if (condValue.startsWith(">")) {
            const threshold = Number(condValue.slice(1));
            if (revCount > threshold) baseScore += adjustment;
          } else if (condValue.startsWith("<")) {
            const threshold = Number(condValue.slice(1));
            if (revCount < threshold) baseScore += adjustment;
          }
          break;
        case "rating":
          const rating = Number(google_rating) || 0;
          if (condValue.startsWith(">=")) {
            const threshold = Number(condValue.slice(2));
            if (rating >= threshold) baseScore += adjustment;
          } else if (condValue.startsWith(">")) {
            const threshold = Number(condValue.slice(1));
            if (rating > threshold) baseScore += adjustment;
          }
          break;
      }
    });
  }

  // Call AI scoring as secondary layer (for reasoning)
  const prompt = `Score this business as a sales lead from 1 to 100 for a service business outreach campaign.
Business: ${business_name}, Type: ${business_type}, Location: ${city || "unknown"} ${country || ""},
Google Rating: ${google_rating || "N/A"} (${google_review_count || 0} reviews), Website: ${website || "none"}.
Current rule-based score: ${baseScore}.
Adjust if rules missed nuance. Reply ONLY with JSON: { "score": number, "reason": "string max 20 words" }`;

  let aiScore = baseScore;
  let reason = "";

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
    const cleaned = raw.replace(/```[a-z]*\n?/gi, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    aiScore = Math.min(100, Math.max(0, Number(parsed.score) || baseScore));
    reason = String(parsed.reason || "").slice(0, 100);
  } catch {
    reason = "Hybrid rule + AI scoring applied";
  }

  return res.status(200).json({
    score: aiScore,
    reason,
    baseScore,
    rulesApplied: rules?.length || 0,
  });
}
