import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabase";
import { API_BASE } from "../lib/api-utils";
import Nav from "../components/Nav";
import { useToast } from "../components/ToastProvider";

function StatCard({ label, value, color = "purple" }) {
  const colorMap = {
    purple: "#6366f1",
    green: "#10b981",
    blue: "#3b82f6",
    orange: "#f59e0b",
  };
  return (
    <div className="stat-card" style={{ borderColor: colorMap[color] }}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      <style jsx>{`
        .stat-card {
          background: var(--surface-strong);
          border-radius: var(--radius-lg);
          padding: 20px;
          border-left: 4px solid ${colorMap[color]};
          box-shadow: var(--shadow-md);
        }
        .stat-label { font-size: 0.9rem; color: var(--muted); font-weight: 600; }
        .stat-value { font-size: 2rem; font-weight: 800; color: var(--ink); margin-top: 8px; }
      `}</style>
    </div>
  );
}

function PieChart({ data, title }) {
  if (!data || Object.keys(data).length === 0) {
    return <div style={{ textAlign: "center", color: "var(--muted)", padding: "20px" }}>No data</div>;
  }

  const total = Object.values(data).reduce((a, b) => a + b, 0);
  const colors = ["#6366f1", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444"];

  let offset = 0;
  const slices = Object.entries(data).map(([label, value], idx) => {
    const percentage = (value / total) * 100;
    const sliceOffset = offset;
    offset += percentage;
    return { label, value, percentage, color: colors[idx % colors.length], offset: sliceOffset };
  });

  return (
    <div className="chart-container">
      <h3 className="chart-title">{title}</h3>
      <svg viewBox="0 0 200 200" className="pie-chart">
        {slices.map((slice, idx) => {
          const radius = 80;
          const startAngle = (slice.offset / 100) * 360;
          const endAngle = ((slice.offset + slice.percentage) / 100) * 360;
          const startRad = (startAngle * Math.PI) / 180;
          const endRad = (endAngle * Math.PI) / 180;
          const x1 = 100 + radius * Math.cos(startRad);
          const y1 = 100 + radius * Math.sin(startRad);
          const x2 = 100 + radius * Math.cos(endRad);
          const y2 = 100 + radius * Math.sin(endRad);
          const largeArc = slice.percentage > 50 ? 1 : 0;
          return (
            <path
              key={idx}
              d={`M 100 100 L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`}
              fill={slice.color}
              opacity={0.8}
            />
          );
        })}
      </svg>
      <div className="legend">
        {slices.map((slice, idx) => (
          <div key={idx} className="legend-item">
            <span className="legend-color" style={{ background: slice.color }} />
            <span className="legend-label">{slice.label}: {slice.value}</span>
          </div>
        ))}
      </div>

      <style jsx>{`
        .chart-container { background: var(--surface-strong); border-radius: var(--radius-lg); padding: 20px; }
        .chart-title { font-size: 1rem; font-weight: 700; margin-bottom: 15px; }
        .pie-chart { max-width: 200px; margin: 0 auto; }
        .legend { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 12px; }
        .legend-item { display: flex; align-items: center; gap: 6px; font-size: 0.85rem; }
        .legend-color { width: 12px; height: 12px; border-radius: 2px; }
      `}</style>
    </div>
  );
}

export default function AnalyticsDashboardPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [user, setUser] = useState(null);
  const [token, setToken] = useState("");
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace("/"); return; }
      setUser(session.user);
      setToken(session.access_token);
    });
  }, [router]);

  const fetchAnalytics = async (d = days) => {
    if (!token) return;
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/api/analytics?days=${d}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await r.json();
      if (r.ok) setAnalytics(data);
      else showToast(data.error || "Failed to load analytics", { type: "error" });
    } catch {
      showToast("Network error", { type: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchAnalytics();
  }, [token]);

  function handleDaysChange(d) {
    setDays(d);
    fetchAnalytics(d);
  }

  if (!user || !analytics) return null;

  const { summary, statusBreakdown, sourceBreakdown, channelCounts } = analytics;

  return (
    <div>
      <Nav user={user} />
      <div className="page">
        <h1 className="title">📊 Analytics Dashboard</h1>

        <div className="filters">
          {[7, 30, 90, 365].map((d) => (
            <button
              key={d}
              className={`filter-btn ${days === d ? "active" : ""}`}
              onClick={() => handleDaysChange(d)}
            >
              {d} days
            </button>
          ))}
        </div>

        <div className="summary-grid">
          <StatCard label="Total Leads" value={summary.totalLeads} color="purple" />
          <StatCard label="New Leads" value={summary.newLeads} color="blue" />
          <StatCard label="Contacted" value={summary.contacted} color="orange" />
          <StatCard label="Converted" value={summary.converted} color="green" />
        </div>

        <div className="metrics-grid">
          <div className="metric">
            <div className="metric-label">Conversion Rate</div>
            <div className="metric-value">{summary.conversionRate}%</div>
          </div>
          <div className="metric">
            <div className="metric-label">Avg Lead Score</div>
            <div className="metric-value">{summary.avgScore}/100</div>
          </div>
          <div className="metric">
            <div className="metric-label">Qualified Leads</div>
            <div className="metric-value">{summary.qualified}</div>
          </div>
        </div>

        <div className="charts-grid">
          <PieChart data={statusBreakdown} title="Leads by Status" />
          <PieChart data={sourceBreakdown} title="Leads by Source" />
          <PieChart data={channelCounts} title="Outreach by Channel" />
        </div>
      </div>

      <style jsx>{`
        .page { max-width: 1200px; margin: 0 auto; padding: 32px 24px; }
        .title { font-family: var(--font-display); font-size: 1.9rem; font-weight: 800; margin-bottom: 20px; }
        .filters { display: flex; gap: 10px; margin-bottom: 28px; flex-wrap: wrap; }
        .filter-btn {
          padding: 8px 16px; border: 1.5px solid var(--line); border-radius: 9px;
          font-weight: 600; font-size: 0.9rem; background: transparent; color: var(--ink);
          transition: all 0.16s; cursor: pointer;
        }
        .filter-btn:hover { border-color: var(--accent); color: var(--accent); }
        .filter-btn.active { background: var(--accent); color: white; border-color: var(--accent); }
        .summary-grid {
          display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 20px; margin-bottom: 28px;
        }
        .metrics-grid {
          display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 16px; margin-bottom: 28px;
        }
        .metric {
          background: var(--surface-strong); border-radius: var(--radius-lg); padding: 20px;
          border: 1.5px solid var(--line);
        }
        .metric-label { font-size: 0.85rem; color: var(--muted); font-weight: 600; }
        .metric-value { font-size: 1.6rem; font-weight: 800; color: var(--accent); margin-top: 8px; }
        .charts-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 24px; }
      `}</style>
    </div>
  );
}
