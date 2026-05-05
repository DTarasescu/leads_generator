import { createAdminClient } from "../../lib/supabase";
import { getAccessToken } from "../../lib/api-utils";

// Reddit Signal Monitor — scan subreddits for business pain points and ingest as leads
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const token = getAccessToken(req);
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  const admin = createAdminClient();
  const { data: { user }, error: authErr } = await admin.auth.getUser(token);
  if (authErr || !user) return res.status(401).json({ error: "Invalid token" });

  const {
    subreddits = ["smallbusiness", "entrepreneur", "startups", "SaaS"],
    keywords = ["need help", "looking for", "struggling with", "can't find", "recommend"],
    limit = 20,
    save_leads = true,
  } = req.body || {};

  try {
    const results = [];

    for (const sub of subreddits.slice(0, 5)) {
      const url = `https://www.reddit.com/r/${sub}/new.json?limit=${Math.min(limit, 25)}`;
      const resp = await fetch(url, {
        headers: { "User-Agent": "LeadsGenerator/1.0" },
      });

      if (!resp.ok) continue;
      const json = await resp.json();
      const posts = json?.data?.children || [];

      for (const post of posts) {
        const { title, selftext, author, url: postUrl, score, created_utc, permalink } = post.data;
        const text = `${title} ${selftext}`.toLowerCase();
        const matched = keywords.filter((kw) => text.includes(kw.toLowerCase()));
        if (!matched.length) continue;

        results.push({
          name: `Reddit: u/${author}`,
          business_type: `Reddit r/${sub}`,
          source: "reddit",
          notes: `Post: "${title.slice(0, 120)}" | Matched: ${matched.join(", ")} | Score: ${score}`,
          website: `https://reddit.com${permalink}`,
          owner_email: user.email,
          status: "new",
        });
      }

      if (results.length >= limit) break;
    }

    const batch = results.slice(0, limit);
    let saved = 0;

    if (save_leads && batch.length) {
      const { error } = await admin.from("leads").insert(batch);
      if (!error) saved = batch.length;
    }

    return res.status(200).json({
      found: batch.length,
      saved,
      leads: batch,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
