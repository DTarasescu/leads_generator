import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabase";
import { API_BASE } from "../lib/api-utils";
import Nav from "../components/Nav";
import { useToast } from "../components/ToastProvider";

const STATUSES = ["all", "new", "contacted", "qualified", "converted", "rejected"];
const STATUS_COLORS = {
  new: { bg: "#ede9fe", text: "#5b21b6" },
  contacted: { bg: "#dbeafe", text: "#1e40af" },
  qualified: { bg: "#d1fae5", text: "#065f46" },
  converted: { bg: "#dcfce7", text: "#14532d" },
  rejected: { bg: "#fee2e2", text: "#991b1b" },
};
const SOURCE_COLORS = {
  discovery: { bg: "#fef9c3", text: "#854d0e" },
  inbound: { bg: "#d1fae5", text: "#065f46" },
  typeform: { bg: "#dbeafe", text: "#1e40af" },
  jotform: { bg: "#e0e7ff", text: "#3730a3" },
  manual: { bg: "#f3f4f6", text: "#374151" },
};

function Badge({ text, colors }) {
  return (
    <span className="badge" style={{ background: colors?.bg || "#f3f4f6", color: colors?.text || "#374151" }}>
      {text}
      <style jsx>{`.badge { display: inline-block; padding: 2px 10px; border-radius: 20px; font-size: 0.8rem; font-weight: 700; }`}</style>
    </span>
  );
}

