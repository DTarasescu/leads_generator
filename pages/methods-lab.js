import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabase";
import { API_BASE } from "../lib/api-utils";
import Nav from "../components/Nav";
import { useToast } from "../components/ToastProvider";

const HISTORY_STORAGE_KEY = "methods-lab-history";
const PRESETS_STORAGE_KEY = "methods-lab-presets";
const BATCH_DELAY_MS = 800;

const METHODS = [
  {
    key: "googleReviews",
    title: "Google Reviews Alerts",
    endpoint: "/api/google-reviews-alerts",
    defaultPayload: {
      query: "dentist",
      location: "Bucharest, RO",
      min_reviews: 10,
      max_rating: 3.9,
      limit: 20,
    },
  },
  {
    key: "pressRelease",
    title: "Press Release Monitor",
    endpoint: "/api/press-release-monitor",
    defaultPayload: {
      query: "startup funding OR expansion OR hiring",
      country: "us",
      max: 15,
    },
  },
  {
    key: "crunchbaseFunding",
    title: "Crunchbase Funding",
    endpoint: "/api/crunchbase-funding",
    defaultPayload: {
      limit: 20,
      min_funding_usd: 1000000,
    },
  },
  {
    key: "whoisExpiry",
    title: "WHOIS Expiry Leads",
    endpoint: "/api/whois-expiry-leads",
    defaultPayload: {
      domains: ["example.com", "smallbiz.ro"],
      max_days: 45,
    },
  },
  {
    key: "linkedinHiring",
    title: "LinkedIn Hiring Signals",
    endpoint: "/api/linkedin-hiring-signals",
    defaultPayload: {
      jobs: [
        {
          company_name: "Growth Co",
          role_title: "Sales Manager",
          city: "Cluj",
          country: "RO",
          industry: "SaaS",
          company_website: "https://growthco.example",
        },
      ],
    },
  },
  {
    key: "tiktokAds",
    title: "TikTok Business Discovery",
    endpoint: "/api/tiktok-business-discovery",
    defaultPayload: {
      advertisers: [
        {
          name: "Trend Shop",
          handle: "trendshop",
          website: "https://trendshop.example",
          country: "RO",
          business_type: "Ecommerce",
        },
      ],
    },
  },
  {
    key: "zapierIngest",
    title: "Zapier Webhook",
    endpoint: "/api/zapier-webhook",
    defaultPayload: {
      owner_email: "",
      name: "Zapier Sample Lead",
      business_type: "Agency",
      city: "Bucharest",
      country: "RO",
      source: "zapier",
    },
  },
  {
    key: "makeIngest",
    title: "Make Webhook",
    endpoint: "/api/make-webhook",
    defaultPayload: {
      owner_email: "",
      name: "Make Sample Lead",
      business_type: "SaaS",
      city: "Timisoara",
      country: "RO",
      source: "make",
    },
  },
  {
    key: "chromeCapture",
    title: "Chrome Extension Capture",
    endpoint: "/api/chrome-extension-capture",
    defaultPayload: {
      name: "Captured from browser",
      business_type: "Local Business",
      city: "Sibiu",
      country: "RO",
      page_title: "Lead Candidate",
      page_url: "https://example.com",
    },
  },
  {
    key: "redditMonitor",
    title: "Reddit Buying Signals",
    endpoint: "/api/reddit-monitor",
    defaultPayload: {
      subreddits: ["entrepreneur", "smallbusiness", "marketing", "startups"],
      keywords: ["need a website", "looking for developer", "hire designer", "recommend an agency"],
      limit: 25,
    },
  },
  {
    key: "yelpDiscover",
    title: "Yelp Local Discovery",
    endpoint: "/api/yelp-discover",
    defaultPayload: {
      term: "dentist",
      location: "Chicago, IL",
      radius: 10000,
      limit: 20,
      sort_by: "rating",
    },
  },
  {
    key: "productHunt",
    title: "Product Hunt Launches",
    endpoint: "/api/product-hunt-leads",
    defaultPayload: {
      topics: ["saas", "marketing", "productivity"],
      days_ago: 7,
      min_votes: 50,
      limit: 20,
    },
  },
  {
    key: "jobBoardLeads",
    title: "Job Board Signals",
    endpoint: "/api/job-board-leads",
    defaultPayload: {
      roles: ["marketing manager", "head of growth", "sales director"],
      location: "us",
      limit: 20,
    },
  },
  {
    key: "companyNews",
    title: "Company News Monitor",
    endpoint: "/api/company-news",
    defaultPayload: {
      company_names: ["Stripe", "Notion", "Linear", "Vercel"],
      news_types: ["funding", "hiring", "expansion"],
    },
  },
  {
    key: "socialDiscovery",
    title: "Social Media Discovery",
    endpoint: "/api/social-discovery",
    defaultPayload: {
      keywords: ["need marketing help", "growing startup", "B2B SaaS"],
      platform: "twitter",
      min_followers: 100,
    },
  },
  {
    key: "emailEnrichment",
    title: "Email Enrichment",
    endpoint: "/api/email-enrichment",
    defaultPayload: {
      emails: ["founder@example.com", "ceo@startupco.io"],
    },
  },
  {
    key: "leadListBuilder",
    title: "Lead List Builder",
    endpoint: "/api/lead-list-builder",
    defaultPayload: {
      list_name: "High-Score New Leads",
      filters: {
        status: "new",
        score_min: 60,
      },
      limit: 100,
    },
  },
  {
    key: "redditSignals",
    title: "Reddit Signal Monitor",
    endpoint: "/api/reddit-signal-monitor",
    defaultPayload: {
      subreddits: ["smallbusiness", "entrepreneur", "startups", "SaaS"],
      keywords: ["need help", "looking for", "struggling with", "recommend"],
      limit: 20,
      save_leads: true,
    },
  },
  {
    key: "competitorAnalysis",
    title: "Competitor Analysis",
    endpoint: "/api/competitor-analysis",
    defaultPayload: {
      competitor_url: "https://competitor.com",
      your_strengths: ["faster onboarding", "better pricing", "local support"],
    },
  },
];

