import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabase";
import { API_BASE } from "../lib/api-utils";
import Nav from "../components/Nav";
import { useToast } from "../components/ToastProvider";

function Tab({ label, active, onClick }) {
  return (
    <button className={`tab ${active ? "active" : ""}`} onClick={onClick}>
      {label}
      <style jsx>{`
        .tab {
          padding: 10px 18px; border-radius: 9px; font-weight: 600; font-size: 0.92rem;
          background: transparent; border: 1.5px solid var(--line); color: var(--ink);
          transition: all 0.16s; cursor: pointer; margin-right: 8px;
        }
        .tab:hover { border-color: var(--accent); color: var(--accent); }
        .tab.active { background: var(--accent); color: white; border-color: var(--accent); }
      `}</style>
    </button>
  );
}

function TemplatesList({ type, templates, onAdd, onDelete, token }) {
  const [newName, setNewName] = useState("");
  const [newBody, setNewBody] = useState("");
  const [creating, setCreating] = useState(false);
  const { showToast } = useToast();

  async function handleCreate() {
    if (!newName.trim() || !newBody.trim()) return;
    setCreating(true);
    try {
      const body = {
        name: newName,
        body: newBody,
        variables: [],
      };
      if (type === "email") body.subject_line = newName;

      const r = await fetch(`${API_BASE}/api/templates/${type}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (r.ok) {
        setNewName("");
        setNewBody("");
        onAdd?.();
        showToast("Template created", { type: "success" });
      } else showToast("Failed to create", { type: "error" });
    } catch {
      showToast("Network error", { type: "error" });
    } finally {
      setCreating(false);
    }
  }

  return (
    <div>
      <h3>Create {type === "email" ? "Email" : "SMS"} Template</h3>
      <div style={{ marginBottom: "20px" }}>
        <input
          placeholder="Template name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          style={{ marginBottom: "10px", display: "block", width: "100%", padding: "8px", border: "1px solid var(--line)", borderRadius: "8px" }}
        />
        <textarea
          placeholder="Message body (use {{name}}, {{business_type}}, {{city}}, {{email}} for variables)"
          value={newBody}
          onChange={(e) => setNewBody(e.target.value)}
          rows={5}
          style={{ width: "100%", padding: "8px", border: "1px solid var(--line)", borderRadius: "8px", fontFamily: "monospace" }}
        />
        <button onClick={handleCreate} disabled={creating} style={{ marginTop: "10px", padding: "8px 16px", background: "var(--accent)", color: "white", border: "none", borderRadius: "8px", fontWeight: "700" }}>
          {creating ? "Creating…" : "Create Template"}
        </button>
      </div>

      <h3>Existing Templates</h3>
      {templates?.length === 0 ? (
        <p style={{ color: "var(--muted)" }}>No templates yet</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {templates.map((t) => (
            <li key={t.id} style={{ padding: "12px", background: "var(--surface)", borderRadius: "8px", marginBottom: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong>{t.name}</strong>
              <button
                onClick={() => onDelete?.(t.id)}
                style={{
                  background: "var(--error)",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  padding: "6px 12px",
                  cursor: "pointer",
                }}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function AutomationPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [user, setUser] = useState(null);
  const [token, setToken] = useState("");
  const [activeTab, setActiveTab] = useState("templates");
  const [emailTemplates, setEmailTemplates] = useState([]);
  const [smsTemplates, setSmsTemplates] = useState([]);
  const [crmIntegrations, setCrmIntegrations] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [loadingCrm, setLoadingCrm] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace("/"); return; }
      setUser(session.user);
      setToken(session.access_token);
    });
  }, [router]);

  useEffect(() => {
    if (!token) return;

    setLoadingTemplates(true);
    Promise.all([
      fetch(`${API_BASE}/api/templates/email`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      fetch(`${API_BASE}/api/templates/sms`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
    ]).then(([e, s]) => {
      setEmailTemplates(e.templates || []);
      setSmsTemplates(s.templates || []);
    }).finally(() => setLoadingTemplates(false));

    setLoadingCrm(true);
    fetch(`${API_BASE}/api/crm-integrations`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => setCrmIntegrations(d.integrations || []))
      .finally(() => setLoadingCrm(false));
  }, [token]);

  async function handleDeleteTemplate(id, type) {
    const r = await fetch(`${API_BASE}/api/templates/${type}?id=${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (r.ok) {
      if (type === "email") setEmailTemplates(emailTemplates.filter((t) => t.id !== id));
      else setSmsTemplates(smsTemplates.filter((t) => t.id !== id));
      showToast("Deleted", { type: "success" });
    } else showToast("Failed to delete", { type: "error" });
  }

  if (!user) return null;

  return (
    <div>
      <Nav user={user} />
      <div className="page">
        <h1 className="title">⚙️ Automation & Settings</h1>

        <div className="tabs-row">
          <Tab label="📧 Email Templates" active={activeTab === "templates-email"} onClick={() => setActiveTab("templates-email")} />
          <Tab label="💬 SMS Templates" active={activeTab === "templates-sms"} onClick={() => setActiveTab("templates-sms")} />
          <Tab label="🔗 CRM Integrations" active={activeTab === "crm"} onClick={() => setActiveTab("crm")} />
          <Tab label="⭐ Scoring Rules" active={activeTab === "scoring"} onClick={() => setActiveTab("scoring")} />
        </div>

        <div className="content">
          {activeTab === "templates-email" && !loadingTemplates && (
            <TemplatesList type="email" templates={emailTemplates} onAdd={() => {}} onDelete={(id) => handleDeleteTemplate(id, "email")} token={token} />
          )}

          {activeTab === "templates-sms" && !loadingTemplates && (
            <TemplatesList type="sms" templates={smsTemplates} onAdd={() => {}} onDelete={(id) => handleDeleteTemplate(id, "sms")} token={token} />
          )}

          {activeTab === "crm" && !loadingCrm && (
            <div>
              <h3>Connected CRM Systems</h3>
              {crmIntegrations?.length === 0 ? (
                <p style={{ color: "var(--muted)" }}>No CRM integrations yet. Configure one below.</p>
              ) : (
                <ul style={{ listStyle: "none", padding: 0 }}>
                  {crmIntegrations.map((crm) => (
                    <li key={crm.id} style={{ padding: "12px", background: "var(--surface)", borderRadius: "8px", marginBottom: "8px" }}>
                      <strong>{crm.crm_type.toUpperCase()}</strong> {crm.is_active ? "✓ Active" : "✗ Inactive"}
                      {crm.last_synced_at && <div style={{ fontSize: "0.85rem", color: "var(--muted)" }}>Last synced: {new Date(crm.last_synced_at).toLocaleString()}</div>}
                    </li>
                  ))}
                </ul>
              )}
              <h3 style={{ marginTop: "20px" }}>Add CRM Integration</h3>
              <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
                Coming soon: UI to connect Pipedrive, HubSpot, and Salesforce. For now, use the API:
              </p>
              <code style={{ background: "var(--surface)", padding: "12px", borderRadius: "8px", display: "block", marginTop: "10px", fontSize: "0.8rem", overflow: "auto" }}>
                POST /api/crm-integrations {"\n"}
                {"{ crm_type, api_key, workspace_id?, org_id? }"}
              </code>
            </div>
          )}

          {activeTab === "scoring" && (
            <div>
              <h3>Lead Scoring Rules</h3>
              <p style={{ color: "var(--muted)" }}>
                Configure custom scoring rules to automatically score leads based on business type, location, reviews, ratings, and website presence.
              </p>
              <p style={{ color: "var(--muted)", fontSize: "0.9rem", marginTop: "10px" }}>
                Coming soon: UI to manage rules. Use the API:
              </p>
              <code style={{ background: "var(--surface)", padding: "12px", borderRadius: "8px", display: "block", marginTop: "10px", fontSize: "0.8rem", overflow: "auto" }}>
                POST /api/lead-scoring-rules {"\n"}
                {"{ rule_type, condition_value, score_adjustment }"}
              </code>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .page { max-width: 900px; margin: 0 auto; padding: 32px 24px; }
        .title { font-family: var(--font-display); font-size: 1.9rem; font-weight: 800; margin-bottom: 28px; }
        .tabs-row { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 28px; }
        .content { background: var(--surface-strong); border-radius: var(--radius-lg); padding: 24px; box-shadow: var(--shadow-md); }
        h3 { font-size: 1.1rem; font-weight: 700; margin-top: 20px; margin-bottom: 12px; }
        h3:first-child { margin-top: 0; }
      `}</style>
    </div>
  );
}