function LeadCard({ lead, token, onUpdated }) {
  const { showToast } = useToast();
  const [message, setMessage] = useState(lead.outreach_message || "");
  const [generating, setGenerating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [showMsgBox, setShowMsgBox] = useState(false);
  const [emailTo, setEmailTo] = useState(lead.email || "");
  const [showEmail, setShowEmail] = useState(false);
  const [sending, setSending] = useState(false);

  async function handleGenerate() {
    setGenerating(true);
    try {
      const r = await fetch(`${API_BASE}/api/generate-message`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: lead.name, business_type: lead.business_type,
          city: lead.city, country: lead.country, website: lead.website,
        }),
      });
      const d = await r.json();
      if (d.message) { setMessage(d.message); setShowMsgBox(true); }
      else showToast("Could not generate message", { type: "error" });
    } catch { showToast("Network error", { type: "error" }); }
    finally { setGenerating(false); }
  }

  async function handleStatusChange(e) {
    const status = e.target.value;
    setUpdating(true);
    try {
      await fetch(`${API_BASE}/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      });
      onUpdated?.();
    } catch { showToast("Update failed", { type: "error" }); }
    finally { setUpdating(false); }
  }

  async function handleSaveMessage() {
    await fetch(`${API_BASE}/api/leads/${lead.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ outreach_message: message }),
    });
    showToast("Message saved", { type: "success" });
  }

  async function handleSendEmail() {
    setSending(true);
    try {
      const r = await fetch(`${API_BASE}/api/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ to: emailTo, subject: "A quick message for you", message, leadId: lead.id }),
      });
      const d = await r.json();
      if (r.ok) { showToast("Email sent!", { type: "success" }); setShowEmail(false); onUpdated?.(); }
      else showToast(d.error || "Send failed", { type: "error" });
    } catch { showToast("Network error", { type: "error" }); }
    finally { setSending(false); }
  }

  const waPhone = (lead.phone || "").replace(/\D/g, "");
  const waUrl = waPhone
    ? `https://wa.me/${waPhone}${message ? `?text=${encodeURIComponent(message)}` : ""}`
    : null;

  return (
    <div className="card">
      <div className="card-top">
        <div>
          <div className="lead-name">{lead.name}</div>
          <div className="lead-meta">
            {lead.business_type && <span>{lead.business_type}</span>}
            {lead.city && <span> · {lead.city}{lead.country ? `, ${lead.country}` : ""}</span>}
          </div>
          <div className="contact-info">
            {lead.email && <span>✉️ {lead.email}</span>}
            {lead.phone && <span>📞 {lead.phone}</span>}
            {lead.website && <a href={lead.website} target="_blank" rel="noreferrer">🌐 Site</a>}
          </div>
        </div>
        <div className="badges">
          <Badge text={lead.status} colors={STATUS_COLORS[lead.status]} />
          <Badge text={lead.source || "manual"} colors={SOURCE_COLORS[lead.source] || SOURCE_COLORS.manual} />
          {lead.ai_score != null && (
            <Badge
              text={`AI ${lead.ai_score}`}
              colors={lead.ai_score >= 70 ? { bg: "#dcfce7", text: "#166534" } : lead.ai_score >= 40 ? { bg: "#fef9c3", text: "#854d0e" } : { bg: "#fee2e2", text: "#991b1b" }}
            />
          )}
        </div>
      </div>

      {lead.ai_score_reason && <div className="score-reason">🤖 {lead.ai_score_reason}</div>}

      {showMsgBox && (
        <div className="msg-area">
          <textarea
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <button className="btn-sm" onClick={handleSaveMessage}>💾 Save</button>
        </div>
      )}

      {showEmail && (
        <div className="email-area">
          <input
            type="email"
            placeholder="Recipient email"
            value={emailTo}
            onChange={(e) => setEmailTo(e.target.value)}
          />
          <button className="btn-sm btn-primary" onClick={handleSendEmail} disabled={sending}>
            {sending ? "Sending…" : "📤 Send Email"}
          </button>
        </div>
      )}

      <div className="actions">
        <button className="btn-outline" onClick={handleGenerate} disabled={generating}>
          {generating ? "…" : "✍️ Message"}
        </button>
        {waUrl && (
          <a href={waUrl} target="_blank" rel="noreferrer" className="btn-outline">💬 WA</a>
        )}
        {lead.email && (
          <button className="btn-outline" onClick={() => { setShowEmail(!showEmail); if (!showEmail && !message) handleGenerate(); }}>
            ✉️ Email
          </button>
        )}
        <select value={lead.status} onChange={handleStatusChange} disabled={updating} className="status-sel">
          {STATUSES.filter((s) => s !== "all").map((s) => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
      </div>

      <div className="card-footer">
        <span>{new Date(lead.created_at).toLocaleDateString()}</span>
        {lead.last_contacted_at && (
          <span>Last contact: {new Date(lead.last_contacted_at).toLocaleDateString()}</span>
        )}
      </div>

      <style jsx>{`
        .card {
          background: var(--surface-strong);
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-md);
          padding: 20px;
          border: 1.5px solid var(--line);
        }
        .card-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 10px; }
        .lead-name { font-family: var(--font-display); font-weight: 700; font-size: 1.05rem; color: var(--ink); }
        .lead-meta { font-size: 0.85rem; color: var(--accent); font-weight: 600; margin-top: 2px; }
        .contact-info { display: flex; flex-wrap: wrap; gap: 10px; font-size: 0.83rem; color: var(--muted); margin-top: 6px; }
        .contact-info a { color: var(--accent); }
        .badges { display: flex; flex-wrap: wrap; gap: 6px; flex-shrink: 0; }
        .score-reason { font-size: 0.82rem; color: var(--muted); margin-bottom: 10px; }
        .msg-area { margin: 12px 0; }
        .msg-area textarea {
          width: 100%; border: 1.5px solid var(--line); border-radius: 10px;
          padding: 10px 12px; font-size: 0.9rem; font-family: var(--font-body);
          resize: vertical; background: var(--canvas); color: var(--ink);
          margin-bottom: 6px; box-sizing: border-box;
        }
        .email-area { margin: 12px 0; display: flex; gap: 8px; align-items: center; }
        .email-area input {
          flex: 1; padding: 9px 13px; border: 1.5px solid var(--line);
          border-radius: 9px; font-size: 0.9rem; background: var(--canvas); color: var(--ink);
        }
        .actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; align-items: center; }
        .btn-outline {
          padding: 7px 13px; border: 1.5px solid var(--line); border-radius: 9px;
          font-size: 0.87rem; font-weight: 600; background: transparent;
          color: var(--ink); transition: all 0.16s; text-decoration: none;
        }
        .btn-outline:hover { border-color: var(--accent); color: var(--accent); }
        .btn-sm {
          padding: 7px 12px; border-radius: 8px; font-size: 0.85rem; font-weight: 600;
          background: var(--surface); border: 1.5px solid var(--line); color: var(--ink);
        }
        .btn-primary { background: var(--accent); color: white; border-color: var(--accent); }
        .status-sel {
          padding: 7px 10px; border: 1.5px solid var(--line); border-radius: 9px;
          font-size: 0.87rem; background: var(--canvas); color: var(--ink); cursor: pointer;
        }
        .card-footer { display: flex; justify-content: space-between; font-size: 0.78rem; color: var(--muted); margin-top: 12px; }
      `}</style>
    </div>
  );
}

export default function LeadsInboxPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [user, setUser] = useState(null);
  const [token, setToken] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const PAGE_SIZE = 20;

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace("/"); return; }
      setUser(session.user);
      setToken(session.access_token);
    });
  }, [router]);

  const fetchLeads = useCallback(async (pg = 1, tab = activeTab, q = search) => {
    if (!token) return;
    setLoading(true);
    const params = new URLSearchParams({ page: pg, limit: PAGE_SIZE });
    if (tab !== "all") params.set("status", tab);
    if (q.trim()) params.set("search", q.trim());
    try {
      const r = await fetch(`${API_BASE}/api/leads?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await r.json();
      if (r.ok) {
        setLeads(d.leads || []);
        setHasMore((d.leads || []).length === PAGE_SIZE);
      } else { showToast(d.error || "Failed to load leads", { type: "error" }); }
    } catch { showToast("Network error", { type: "error" }); }
    finally { setLoading(false); }
  }, [token, activeTab, search, showToast]);

  useEffect(() => {
    if (token) fetchLeads(page, activeTab, search);
  }, [token, page, activeTab]);

  function handleTabChange(tab) {
    setActiveTab(tab);
    setPage(1);
  }

  function handleSearch(e) {
    e.preventDefault();
    setPage(1);
    fetchLeads(1, activeTab, search);
  }

  async function handleExportCsv() {
    const params = new URLSearchParams({ limit: 1000 });
    if (activeTab !== "all") params.set("status", activeTab);
    const r = await fetch(`${API_BASE}/api/leads?${params}`, { headers: { Authorization: `Bearer ${token}` } });
    const d = await r.json();
    const rows = d.leads || [];
    if (!rows.length) return showToast("No leads to export", { type: "info" });
    const headers = ["name", "email", "phone", "business_type", "city", "country", "status", "source", "ai_score", "created_at"];
    const csv = [
      headers.join(","),
      ...rows.map((l) => headers.map((h) => JSON.stringify(l[h] ?? "")).join(","))
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `leads_${activeTab}_${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  if (!user) return null;

  return (
    <div>
      <Nav user={user} />
      <div className="page">
        <div className="page-top">
          <h1 className="title">📋 Leads Pipeline</h1>
          <button className="btn-export" onClick={handleExportCsv}>⬇️ Export CSV</button>
        </div>

        <div className="tabs">
          {STATUSES.map((s) => (
            <button
              key={s}
              className={`tab ${activeTab === s ? "active" : ""}`}
              onClick={() => handleTabChange(s)}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        <form onSubmit={handleSearch} className="search-row">
          <input
            placeholder="Search by name, email, city…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="submit" className="btn-search">Search</button>
        </form>

        {loading && (
          <div className="skel-list">
            {[...Array(4)].map((_, i) => <div key={i} className="skel" />)}
          </div>
        )}

        {!loading && leads.length === 0 && (
          <div className="empty">
            {activeTab === "all" && !search.trim() ? "No leads yet — discover some or share your capture page!" : "No leads match this filter."}
          </div>
        )}

        <div className="list">
          {leads.map((lead) => (
            <LeadCard key={lead.id} lead={lead} token={token} onUpdated={() => fetchLeads(page, activeTab, search)} />
          ))}
        </div>

        {(page > 1 || hasMore) && (
          <div className="pagination">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="btn-page">← Prev</button>
            <span className="pg-label">Page {page}</span>
            <button onClick={() => setPage((p) => p + 1)} disabled={!hasMore} className="btn-page">Next →</button>
          </div>
        )}
      </div>

      <style jsx>{`
        .page { max-width: 900px; margin: 0 auto; padding: 32px 24px; }
        .page-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
        .title { font-family: var(--font-display); font-size: 1.9rem; font-weight: 800; }
        .btn-export {
          padding: 9px 18px; border: 1.5px solid var(--line); border-radius: 9px;
          font-weight: 700; font-size: 0.9rem; background: transparent; color: var(--ink);
          transition: all 0.16s;
        }
        .btn-export:hover { border-color: var(--accent); color: var(--accent); }
        .tabs { display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 20px; }
        .tab {
          padding: 8px 16px; border-radius: 9px; font-weight: 600; font-size: 0.9rem;
          background: transparent; border: 1.5px solid var(--line); color: var(--muted);
          transition: all 0.16s;
        }
        .tab.active { background: var(--accent); color: white; border-color: var(--accent); }
        .tab:hover:not(.active) { border-color: var(--accent); color: var(--accent); }
        .search-row { display: flex; gap: 10px; margin-bottom: 24px; }
        .search-row input {
          flex: 1; padding: 10px 14px; border: 1.5px solid var(--line);
          border-radius: 10px; font-size: 0.95rem; background: var(--canvas); color: var(--ink);
        }
        .btn-search {
          padding: 10px 20px; background: var(--accent); color: white;
          border-radius: 10px; font-weight: 700; font-size: 0.95rem;
        }
        .skel-list { display: flex; flex-direction: column; gap: 16px; }
        .skel {
          height: 100px; border-radius: var(--radius-lg);
          background: linear-gradient(90deg, #e0d9ff 0%, #f0ecff 50%, #e0d9ff 100%);
          background-size: 200% 100%;
          animation: shimmer 1.4s infinite;
        }
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        .empty { text-align: center; color: var(--muted); padding: 60px; font-size: 1.05rem; }
        .list { display: flex; flex-direction: column; gap: 16px; }
        .pagination { display: flex; justify-content: center; align-items: center; gap: 20px; margin-top: 32px; }
        .btn-page {
          padding: 9px 18px; border: 1.5px solid var(--line); border-radius: 9px;
          font-weight: 600; background: transparent; color: var(--ink);
          transition: all 0.16s;
        }
        .btn-page:disabled { opacity: 0.4; cursor: not-allowed; }
        .btn-page:hover:not(:disabled) { border-color: var(--accent); color: var(--accent); }
        .pg-label { color: var(--muted); font-size: 0.9rem; }
      `}</style>
    </div>
  );
}
