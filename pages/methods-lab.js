import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabase";
import { API_BASE } from "../lib/api-utils";
import Nav from "../components/Nav";
import { useToast } from "../components/ToastProvider";

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

      const saved = localStorage.getItem("methods-lab-history");
      if (saved) {
        try {
          setHistory(JSON.parse(saved));
        } catch {
          setHistory([]);
        }
      }
    });
  }, [router]);

  const activeMethod = useMemo(() => METHODS.find((m) => m.key === active), [active]);

  function updatePayload(nextText) {
    setPayloads((prev) => ({ ...prev, [active]: nextText }));
  }

  function appendHistory(entry) {
    setHistory((prev) => {
      const next = [entry, ...prev].slice(0, 40);
      localStorage.setItem("methods-lab-history", JSON.stringify(next));
      return next;
    });
  }

  async function runCurrent() {
    if (!activeMethod || !token) return;

    let body;
    try {
      body = JSON.parse(payloads[activeMethod.key] || "{}");
    } catch {
      showToast("Payload is not valid JSON", { type: "error" });
      return;
    }

    setRunning(activeMethod.key);
    const startedAt = new Date().toISOString();

    try {
      const response = await fetch(`${API_BASE}${activeMethod.endpoint}`, {
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
        id: `${startedAt}-${activeMethod.key}`,
        at: startedAt,
        title: activeMethod.title,
        endpoint: activeMethod.endpoint,
        status: response.status,
        ok: response.ok,
        preview,
      });

      if (response.ok) {
        showToast(`${activeMethod.title} completed`, { type: "success" });
      } else {
        showToast(`${activeMethod.title} failed (${response.status})`, { type: "error" });
      }
    } catch {
      appendHistory({
        id: `${startedAt}-${activeMethod.key}`,
        at: startedAt,
        title: activeMethod.title,
        endpoint: activeMethod.endpoint,
        status: 0,
        ok: false,
        preview: "Network error",
      });
      showToast("Network error", { type: "error" });
    } finally {
      setRunning("");
    }
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
            {METHODS.map((method) => (
              <button
                key={method.key}
                className={`method-btn ${active === method.key ? "active" : ""}`}
                onClick={() => setActive(method.key)}
              >
                <span>{method.title}</span>
                <small>{method.endpoint}</small>
              </button>
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
                localStorage.removeItem("methods-lab-history");
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
