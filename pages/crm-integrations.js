import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabase";
import { API_BASE } from "../lib/api-utils";
import Nav from "../components/Nav";
import { useToast } from "../components/ToastProvider";

const CRM_TYPES = {
  pipedrive: {
    name: "Pipedrive",
    logo: "🔵",
    color: "#2ECC71",
    doc: "https://developers.pipedrive.com/docs/api/v1",
  },
  hubspot: {
    name: "HubSpot",
    logo: "🟠",
    color: "#FF6B35",
    doc: "https://developers.hubspot.com/docs/crm/apis/overview",
  },
  salesforce: {
    name: "Salesforce",
    logo: "☁️",
    color: "#00A1DE",
    doc: "https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/",
  },
};

function CRMCard({ crm, config, onConnect, onDisconnect, isLoading }) {
  const { name, logo, color } = CRM_TYPES[crm] || {};
  const isConnected = config?.is_active;

  return (
    <div
      style={{
        border: `2px solid ${isConnected ? color : "var(--line)"}`,
        borderRadius: "12px",
        padding: "20px",
        marginBottom: "16px",
        background: isConnected ? `${color}15` : "transparent",
        transition: "all 0.2s",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
        <div style={{ fontSize: "2rem", marginRight: "12px" }}>{logo}</div>
        <div style={{ flex: 1 }}>
          <h3 style={{ margin: "0 0 4px 0", color: "var(--ink)" }}>{name}</h3>
          <span style={{ fontSize: "0.85rem", color: isConnected ? color : "var(--line)" }}>
            {isConnected ? `✓ Connected (${config?.crm_type})` : "Not connected"}
          </span>
        </div>
        <button
          onClick={() => (isConnected ? onDisconnect(crm) : onConnect(crm))}
          disabled={isLoading}
          style={{
            padding: "8px 16px",
            background: isConnected ? "#F56565" : color,
            color: "white",
            border: "none",
            borderRadius: "8px",
            fontWeight: "600",
            cursor: isLoading ? "wait" : "pointer",
            opacity: isLoading ? 0.6 : 1,
          }}
        >
          {isLoading ? "Loading…" : isConnected ? "Disconnect" : "Connect"}
        </button>
      </div>

      {isConnected && config && (
        <div style={{ fontSize: "0.9rem", color: "var(--line)", marginTop: "12px", padding: "12px", background: "var(--bg2)", borderRadius: "8px" }}>
          <div>
            <strong>CRM Type:</strong> {config.crm_type}
          </div>
          <div>
            <strong>Last Sync:</strong> {config.last_synced_at ? new Date(config.last_synced_at).toLocaleString() : "Never"}
          </div>
          <div>
            <strong>Auto Sync:</strong> {config.auto_sync ? "Enabled" : "Disabled"}
          </div>
        </div>
      )}
    </div>
  );
}

function SyncHistoryModal({ isOpen, crmType, onClose }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !crmType) return;
    fetchHistory();
  }, [isOpen, crmType]);

  async function fetchHistory() {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const r = await fetch(`${API_BASE}/api/crm-sync-history?crm_type=${crmType}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (r.ok) {
        const json = await r.json();
        setHistory(json.history || []);
      }
    } catch (err) {
      console.error("Failed to fetch sync history:", err);
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "var(--bg)",
          borderRadius: "12px",
          padding: "24px",
          maxWidth: "600px",
          maxHeight: "70vh",
          overflow: "auto",
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ marginTop: 0 }}>Sync History - {CRM_TYPES[crmType]?.name}</h2>
        {loading ? (
          <div>Loading…</div>
        ) : history.length === 0 ? (
          <div style={{ color: "var(--line)" }}>No sync history yet</div>
        ) : (
          <div>
            {history.map((item, idx) => (
              <div
                key={idx}
                style={{
                  padding: "12px",
                  marginBottom: "8px",
                  background: "var(--bg2)",
                  borderRadius: "8px",
                  fontSize: "0.9rem",
                }}
              >
                <div>
                  <strong>{new Date(item.synced_at).toLocaleString()}</strong>
                </div>
                <div>Leads Synced: {item.leads_count}</div>
                <div>Status: {item.status}</div>
                {item.error && <div style={{ color: "#F56565" }}>Error: {item.error}</div>}
              </div>
            ))}
          </div>
        )}
        <button
          onClick={onClose}
          style={{
            marginTop: "16px",
            padding: "8px 16px",
            background: "var(--accent)",
            color: "white",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
}

export default function CRMIntegrationPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [user, setUser] = useState(null);
  const [configs, setConfigs] = useState({});
  const [loading, setLoading] = useState({});
  const [selectedCRM, setSelectedCRM] = useState(null);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return router.push("/");
      setUser(session.user);
      fetchConfigs();
    };
    checkAuth();
  }, [router]);

  async function fetchConfigs() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const r = await fetch(`${API_BASE}/api/crm-integrations`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (r.ok) {
        const json = await r.json();
        const byType = {};
        (json.integrations || []).forEach((config) => {
          byType[config.crm_type] = config;
        });
        setConfigs(byType);
      }
    } catch (err) {
      console.error("Failed to fetch CRM configs:", err);
    }
  }

  async function handleConnect(crmType) {
    setLoading((prev) => ({ ...prev, [crmType]: true }));
    try {
      // Redirect to OAuth or API key modal based on CRM
      if (crmType === "pipedrive") {
        window.location.href = `/api/crm-oauth?provider=pipedrive&redirect=${encodeURIComponent(window.location.href)}`;
      } else if (crmType === "hubspot") {
        window.location.href = `/api/crm-oauth?provider=hubspot&redirect=${encodeURIComponent(window.location.href)}`;
      } else if (crmType === "salesforce") {
        window.location.href = `/api/crm-oauth?provider=salesforce&redirect=${encodeURIComponent(window.location.href)}`;
      }
    } catch (err) {
      showToast("Connection failed: " + err.message, { type: "error" });
    } finally {
      setLoading((prev) => ({ ...prev, [crmType]: false }));
    }
  }

  async function handleDisconnect(crmType) {
    if (!confirm(`Disconnect ${CRM_TYPES[crmType]?.name}?`)) return;

    setLoading((prev) => ({ ...prev, [crmType]: true }));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const r = await fetch(`${API_BASE}/api/crm-integrations?crm_type=${crmType}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (r.ok) {
        setConfigs((prev) => {
          const next = { ...prev };
          delete next[crmType];
          return next;
        });
        showToast(`${CRM_TYPES[crmType]?.name} disconnected`, { type: "success" });
      } else {
        showToast("Failed to disconnect", { type: "error" });
      }
    } catch (err) {
      showToast("Error: " + err.message, { type: "error" });
    } finally {
      setLoading((prev) => ({ ...prev, [crmType]: false }));
    }
  }

  return (
    <>
      <Nav />
      <main style={{ maxWidth: "900px", margin: "0 auto", padding: "40px 20px" }}>
        <h1>CRM Integration</h1>
        <p style={{ color: "var(--line)", marginBottom: "40px" }}>
          Connect your CRM to sync leads automatically. Supports Pipedrive, HubSpot, and Salesforce.
        </p>

        <div>
          {Object.keys(CRM_TYPES).map((crmType) => (
            <CRMCard
              key={crmType}
              crm={crmType}
              config={configs[crmType]}
              onConnect={handleConnect}
              onDisconnect={handleDisconnect}
              isLoading={loading[crmType]}
            />
          ))}
        </div>

        <div style={{ marginTop: "40px", padding: "20px", background: "var(--bg2)", borderRadius: "12px" }}>
          <h3>📚 Documentation</h3>
          <ul style={{ marginLeft: "20px" }}>
            <li>
              <strong>Pipedrive:</strong> REST API, OAuth 2.0. Free for SMBs.{" "}
              <a href="https://developers.pipedrive.com/docs/api/v1" target="_blank" rel="noreferrer">
                Docs
              </a>
            </li>
            <li>
              <strong>HubSpot:</strong> GraphQL + REST APIs. Free tier available.{" "}
              <a href="https://developers.hubspot.com/docs/crm/apis/overview" target="_blank" rel="noreferrer">
                Docs
              </a>
            </li>
            <li>
              <strong>Salesforce:</strong> OAuth 2.0, REST/SOAP APIs. Enterprise-grade.{" "}
              <a href="https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/" target="_blank" rel="noreferrer">
                Docs
              </a>
            </li>
          </ul>
        </div>

        <SyncHistoryModal
          isOpen={!!selectedCRM}
          crmType={selectedCRM}
          onClose={() => setSelectedCRM(null)}
        />
      </main>

      <style jsx>{`
        main {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          color: var(--ink);
        }
        h1 {
          font-size: 2.2rem;
          font-weight: 700;
          margin: 0 0 8px 0;
        }
        h3 {
          margin-top: 0;
        }
        a {
          color: var(--accent);
          text-decoration: none;
          font-weight: 600;
        }
        a:hover {
          text-decoration: underline;
        }
      `}</style>
    </>
  );
}
