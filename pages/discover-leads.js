import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabase";
import { API_BASE } from "../lib/api-utils";
import Nav from "../components/Nav";
import { useToast } from "../components/ToastProvider";

const RADIUS_OPTIONS = [
  { label: "5 km", value: 5000 },
  { label: "10 km", value: 10000 },
  { label: "25 km", value: 25000 },
  { label: "50 km", value: 50000 },
];

function ScoreBadge({ score }) {
  if (score == null) return <span className="badge grey">Scoring…</span>;
  const color = score >= 70 ? "green" : score >= 40 ? "yellow" : "red";
  return <span className={`badge ${color}`}>{score}/100</span>;
}

function LeadCard({ lead, token, onAdded }) {
  const { showToast } = useToast();
  const [score, setScore] = useState(null);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [generating, setGenerating] = useState(false);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/api/score-lead`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(lead),
    })
      .then((r) => r.json())
      .then((d) => { setScore(d.score); setReason(d.reason); })
      .catch(() => { setScore(50); setReason("Scoring unavailable"); });
  }, [lead, token]);

  async function handleGenerate() {
    setGenerating(true);
    try {
      const r = await fetch(`${API_BASE}/api/generate-message`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: lead.business_name,
          business_type: lead.business_type,
          city: lead.city,
          country: lead.country,
          website: lead.website,
        }),
      });
      const d = await r.json();
      if (d.message) setMessage(d.message);
      else showToast("Could not generate message", { type: "error" });
    } catch {
      showToast("Network error", { type: "error" });
    } finally {
      setGenerating(false);
    }
  }

  async function handleAdd() {
    setAdding(true);
    try {
      const r = await fetch(`${API_BASE}/api/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...lead, name: lead.business_name, ai_score: score, ai_score_reason: reason, source: "discovery" }),
      });
      const d = await r.json();
      if (r.status === 409) { showToast("Already in your pipeline", { type: "info" }); }
      else if (r.ok) { setAdded(true); showToast("Added to pipeline!", { type: "success" }); onAdded?.(); }
      else showToast(d.error || "Failed to add", { type: "error" });
    } catch {
      showToast("Network error", { type: "error" });
    } finally {
      setAdding(false);
    }
  }

  const waUrl = lead.phone
    ? `https://wa.me/${lead.phone.replace(/\D/g, "")}${message ? `?text=${encodeURIComponent(message)}` : ""}`
    : null;

  return (
    <div className={`card ${added ? "added" : ""}`}>
      <div className="card-head">
        <div>
          <div className="biz-name">{lead.business_name}</div>
          <div className="biz-meta">
            {lead.business_type} · {lead.city}{lead.country ? `, ${lead.country}` : ""}
          </div>
          {lead.address && <div className="biz-addr">{lead.address}</div>}
        </div>
        <div className="score-area">
          <ScoreBadge score={score} />
          {reason && <div className="score-reason">{reason}</div>}
        </div>
      </div>

      <div className="card-info">
        {lead.phone && <span>📞 {lead.phone}</span>}
        {lead.website && <a href={lead.website} target="_blank" rel="noreferrer">🌐 Website</a>}
        {lead.google_rating != null && (
          <span>⭐ {lead.google_rating} ({lead.google_review_count} reviews)</span>
        )}
      </div>

      {message && (
        <div className="msg-box">
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} />
        </div>
      )}

      <div className="card-actions">
        <button onClick={handleGenerate} disabled={generating} className="btn-outline">
          {generating ? "Generating…" : "✍️ Message"}
        </button>
        {waUrl && (
          <a href={waUrl} target="_blank" rel="noreferrer" className="btn-outline">
            💬 WhatsApp
          </a>
        )}
        <button
          onClick={handleAdd}
          disabled={adding || added}
          className={`btn-add ${added ? "added" : ""}`}
        >
          {added ? "✓ In Pipeline" : adding ? "Adding…" : "+ Pipeline"}
        </button>
      </div>

      <style jsx>{`
        .card {
          background: var(--surface-strong);
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-md);
          padding: 20px;
          border: 1.5px solid var(--line);
          transition: border-color 0.2s;
        }
        .card.added { border-color: var(--success); }
        .card-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 10px; }
        .biz-name { font-family: var(--font-display); font-weight: 700; font-size: 1.05rem; color: var(--ink); }
        .biz-meta { font-size: 0.85rem; color: var(--accent); font-weight: 600; margin-top: 2px; }
        .biz-addr { font-size: 0.82rem; color: var(--muted); margin-top: 2px; }
        .score-area { text-align: right; flex-shrink: 0; }
        .score-reason { font-size: 0.78rem; color: var(--muted); margin-top: 4px; max-width: 140px; }
        .card-info { display: flex; flex-wrap: wrap; gap: 12px; font-size: 0.85rem; color: var(--muted); margin-bottom: 12px; }
        .card-info a { color: var(--accent); }
        .msg-box textarea {
          width: 100%; border: 1.5px solid var(--line); border-radius: 10px;
          padding: 10px 12px; font-size: 0.9rem; font-family: var(--font-body);
          resize: vertical; background: var(--canvas); color: var(--ink);
          margin-bottom: 10px;
        }
        .card-actions { display: flex; flex-wrap: wrap; gap: 8px; }
        .btn-outline {
          padding: 8px 14px; border: 1.5px solid var(--line); border-radius: 9px;
          font-size: 0.88rem; font-weight: 600; background: transparent;
          color: var(--ink); transition: all 0.16s; text-decoration: none;
        }
        .btn-outline:hover { border-color: var(--accent); color: var(--accent); }
        .btn-add {
          padding: 8px 16px; border-radius: 9px; font-size: 0.88rem; font-weight: 700;
          background: var(--accent); color: white; border: none; transition: opacity 0.16s;
        }
        .btn-add:hover:not(:disabled) { opacity: 0.85; }
        .btn-add:disabled { opacity: 0.6; cursor: not-allowed; }
        .btn-add.added { background: var(--success); }
      `}</style>
    </div>
  );
}

