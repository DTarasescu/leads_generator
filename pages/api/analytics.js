import { createRequestClient, createAdminClient } from "../../lib/supabase";
import { getAccessToken } from "../../lib/api-utils";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const token = getAccessToken(req);
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  const db = createRequestClient(token);
  const { data: { user }, error: authErr } = await db.auth.getUser();
  if (authErr || !user) return res.status(401).json({ error: "Invalid token" });

  const { days = 30 } = req.query;
  const daysNum = Math.min(365, Number(days) || 30);
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysNum);

  try {
    // Fetch leads data
    const { data: allLeads } = await db
      .from("leads")
      .select("*")
      .eq("owner_email", user.email)
      .is("deleted_at", null);

    const { data: leadsByStatus } = await db
      .from("leads")
      .select("status, count(*)")
      .eq("owner_email", user.email)
      .is("deleted_at", null);

    const { data: leadsBySource } = await db
      .from("leads")
      .select("source, count(*)")
      .eq("owner_email", user.email)
      .is("deleted_at", null);

    const { data: outreachHistory } = await db
      .from("lead_outreach_history")
      .select("channel, count(*)")
      .eq("owner_email", user.email);

    // Calculate metrics
    const totalLeads = allLeads?.length || 0;
    const newLeads = allLeads?.filter((l) => l.status === "new").length || 0;
    const contacted = allLeads?.filter((l) => l.status === "contacted").length || 0;
    const qualified = allLeads?.filter((l) => l.status === "qualified").length || 0;
    const converted = allLeads?.filter((l) => l.status === "converted").length || 0;

    const conversionRate =
      contacted > 0 ? ((converted / contacted) * 100).toFixed(1) : 0;

    const avgScore = allLeads?.length
      ? (
          allLeads.reduce((sum, l) => sum + (l.ai_score || 0), 0) /
          allLeads.length
        ).toFixed(1)
      : 0;

    // Count outreach by channel
    const channelCounts = {};
    outreachHistory?.forEach((row) => {
      if (row.channel) channelCounts[row.channel] = row.count;
    });

    const statusBreakdown = {};
    leadsByStatus?.forEach((row) => {
      if (row.status) statusBreakdown[row.status] = row.count;
    });

    const sourceBreakdown = {};
    leadsBySource?.forEach((row) => {
      if (row.source) sourceBreakdown[row.source] = row.count;
    });

    return res.status(200).json({
      summary: {
        totalLeads,
        newLeads,
        contacted,
        qualified,
        converted,
        conversionRate: parseFloat(conversionRate),
        avgScore: parseFloat(avgScore),
      },
      statusBreakdown,
      sourceBreakdown,
      channelCounts,
      period: `${daysNum} days`,
    });
  } catch (err) {
    console.error("[analytics]", err.message);
    return res.status(500).json({ error: "Failed to fetch analytics" });
  }
}
