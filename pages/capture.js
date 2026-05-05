import Head from "next/head";
import { useState } from "react";
import { API_BASE } from "../lib/api-utils";

const HEADLINE = process.env.NEXT_PUBLIC_CAPTURE_HEADLINE || "Grow Your Business with AI-Powered Outreach";
const DESCRIPTION = process.env.NEXT_PUBLIC_CAPTURE_DESCRIPTION || "Get a free consultation on how to attract more clients using smart automation.";

export default function CapturePage() {
  const [form, setForm] = useState({ name: "", email: "", phone: "", business_type: "", city: "" });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [serverError, setServerError] = useState("");

  function validate() {
    const e = {};
    if (!form.name.trim() || form.name.trim().length < 2) e.name = "Name is required";
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Valid email is required";
    if (!form.business_type.trim() || form.business_type.trim().length < 2) e.business_type = "Business type is required";
    if (!form.city.trim() || form.city.trim().length < 2) e.city = "City is required";
    return e;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setServerError("");
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setSubmitting(true);
    try {
      const r = await fetch(`${API_BASE}/api/capture-lead`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const d = await r.json();
      if (r.ok) { setDone(true); }
      else { setServerError(d.error || "Something went wrong. Please try again."); }
    } catch {
      setServerError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Head>
        <title>{HEADLINE}</title>
        <meta name="description" content={DESCRIPTION} />
        <meta property="og:title" content={HEADLINE} />
        <meta property="og:description" content={DESCRIPTION} />
        {process.env.NEXT_PUBLIC_CAPTURE_OG_IMAGE && (
          <meta property="og:image" content={process.env.NEXT_PUBLIC_CAPTURE_OG_IMAGE} />
        )}
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="wrapper">
        <div className="card">
          <div className="logo">🚀</div>
          <h1 className="headline">{HEADLINE}</h1>
          <p className="desc">{DESCRIPTION}</p>

          {done ? (
            <div className="success">
              <div className="success-icon">✅</div>
              <h2>Thank you!</h2>
              <p>We&apos;ve received your details and will be in touch shortly.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate>
              <div className="field">
                <label>Full Name *</label>
                <input
                  type="text"
                  placeholder="Jane Smith"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className={errors.name ? "err" : ""}
                  autoComplete="name"
                />
                {errors.name && <div className="field-err">{errors.name}</div>}
              </div>

              <div className="field">
                <label>Business Email *</label>
                <input
                  type="email"
                  placeholder="jane@yourbusiness.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className={errors.email ? "err" : ""}
                  autoComplete="email"
                />
                {errors.email && <div className="field-err">{errors.email}</div>}
              </div>

              <div className="field">
                <label>Phone Number</label>
                <input
                  type="tel"
                  placeholder="+40 712 345 678"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  autoComplete="tel"
                />
              </div>

              <div className="field">
                <label>Type of Business *</label>
                <input
                  type="text"
                  placeholder="e.g. Hair Salon, Dentist, Gym"
                  value={form.business_type}
                  onChange={(e) => setForm({ ...form, business_type: e.target.value })}
                  className={errors.business_type ? "err" : ""}
                />
                {errors.business_type && <div className="field-err">{errors.business_type}</div>}
              </div>

              <div className="field">
                <label>City *</label>
                <input
                  type="text"
                  placeholder="e.g. Bucharest"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  className={errors.city ? "err" : ""}
                  autoComplete="address-level2"
                />
                {errors.city && <div className="field-err">{errors.city}</div>}
              </div>

              {serverError && <div className="server-err">{serverError}</div>}

              <button type="submit" className="submit-btn" disabled={submitting}>
                {submitting ? "Sending…" : "Get My Free Consultation →"}
              </button>

              <p className="privacy">
                We respect your privacy. No spam, ever. Unsubscribe at any time.
              </p>
            </form>
          )}
        </div>
      </div>

      <style jsx>{`
        .wrapper {
          min-height: 100vh;
          background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a78bfa 100%);
          display: flex; align-items: center; justify-content: center;
          padding: 32px 16px;
          font-family: 'Inter', system-ui, sans-serif;
        }
        .card {
          background: white; border-radius: 20px;
          box-shadow: 0 25px 60px rgba(0,0,0,0.2);
          max-width: 480px; width: 100%;
          padding: 44px 40px;
        }
        .logo { font-size: 2.4rem; margin-bottom: 12px; }
        .headline {
          font-family: 'Space Grotesk', system-ui, sans-serif;
          font-size: 1.75rem; font-weight: 800;
          color: #1e1b4b; line-height: 1.25; margin-bottom: 10px;
        }
        .desc { color: #64748b; margin-bottom: 28px; line-height: 1.6; }
        .field { margin-bottom: 18px; }
        .field label { display: block; font-size: 0.88rem; font-weight: 600; color: #374151; margin-bottom: 6px; }
        .field input {
          width: 100%; padding: 12px 14px;
          border: 1.5px solid #e5e7eb; border-radius: 10px;
          font-size: 0.97rem; color: #1e1b4b; transition: border-color 0.18s;
          box-sizing: border-box;
        }
        .field input:focus { outline: none; border-color: #6366f1; }
        .field input.err { border-color: #ef4444; }
        .field-err { color: #ef4444; font-size: 0.82rem; margin-top: 5px; }
        .server-err {
          background: #fee2e2; color: #991b1b; padding: 11px 14px;
          border-radius: 8px; font-size: 0.88rem; margin-bottom: 16px;
        }
        .submit-btn {
          width: 100%; padding: 14px;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          color: white; font-size: 1rem; font-weight: 700;
          border-radius: 12px; border: none;
          transition: opacity 0.16s; margin-top: 4px;
        }
        .submit-btn:hover:not(:disabled) { opacity: 0.88; }
        .submit-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .privacy { text-align: center; font-size: 0.8rem; color: #9ca3af; margin-top: 14px; }
        .success { text-align: center; padding: 20px 0; }
        .success-icon { font-size: 3rem; margin-bottom: 12px; }
        .success h2 { font-family: 'Space Grotesk', sans-serif; font-size: 1.5rem; color: #1e1b4b; margin-bottom: 8px; }
        .success p { color: #64748b; line-height: 1.6; }
      `}</style>
    </>
  );
}