function initPayloads(userEmail) {
  const out = {};
  for (const method of METHODS) {
    out[method.key] = JSON.stringify(
      {
        ...method.defaultPayload,
        owner_email: method.defaultPayload.owner_email === "" ? userEmail || "" : method.defaultPayload.owner_email,
      },
      null,
      2
    );
  }
  return out;
}

export default function MethodsLabPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [user, setUser] = useState(null);
  const [token, setToken] = useState("");
  const [payloads, setPayloads] = useState({});
  const [active, setActive] = useState(METHODS[0].key);
  const [running, setRunning] = useState("");
  const [history, setHistory] = useState([]);
  const [presets, setPresets] = useState({});
  const [presetName, setPresetName] = useState("");
  const [selected, setSelected] = useState(() => Object.fromEntries(METHODS.map((m) => [m.key, false])));
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchSummary, setBatchSummary] = useState(null);
  const importInputRef = useRef(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace("/");
        return;
      }
      setUser(session.user);
      setToken(session.access_token);

      const hydrated = initPayloads(session.user?.email || "");
      setPayloads(hydrated);

      const saved = localStorage.getItem(HISTORY_STORAGE_KEY);
      if (saved) {
        try {
          setHistory(JSON.parse(saved));
        } catch {
          setHistory([]);
        }
      }

      const savedPresets = localStorage.getItem(PRESETS_STORAGE_KEY);
      if (savedPresets) {
        try {
          const parsed = JSON.parse(savedPresets);
          if (parsed && typeof parsed === "object") setPresets(parsed);
        } catch {
          setPresets({});
        }
      }
    });
  }, [router]);

  const activeMethod = useMemo(() => METHODS.find((m) => m.key === active), [active]);
  const selectedMethods = useMemo(() => METHODS.filter((m) => selected[m.key]), [selected]);

  function updatePayload(nextText) {
    setPayloads((prev) => ({ ...prev, [active]: nextText }));
  }

  function appendHistory(entry) {
    setHistory((prev) => {
      const next = [entry, ...prev].slice(0, 40);
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  async function executeMethod(method, options = {}) {
    const { showToastOnSuccess = true, showToastOnError = true } = options;
    if (!method || !token) return { ok: false, status: 0, error: "Unauthorized" };

    let body;
    try {
      body = JSON.parse(payloads[method.key] || "{}");
    } catch {
      if (showToastOnError) showToast("Payload is not valid JSON", { type: "error" });
      return { ok: false, status: 0, error: "Invalid JSON payload" };
    }

    const startedAt = new Date().toISOString();

    try {
      const response = await fetch(`${API_BASE}${method.endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      let data = null;
      try {
        data = await response.json();
      } catch {
        data = { raw: "Non-JSON response" };
      }

      const preview = JSON.stringify(data).slice(0, 280);
      appendHistory({
        id: `${startedAt}-${method.key}`,
        at: startedAt,
        title: method.title,
        endpoint: method.endpoint,
        status: response.status,
        ok: response.ok,
        preview,
      });

      if (response.ok) {
        if (showToastOnSuccess) showToast(`${method.title} completed`, { type: "success" });
      } else if (showToastOnError) {
        showToast(`${method.title} failed (${response.status})`, { type: "error" });
      }

      return { ok: response.ok, status: response.status, data };
    } catch {
      appendHistory({
        id: `${startedAt}-${method.key}`,
        at: startedAt,
        title: method.title,
        endpoint: method.endpoint,
        status: 0,
        ok: false,
        preview: "Network error",
      });
      if (showToastOnError) showToast("Network error", { type: "error" });
      return { ok: false, status: 0, error: "Network error" };
    }
  }

  function persistPresets(nextPresets) {
    setPresets(nextPresets);
    localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(nextPresets));
  }

  function savePreset() {
    if (!activeMethod) return;
    const name = presetName.trim();
    if (!name) {
      showToast("Preset name is required", { type: "error" });
      return;
    }

    try {
      JSON.parse(payloads[activeMethod.key] || "{}");
    } catch {
      showToast("Cannot save invalid JSON payload", { type: "error" });
      return;
    }

    const current = presets[activeMethod.key] || [];
    const next = {
      ...presets,
      [activeMethod.key]: [
        { name, payload: payloads[activeMethod.key], savedAt: new Date().toISOString() },
        ...current.filter((x) => x.name !== name),
      ].slice(0, 20),
    };
    persistPresets(next);
    showToast(`Preset saved: ${name}`, { type: "success" });
    setPresetName("");
  }

  function loadPreset(name) {
    if (!activeMethod) return;
    const entries = presets[activeMethod.key] || [];
    const match = entries.find((x) => x.name === name);
    if (!match) return;
    setPayloads((prev) => ({ ...prev, [activeMethod.key]: match.payload }));
    showToast(`Preset loaded: ${name}`, { type: "info" });
  }

  function deletePreset(name) {
    if (!activeMethod) return;
    const entries = presets[activeMethod.key] || [];
    const next = {
      ...presets,
      [activeMethod.key]: entries.filter((x) => x.name !== name),
    };
    persistPresets(next);
    showToast(`Preset deleted: ${name}`, { type: "info" });
  }

  async function runCurrent() {
    if (!activeMethod || !token) return;

    setRunning(activeMethod.key);
    try {
      await executeMethod(activeMethod, { showToastOnSuccess: true, showToastOnError: true });
    } finally {
      setRunning("");
    }
  }

  async function runSelectedBatch() {
    if (!selectedMethods.length) {
      showToast("Select at least one method", { type: "error" });
      return;
    }

    setBatchRunning(true);
    setBatchSummary(null);

    const summary = {
      total: selectedMethods.length,
      ok: 0,
      failed: 0,
      items: [],
    };

    for (let i = 0; i < selectedMethods.length; i += 1) {
      const method = selectedMethods[i];
      setRunning(method.key);
      const result = await executeMethod(method, {
        showToastOnSuccess: false,
        showToastOnError: false,
      });

      if (result.ok) summary.ok += 1;
      else summary.failed += 1;
      summary.items.push({ key: method.key, title: method.title, ok: result.ok, status: result.status });

      if (i < selectedMethods.length - 1) {
        // Simple fixed delay prevents request bursts to external APIs.
        // eslint-disable-next-line no-await-in-loop
        await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
      }
    }

    setRunning("");
    setBatchRunning(false);
    setBatchSummary(summary);

    if (summary.failed === 0) showToast(`Batch finished: ${summary.ok}/${summary.total} succeeded`, { type: "success" });
    else showToast(`Batch finished: ${summary.ok} success, ${summary.failed} failed`, { type: "info" });
  }

  function exportPresets() {
    try {
      const json = JSON.stringify(presets, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `methods-lab-presets-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast("Presets exported", { type: "success" });
    } catch {
      showToast("Failed to export presets", { type: "error" });
    }
  }

  function openImportDialog() {
    importInputRef.current?.click();
  }

  async function importPresetsFromFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== "object") throw new Error("Invalid format");

      const cleaned = {};
      for (const method of METHODS) {
        const rows = Array.isArray(parsed[method.key]) ? parsed[method.key] : [];
        cleaned[method.key] = rows
          .filter((row) => row && typeof row.name === "string" && typeof row.payload === "string")
          .map((row) => ({
            name: row.name,
            payload: row.payload,
            savedAt: row.savedAt || new Date().toISOString(),
          }))
          .slice(0, 20);
      }

      persistPresets(cleaned);
      showToast("Presets imported", { type: "success" });
    } catch {
      showToast("Invalid presets file", { type: "error" });
    } finally {
      event.target.value = "";
    }
  }

  function toggleSelect(key) {
    setSelected((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function selectAll() {
    setSelected(Object.fromEntries(METHODS.map((m) => [m.key, true])));
  }

  function selectNone() {
    setSelected(Object.fromEntries(METHODS.map((m) => [m.key, false])));
  }

  function resetCurrent() {
    if (!activeMethod) return;
    const text = JSON.stringify(
      {
        ...activeMethod.defaultPayload,
        owner_email:
          activeMethod.defaultPayload.owner_email === ""
            ? user?.email || ""
            : activeMethod.defaultPayload.owner_email,
      },
      null,
      2
    );
    setPayloads((prev) => ({ ...prev, [activeMethod.key]: text }));
  }

  const activePresets = activeMethod ? presets[activeMethod.key] || [] : [];

  if (!user) return null;

  return (
    <div>
      <Nav user={user} />
      <main className="page">
        <header className="hero">
          <h1>Methods Lab</h1>
          <p>Run every lead-generation method with editable JSON payloads and keep a local execution history.</p>
        </header>

        <section className="workspace">
          <aside className="methods">
            <div className="batch-controls">
              <button className="ghost" onClick={selectAll}>Select all</button>
              <button className="ghost" onClick={selectNone}>Select none</button>
              <button className="run" onClick={runSelectedBatch} disabled={batchRunning || selectedMethods.length === 0}>
                {batchRunning ? "Running batch..." : `Run selected (${selectedMethods.length})`}
              </button>
            </div>
            {METHODS.map((method) => (
              <div key={method.key} className={`method-item ${active === method.key ? "active" : ""}`}>
                <input
                  type="checkbox"
                  checked={!!selected[method.key]}
                  onChange={() => toggleSelect(method.key)}
                />
                <button
                  className={`method-btn ${active === method.key ? "active" : ""}`}
                  onClick={() => setActive(method.key)}
                >
                  <span>{method.title}</span>
                  <small>{method.endpoint}</small>
                </button>
              </div>
            ))}
          </aside>

          <section className="editor">
            <div className="editor-head">
              <h2>{activeMethod?.title}</h2>
              <div className="actions">
                <button onClick={resetCurrent} className="ghost">Reset Payload</button>
                <button onClick={runCurrent} disabled={running === activeMethod?.key} className="run">
                  {running === activeMethod?.key ? "Running..." : "Run Method"}
                </button>
              </div>
            </div>
            <div className="preset-row">
              <input
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                placeholder="Preset name"
              />
              <button className="ghost" onClick={savePreset}>Save Preset</button>
              <button className="ghost" onClick={exportPresets}>Export</button>
              <button className="ghost" onClick={openImportDialog}>Import</button>
              <input
                ref={importInputRef}
                type="file"
                accept="application/json,.json"
                onChange={importPresetsFromFile}
                style={{ display: "none" }}
              />
            </div>
            {activePresets.length > 0 && (
              <div className="preset-list">
                {activePresets.map((item) => (
                  <div key={item.name} className="preset-item">
                    <button className="pill" onClick={() => loadPreset(item.name)}>{item.name}</button>
                    <button className="mini-delete" onClick={() => deletePreset(item.name)}>x</button>
                  </div>
                ))}
              </div>
            )}
            <p className="endpoint">Endpoint: {activeMethod?.endpoint}</p>
            <textarea
              value={payloads[activeMethod?.key] || ""}
              onChange={(e) => updatePayload(e.target.value)}
              rows={22}
              spellCheck={false}
            />
          </section>
        </section>

        <section className="history">
          <div className="history-head">
            <h2>Run History</h2>
            <button
              className="ghost"
              onClick={() => {
                localStorage.removeItem(HISTORY_STORAGE_KEY);
                setHistory([]);
              }}
            >
              Clear
            </button>
          </div>

          {history.length === 0 ? (
            <p className="muted">No runs yet.</p>
          ) : (
            <div className="history-list">
              {history.map((item) => (
                <article key={item.id} className={`history-item ${item.ok ? "ok" : "fail"}`}>
                  <div className="line1">
                    <strong>{item.title}</strong>
                    <span>{item.status === 0 ? "network" : `HTTP ${item.status}`}</span>
                  </div>
                  <div className="line2">{new Date(item.at).toLocaleString()} - {item.endpoint}</div>
                  <pre>{item.preview}</pre>
                </article>
              ))}
            </div>
          )}
        </section>
        {batchSummary && (
          <section className="history">
            <div className="history-head">
              <h2>Last Batch Summary</h2>
            </div>
            <p className="muted">{batchSummary.ok} succeeded, {batchSummary.failed} failed, total {batchSummary.total}</p>
            <div className="history-list">
              {batchSummary.items.map((item) => (
                <article key={item.key} className={`history-item ${item.ok ? "ok" : "fail"}`}>
                  <div className="line1">
                    <strong>{item.title}</strong>
                    <span>{item.status === 0 ? "network" : `HTTP ${item.status}`}</span>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
      </main>

      <style jsx>{`
        .page {
          max-width: 1200px;
          margin: 0 auto;
          padding: 28px 20px 60px;
        }
        .hero {
          background: radial-gradient(circle at 20% 15%, #0f766e 0%, #0f172a 70%);
          color: #f8fffd;
          border-radius: 16px;
          padding: 24px;
          box-shadow: 0 16px 30px rgba(15, 118, 110, 0.24);
          margin-bottom: 14px;
        }
        .hero h1 {
          margin: 0;
          font-size: clamp(1.7rem, 2.1vw, 2.25rem);
        }
        .hero p {
          margin: 8px 0 0;
          max-width: 74ch;
          opacity: 0.95;
        }
        .workspace {
          display: grid;
          grid-template-columns: 280px 1fr;
          gap: 12px;
        }
        .methods,
        .editor,
        .history {
          background: #ffffff;
          border: 1px solid #dbe7e5;
          border-radius: 14px;
          box-shadow: 0 10px 26px rgba(2, 6, 23, 0.06);
        }
        .methods {
          padding: 10px;
          display: grid;
          gap: 8px;
          align-content: start;
          max-height: 680px;
          overflow: auto;
        }
        .batch-controls {
          display: grid;
          gap: 6px;
          padding: 8px;
          border: 1px solid #d4dee2;
          border-radius: 10px;
          background: #f8fafc;
        }
        .method-item {
          display: grid;
          grid-template-columns: auto 1fr;
          gap: 8px;
          align-items: center;
          border: 1px solid transparent;
          border-radius: 10px;
          padding: 4px;
        }
        .method-item.active {
          border-color: #ccfbf1;
          background: #f0fdfa;
        }
        .method-btn {
          border: 1px solid #d4dee2;
          background: #f8fafc;
          color: #0f172a;
          border-radius: 10px;
          padding: 10px;
          text-align: left;
          display: grid;
          gap: 4px;
        }
        .method-btn small {
          color: #64748b;
          font-size: 0.74rem;
        }
        .method-btn.active {
          border-color: #0f766e;
          background: #ecfeff;
        }
        .editor {
          padding: 14px;
        }
        .editor-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
        }
        .editor-head h2 {
          margin: 0;
          font-size: 1.05rem;
        }
        .endpoint {
          margin: 5px 0 10px;
          color: #64748b;
          font-size: 0.84rem;
        }
        .preset-row {
          margin-top: 10px;
          display: flex;
          gap: 8px;
        }
        .preset-row input {
          flex: 1;
          border: 1px solid #d4dee2;
          border-radius: 9px;
          padding: 8px 10px;
          font-size: 0.85rem;
        }
        .preset-list {
          margin-top: 8px;
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .preset-item {
          display: inline-flex;
          align-items: center;
          border: 1px solid #d4dee2;
          border-radius: 999px;
          background: #f8fafc;
        }
        .pill {
          border: none;
          background: transparent;
          color: #0f766e;
          font-size: 0.78rem;
          font-weight: 700;
          padding: 5px 10px;
        }
        .mini-delete {
          border: none;
          background: transparent;
          color: #64748b;
          font-size: 0.78rem;
          font-weight: 700;
          padding: 5px 8px;
          cursor: pointer;
        }
        textarea {
          width: 100%;
          border: 1px solid #d4dee2;
          border-radius: 10px;
          padding: 10px;
          font-family: "Consolas", "Courier New", monospace;
          font-size: 0.86rem;
          resize: vertical;
          background: #f8fafc;
          color: #0f172a;
        }
        .actions {
          display: flex;
          gap: 8px;
        }
        .ghost,
        .run {
          border-radius: 9px;
          padding: 8px 11px;
          font-size: 0.84rem;
          font-weight: 700;
        }
        .ghost {
          border: 1px solid #cbd5e1;
          background: #fff;
          color: #334155;
        }
        .run {
          border: 1px solid #0f766e;
          background: #0f766e;
          color: #fff;
        }
        .run:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }
        .history {
          margin-top: 12px;
          padding: 14px;
        }
        .history-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .history-head h2 {
          margin: 0;
          font-size: 1.05rem;
        }
        .muted {
          color: #64748b;
        }
        .history-list {
          margin-top: 8px;
          display: grid;
          gap: 8px;
        }
        .history-item {
          border: 1px solid #d4dee2;
          border-left-width: 4px;
          border-radius: 10px;
          padding: 9px 10px;
          background: #f8fafc;
        }
        .history-item.ok {
          border-left-color: #16a34a;
        }
        .history-item.fail {
          border-left-color: #dc2626;
        }
        .line1 {
          display: flex;
          justify-content: space-between;
          font-size: 0.88rem;
        }
        .line2 {
          margin-top: 2px;
          color: #64748b;
          font-size: 0.78rem;
        }
        pre {
          margin: 7px 0 0;
          white-space: pre-wrap;
          word-break: break-word;
          font-size: 0.76rem;
          color: #0f172a;
          background: #fff;
          border-radius: 8px;
          padding: 8px;
          border: 1px solid #e2e8f0;
        }
        @media (max-width: 960px) {
          .workspace {
            grid-template-columns: 1fr;
          }
          .methods {
            max-height: none;
          }
        }
      `}</style>
    </div>
  );
}