export default function DiscoverLeadsPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [user, setUser] = useState(null);
  const [token, setToken] = useState("");
  const [form, setForm] = useState({ businessType: "", city: "", country: "", radius: 10000 });
  const [leads, setLeads] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace("/"); return; }
      setUser(session.user);
      setToken(session.access_token);
    });
  }, [router]);

  async function handleSearch(e) {
    e.preventDefault();
    if (!form.businessType.trim() || !form.city.trim()) {
      return showToast("Business type and city are required", { type: "error" });
    }
    setSearching(true);
    setLeads([]);
    setSearched(false);
    try {
      const r = await fetch(`${API_BASE}/api/discover-leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      const d = await r.json();
      if (!r.ok) return showToast(d.error || "Search failed", { type: "error" });
      setLeads(d.leads || []);
      setSearched(true);
      if (!d.leads?.length) showToast("No leads found — try a broader radius", { type: "info" });
    } catch {
      showToast("Network error", { type: "error" });
    } finally {
      setSearching(false);
    }
  }

  if (!user) return null;

  return (
    <div>
      <Nav user={user} />
      <div className="page">
        <h1 className="title">🔍 Discover New Leads</h1>
        <p className="sub">Search local businesses by type and location. AI scores each one for outreach potential.</p>

        <form onSubmit={handleSearch} className="search-form">
          <input
            placeholder="Business type (e.g. hair salon, dentist, gym)"
            value={form.businessType}
            onChange={(e) => setForm({ ...form, businessType: e.target.value })}
            required
          />
          <input
            placeholder="City"
            value={form.city}
            onChange={(e) => setForm({ ...form, city: e.target.value })}
            required
          />
          <input
            placeholder="Country (optional)"
            value={form.country}
            onChange={(e) => setForm({ ...form, country: e.target.value })}
          />
          <select value={form.radius} onChange={(e) => setForm({ ...form, radius: Number(e.target.value) })}>
            {RADIUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <button type="submit" className="btn-search" disabled={searching}>
            {searching ? "Searching…" : "Search"}
          </button>
        </form>

        {searching && (
          <div className="skel-grid">
            {[...Array(6)].map((_, i) => <div key={i} className="skel" />)}
          </div>
        )}

        {!searching && searched && leads.length === 0 && (
          <div className="empty">No leads found. Try a broader radius or different business type.</div>
        )}

        {!searching && leads.length > 0 && (
          <div className="results-header">Found {leads.length} leads — scoring with AI…</div>
        )}

        <div className="grid">
          {leads.map((lead) => (
            <LeadCard key={lead.google_place_id} lead={lead} token={token} />
          ))}
        </div>
      </div>

      <style jsx>{`
        .page { max-width: 1100px; margin: 0 auto; padding: 32px 24px; }
        .title { font-family: var(--font-display); font-size: 1.9rem; font-weight: 800; margin-bottom: 8px; }
        .sub { color: var(--muted); margin-bottom: 28px; }
        .search-form {
          display: flex; flex-wrap: wrap; gap: 12px; align-items: center;
          background: var(--surface-strong); border-radius: var(--radius-lg);
          padding: 20px; margin-bottom: 32px;
          box-shadow: var(--shadow-md);
        }
        .search-form input, .search-form select {
          flex: 1; min-width: 160px;
          padding: 11px 14px;
          border: 1.5px solid var(--line); border-radius: 10px;
          font-size: 0.95rem; background: var(--canvas); color: var(--ink);
        }
        .btn-search {
          padding: 11px 28px; background: var(--accent); color: white;
          border-radius: 10px; font-weight: 700; font-size: 0.97rem;
          transition: opacity 0.16s;
        }
        .btn-search:disabled { opacity: 0.6; cursor: not-allowed; }
        .skel-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 20px; }
        .skel {
          height: 180px; border-radius: var(--radius-lg);
          background: linear-gradient(90deg, #e0d9ff 0%, #f0ecff 50%, #e0d9ff 100%);
          background-size: 200% 100%;
          animation: shimmer 1.4s infinite;
        }
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        .empty { text-align: center; color: var(--muted); padding: 48px; font-size: 1.05rem; }
        .results-header { color: var(--muted); font-size: 0.93rem; margin-bottom: 20px; }
        .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 20px; }
      `}</style>

      <style jsx global>{`
        .badge {
          display: inline-block; padding: 3px 10px; border-radius: 20px;
          font-size: 0.82rem; font-weight: 700;
        }
        .badge.green  { background: #dcfce7; color: #166534; }
        .badge.yellow { background: #fef9c3; color: #854d0e; }
        .badge.red    { background: #fee2e2; color: #991b1b; }
        .badge.grey   { background: #f3f4f6; color: #6b7280; }
      `}</style>
    </div>
  );
}
