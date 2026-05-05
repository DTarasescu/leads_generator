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

const demoSteps = [
  { title: "Sign In", text: "Create an account or sign in, then open your lead inbox." },
  { title: "Discover", text: "Use Discover for local search or Methods Lab for advanced lead sources." },
  { title: "Score + Enrich", text: "Run AI scoring and enrichment to rank the best opportunities first." },
  { title: "Launch Outreach", text: "Send personalized messages via email, SMS, WhatsApp, or voice." },
  { title: "Track & Optimize", text: "Use analytics and A/B tests to improve conversion rates continuously." },
];

const faq = [
  {
    q: "Is this app only for local businesses?",
    a: "No. It supports local and online businesses, including startups, agencies, and service providers.",
  },
  {
    q: "Can I use it before setting every API key?",
    a: "Yes. Core flows work with Supabase and auth. Extra channels become available as you add provider keys.",
  },
  {
    q: "Do I need technical skills to run lead methods?",
    a: "Not much. Discover and Methods Lab provide ready-to-run presets, plus editable payloads for advanced use.",
  },
  {
    q: "Can teams share repeatable method setups?",
    a: "Yes. Methods Lab supports preset export/import so teams can share standardized run configurations.",
  },
];

const plans = [
  {
    name: "Starter",
    subtitle: "Solo operators",
    features: [
      "Lead inbox and manual discovery",
      "Basic AI scoring and message generation",
      "Email outreach templates",
      "Core analytics overview",
    ],
    cta: "Good for first campaigns",
  },
  {
    name: "Growth",
    subtitle: "Small sales teams",
    featured: true,
    features: [
      "All discovery channels + Methods Lab",
      "Batch execution and reusable presets",
      "CRM sync + multi-channel outreach",
      "A/B tests and advanced scoring workflows",
    ],
    cta: "Most balanced setup",
  },
  {
    name: "Scale",
    subtitle: "Revenue operations",
    features: [
      "High-volume automation playbooks",
      "Webhook-heavy inbound pipelines",
      "Cross-team preset sharing",
      "Operational dashboards and optimization loops",
    ],
    cta: "For full-funnel execution",
  },
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

        <section className="section">
          <h2>Quick Demo Walkthrough</h2>
          <div className="demo-grid">
            {demoSteps.map((step, idx) => (
              <article key={step.title} className="demo-step">
                <div className="step-index">{idx + 1}</div>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="section">
          <h2>FAQ</h2>
          <div className="faq-list">
            {faq.map((item) => (
              <details key={item.q} className="faq-item">
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="section">
          <h2>Live Demo Preview</h2>
          <div className="demo-video">
            <div className="video-shell">
              <div className="video-head">Leads Generator Demo</div>
              <div className="video-body">
                <p>
                  Replace this preview with your recorded product walkthrough.
                  Suggested flow: Discover leads, score and prioritize, launch outreach, then review analytics.
                </p>
                <div className="video-actions">
                  <Link href={user ? "/discover-leads" : "/"} className="btn-primary">Open Discover</Link>
                  <Link href="/methods-lab" className="btn-secondary demo-secondary">Open Methods Lab</Link>
                </div>
              </div>
            </div>
            <p className="video-note">
              Tip: swap this block with an embedded video iframe from YouTube, Loom, or your own CDN when ready.
            </p>
          </div>
        </section>

        <section className="section">
          <h2>Plan Comparison</h2>
          <div className="plans-grid">
            {plans.map((plan) => (
              <article key={plan.name} className={`plan-card ${plan.featured ? "featured" : ""}`}>
                <p className="plan-name">{plan.name}</p>
                <p className="plan-subtitle">{plan.subtitle}</p>
                <ul>
                  {plan.features.map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>
                <p className="plan-cta">{plan.cta}</p>
              </article>
            ))}
          </div>
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
        .demo-grid {
          display: grid;
          gap: 8px;
        }
        .demo-step {
          display: grid;
          grid-template-columns: 28px 1fr;
          gap: 10px;
          align-items: start;
          padding: 10px;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          background: #f8fafc;
        }
        .step-index {
          width: 28px;
          height: 28px;
          display: grid;
          place-items: center;
          border-radius: 999px;
          background: #0f766e;
          color: #ffffff;
          font-size: 0.8rem;
          font-weight: 800;
        }
        .demo-step h3 {
          margin: 0;
          font-size: 0.92rem;
          color: #0f172a;
        }
        .demo-step p {
          margin: 4px 0 0;
          font-size: 0.86rem;
          color: #334155;
          line-height: 1.45;
        }
        .faq-list {
          display: grid;
          gap: 8px;
        }
        .faq-item {
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          background: #f8fafc;
          padding: 10px 12px;
        }
        .faq-item summary {
          font-size: 0.9rem;
          font-weight: 700;
          color: #0f172a;
          cursor: pointer;
        }
        .faq-item p {
          margin: 8px 0 0;
          font-size: 0.88rem;
          color: #334155;
          line-height: 1.45;
        }
        .demo-video {
          display: grid;
          gap: 10px;
        }
        .video-shell {
          border: 1px solid #cbd5e1;
          border-radius: 12px;
          overflow: hidden;
          background: #0f172a;
          color: #f8fafc;
        }
        .video-head {
          padding: 8px 12px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.15);
          font-size: 0.82rem;
          letter-spacing: 0.02em;
          text-transform: uppercase;
          opacity: 0.9;
        }
        .video-body {
          padding: 16px;
          min-height: 180px;
          display: grid;
          align-content: center;
          gap: 12px;
        }
        .video-body p {
          margin: 0;
          line-height: 1.5;
          color: #cbd5e1;
        }
        .video-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }
        .demo-secondary {
          border-color: rgba(255, 255, 255, 0.35);
          color: #f8fffd;
        }
        .video-note {
          margin: 0;
          color: #64748b;
          font-size: 0.84rem;
        }
        .plans-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 10px;
        }
        .plan-card {
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 12px;
          background: #f8fafc;
        }
        .plan-card.featured {
          border-color: #0f766e;
          background: #ecfeff;
          box-shadow: inset 0 0 0 1px rgba(15, 118, 110, 0.2);
        }
        .plan-name {
          margin: 0;
          font-size: 1rem;
          font-weight: 800;
          color: #0f172a;
        }
        .plan-subtitle {
          margin: 4px 0 8px;
          color: #64748b;
          font-size: 0.84rem;
        }
        .plan-card ul {
          margin: 0;
          padding-left: 18px;
          display: grid;
          gap: 6px;
        }
        .plan-card li {
          color: #334155;
          font-size: 0.86rem;
          line-height: 1.35;
        }
        .plan-cta {
          margin: 10px 0 0;
          font-size: 0.8rem;
          font-weight: 700;
          color: #0f766e;
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
