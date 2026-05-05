import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabase";
import Nav from "../components/Nav";

const stages = [
  {
    title: "1) Discover & Capture",
    steps: [
      "Find leads from directories, ads, social, and webhooks",
      "Normalize basic profile fields",
      "Store with source tags for attribution",
    ],
  },
  {
    title: "2) Enrich & Qualify",
    steps: [
      "Enrich company and contact context",
      "Score each lead with rules + AI",
      "Prioritize by urgency and fit",
    ],
  },
  {
    title: "3) Engage & Convert",
    steps: [
      "Generate personalized outreach",
      "Run email, SMS, WhatsApp, and voice sequences",
      "Track outcomes, sync CRM, and optimize with A/B tests",
    ],
  },
];

const methods = [
  "Google Places + Geo Targeting",
  "Yelp Business Discovery",
  "Reddit Buying-Signal Monitor",
  "Job Board Hiring Signals",
  "Product Hunt Startup Leads",
  "Press Release Monitor",
  "Crunchbase Funding Signals",
  "Google Reviews Alerts",
  "Trustpilot Risk Signals",
  "WHOIS Expiry Opportunities",
  "Zapier Lead Webhook",
  "Make.com Lead Webhook",
  "Chrome Extension Lead Capture",
  "Chat Widget Lead Capture",
  "Facebook / Google Ads / Calendly / Stripe Webhooks",
];

export default function PipelinePlaybookPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace("/");
        return;
      }
      setUser(session.user);
    });
  }, [router]);

  if (!user) return null;

  return (
    <div>
      <Nav user={user} />
      <main className="page">
        <header className="hero">
          <h1>Pipeline Playbook</h1>
          <p>
            End-to-end operating model for how leads are found, qualified, and converted in the app.
          </p>
        </header>

        <section className="grid">
          {stages.map((stage) => (
            <article key={stage.title} className="card">
              <h2>{stage.title}</h2>
              <ul>
                {stage.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ul>
            </article>
          ))}
        </section>

        <section className="catalog">
          <h2>Lead Generation Methods Active or Ready</h2>
          <div className="pill-grid">
            {methods.map((item) => (
              <span className="pill" key={item}>{item}</span>
            ))}
          </div>
        </section>
      </main>

      <style jsx>{`
        .page {
          max-width: 1120px;
          margin: 0 auto;
          padding: 28px 20px 64px;
        }
        .hero {
          background: linear-gradient(130deg, #0f766e 0%, #155e75 100%);
          border-radius: 18px;
          color: #f6fffe;
          padding: 28px;
          box-shadow: 0 16px 40px rgba(15, 118, 110, 0.26);
        }
        .hero h1 {
          margin: 0;
          font-size: clamp(1.7rem, 2vw, 2.3rem);
        }
        .hero p {
          margin: 10px 0 0;
          opacity: 0.96;
          max-width: 70ch;
        }
        .grid {
          margin-top: 20px;
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 14px;
        }
        .card {
          background: #ffffff;
          border: 1px solid #dbe7e5;
          border-radius: 14px;
          padding: 16px;
          box-shadow: 0 6px 24px rgba(17, 24, 39, 0.06);
        }
        .card h2 {
          margin: 0 0 8px;
          font-size: 1.06rem;
          color: #0f172a;
        }
        .card ul {
          margin: 0;
          padding-left: 18px;
          color: #334155;
          line-height: 1.55;
        }
        .catalog {
          margin-top: 22px;
          background: #fff;
          border: 1px solid #dbe7e5;
          border-radius: 14px;
          padding: 16px;
        }
        .catalog h2 {
          margin: 0 0 12px;
          color: #0f172a;
          font-size: 1.06rem;
        }
        .pill-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .pill {
          font-size: 0.85rem;
          border-radius: 999px;
          border: 1px solid #a7f3d0;
          background: #ecfeff;
          color: #0f766e;
          padding: 7px 11px;
          font-weight: 600;
        }
      `}</style>
    </div>
  );
}
