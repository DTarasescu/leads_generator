import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabase";
import Nav from "../components/Nav";

const capabilities = [
  "Discover leads from Google, Yelp, Reddit, Product Hunt, and job boards",
  "Capture inbound leads from forms, chat widget, and ad platform webhooks",
  "Enrich and score leads with AI + rule-based signals",
  "Generate outreach copy and run email, SMS, WhatsApp, and voice campaigns",
  "Track pipeline progress, analytics, CRM sync, and A/B test results",
  "Run advanced lead methods from the Methods Lab with presets and batch execution",
];

const workflow = [
  { title: "1. Discover", text: "Collect qualified prospects from directories, social intent, hiring, funding, and review signals." },
  { title: "2. Qualify", text: "Apply AI scoring, enrichment, and filters to prioritize high-intent opportunities." },
  { title: "3. Engage", text: "Use personalized multichannel outreach and automated sequences." },
  { title: "4. Convert", text: "Track outcomes, sync CRM, optimize with analytics and A/B tests." },
];

export default function AboutPage() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null);
    });
  }, []);

  return (
    <div>
      {user ? (
        <Nav user={user} />
      ) : (
        <header className="public-head">
          <Link href="/" className="brand">Leads Generator</Link>
          <div className="public-links">
            <Link href="/" className="ghost">Sign In</Link>
          </div>
        </header>
      )}

      <main className="page">
        <section className="hero">
          <p className="eyebrow">About The App</p>
          <h1>What Leads Generator Can Do</h1>
          <p className="lead">
            Leads Generator is an AI-powered lead intelligence and outreach platform for service businesses.
            It helps you find better prospects, prioritize them, and convert them faster.
          </p>
          <div className="hero-actions">
            <Link href={user ? "/leads-inbox" : "/"} className="btn-primary">
              {user ? "Open Pipeline" : "Start Using App"}
            </Link>
            <Link href="/methods-lab" className="btn-secondary">Explore Methods Lab</Link>
          </div>
        </section>

        <section className="section">
          <h2>Core Capabilities</h2>
          <div className="cap-grid">
            {capabilities.map((item) => (
              <article key={item} className="cap-item">
                <span className="dot" aria-hidden="true" />
                <p>{item}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section">
          <h2>How The Workflow Operates</h2>
          <div className="flow-grid">
            {workflow.map((step) => (
              <article key={step.title} className="flow-card">
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section callout">
          <h2>Built For Daily Revenue Operations</h2>
          <p>
            Use the Discover page for local prospecting, Methods Lab for advanced sources, and Automation for template-driven outreach.
            Teams can run repeatable playbooks and keep visibility across the full lead lifecycle.
          </p>
        </section>
      </main>

      <style jsx>{`
        .public-head {
          max-width: 1200px;
          margin: 0 auto;
          padding: 16px 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .brand {
          font-weight: 800;
          font-size: 1.02rem;
          color: var(--accent);
          text-decoration: none;
        }
        .public-links {
          display: flex;
          gap: 8px;
        }
        .ghost {
          border: 1px solid var(--line);
          border-radius: 10px;
          padding: 8px 12px;
          color: var(--ink);
          text-decoration: none;
          font-weight: 600;
        }
        .page {
          max-width: 1120px;
          margin: 0 auto;
          padding: 18px 20px 60px;
        }
        .hero {
          background: linear-gradient(120deg, #1d4ed8 0%, #0f766e 100%);
          border-radius: 18px;
          color: #f8fffd;
          padding: 30px;
          box-shadow: 0 20px 40px rgba(15, 118, 110, 0.24);
        }
        .eyebrow {
          font-size: 0.8rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          opacity: 0.9;
          margin-bottom: 8px;
        }
        .hero h1 {
          margin: 0;
          font-size: clamp(1.7rem, 2.2vw, 2.4rem);
        }
        .lead {
          margin-top: 12px;
          max-width: 72ch;
          line-height: 1.55;
          opacity: 0.95;
        }
        .hero-actions {
          margin-top: 18px;
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }
        .btn-primary,
        .btn-secondary {
          border-radius: 10px;
          padding: 10px 14px;
          font-weight: 700;
          text-decoration: none;
        }
        .btn-primary {
          background: #ffffff;
          color: #0f172a;
        }
        .btn-secondary {
          border: 1px solid rgba(255, 255, 255, 0.5);
          color: #f8fffd;
        }
        .section {
          margin-top: 18px;
          background: #ffffff;
          border: 1px solid #dbe7e5;
          border-radius: 14px;
          padding: 18px;
          box-shadow: 0 8px 24px rgba(2, 6, 23, 0.05);
        }
        .section h2 {
          margin: 0 0 10px;
          color: #0f172a;
          font-size: 1.08rem;
        }
        .cap-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
          gap: 10px;
        }
        .cap-item {
          display: flex;
          gap: 8px;
          align-items: flex-start;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 10px;
        }
        .cap-item p {
          margin: 0;
          font-size: 0.9rem;
          color: #1e293b;
          line-height: 1.45;
        }
        .dot {
          width: 8px;
          height: 8px;
          margin-top: 7px;
          border-radius: 999px;
          background: #0f766e;
          flex-shrink: 0;
        }
        .flow-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 10px;
        }
        .flow-card {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 12px;
        }
        .flow-card h3 {
          margin: 0;
          font-size: 0.95rem;
          color: #0f172a;
        }
        .flow-card p {
          margin: 6px 0 0;
          font-size: 0.88rem;
          color: #334155;
          line-height: 1.45;
        }
        .callout p {
          margin: 0;
          color: #334155;
          line-height: 1.55;
        }
      `}</style>
    </div>
  );
}
