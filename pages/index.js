import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { supabase } from "../lib/supabase";
import { useToast } from "../components/ToastProvider";

function getPasswordErrors(pw) {
  const errs = [];
  if (pw.length < 8) errs.push("at least 8 characters");
  if (!/[A-Z]/.test(pw)) errs.push("one uppercase letter");
  if (!/[0-9]/.test(pw)) errs.push("one number");
  if (!/[^A-Za-z0-9]/.test(pw)) errs.push("one special character");
  return errs;
}

export default function LoginPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [tab, setTab] = useState("login"); // login | signup
  const [form, setForm] = useState({ email: "", password: "" });
  const [signupForm, setSignupForm] = useState({ email: "", password: "", confirm: "" });
  const [loading, setLoading] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace("/leads-inbox");
      else setAuthChecked(true);
    });
  }, [router]);

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: form.email.trim(),
      password: form.password,
    });
    setLoading(false);
    if (error) {
      showToast(error.message, { type: "error" });
    } else {
      router.replace("/leads-inbox");
    }
  }

  async function handleSignup(e) {
    e.preventDefault();
    const errs = getPasswordErrors(signupForm.password);
    if (errs.length) return showToast(`Password needs: ${errs.join(", ")}`, { type: "error" });
    if (signupForm.password !== signupForm.confirm) return showToast("Passwords do not match", { type: "error" });
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: signupForm.email.trim(),
      password: signupForm.password,
    });
    setLoading(false);
    if (error) {
      showToast(error.message, { type: "error" });
    } else {
      showToast("Check your email to confirm your account!", { type: "success" });
      setTab("login");
    }
  }

  if (!authChecked) return null;

  return (
    <div className="page">
      <div className="card">
        <div className="top-links">
          <Link href="/about">About</Link>
        </div>
        <div className="logo">🎯</div>
        <h1>Leads Generator</h1>
        <p className="sub">AI-powered lead discovery for service businesses</p>

        <div className="tabs">
          <button className={tab === "login" ? "active" : ""} onClick={() => setTab("login")}>Sign In</button>
          <button className={tab === "signup" ? "active" : ""} onClick={() => setTab("signup")}>Sign Up</button>
        </div>

        {tab === "login" && (
          <form onSubmit={handleLogin}>
            <input
              type="email" placeholder="Email" required autoComplete="email"
              value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <input
              type="password" placeholder="Password" required autoComplete="current-password"
              value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>
        )}

        {tab === "signup" && (
          <form onSubmit={handleSignup}>
            <input
              type="email" placeholder="Email" required autoComplete="email"
              value={signupForm.email} onChange={(e) => setSignupForm({ ...signupForm, email: e.target.value })}
            />
            <input
              type="password" placeholder="Password" required autoComplete="new-password"
              value={signupForm.password} onChange={(e) => setSignupForm({ ...signupForm, password: e.target.value })}
            />
            <input
              type="password" placeholder="Confirm password" required autoComplete="new-password"
              value={signupForm.confirm} onChange={(e) => setSignupForm({ ...signupForm, confirm: e.target.value })}
            />
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? "Creating account…" : "Create Account"}
            </button>
          </form>
        )}
      </div>

      <style jsx>{`
        .page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
        }
        .card {
          background: var(--surface-strong);
          border-radius: var(--radius-xl);
          box-shadow: var(--shadow-lg);
          padding: 48px 40px;
          width: 100%;
          max-width: 420px;
          text-align: center;
          position: relative;
        }
        .top-links {
          position: absolute;
          top: 14px;
          right: 14px;
        }
        .top-links a {
          border: 1px solid var(--line);
          border-radius: 8px;
          padding: 6px 10px;
          font-size: 0.78rem;
          font-weight: 700;
          color: var(--muted);
          text-decoration: none;
          transition: all 0.16s;
        }
        .top-links a:hover {
          color: var(--accent);
          border-color: var(--accent);
        }
        .logo { font-size: 3rem; margin-bottom: 12px; }
        h1 {
          font-family: var(--font-display);
          font-size: 1.8rem;
          font-weight: 700;
          color: var(--accent);
          margin-bottom: 8px;
        }
        .sub { color: var(--muted); font-size: 0.95rem; margin-bottom: 28px; }
        .tabs {
          display: flex;
          gap: 0;
          background: var(--canvas);
          border-radius: 12px;
          padding: 4px;
          margin-bottom: 24px;
        }
        .tabs button {
          flex: 1;
          padding: 10px;
          border-radius: 9px;
          font-weight: 600;
          font-size: 0.95rem;
          background: transparent;
          color: var(--muted);
          transition: all 0.18s;
        }
        .tabs button.active {
          background: white;
          color: var(--accent);
          box-shadow: 0 2px 8px rgba(99,102,241,0.12);
        }
        form { display: flex; flex-direction: column; gap: 14px; }
        input {
          width: 100%;
          padding: 13px 16px;
          border: 1.5px solid var(--line);
          border-radius: var(--radius-md);
          font-size: 1rem;
          background: var(--canvas);
          color: var(--ink);
          transition: border-color 0.18s;
        }
        input:focus { border-color: var(--accent); }
        .btn-primary {
          width: 100%;
          padding: 14px;
          background: var(--accent);
          color: white;
          border-radius: var(--radius-md);
          font-size: 1rem;
          font-weight: 700;
          transition: opacity 0.18s;
        }
        .btn-primary:hover:not(:disabled) { opacity: 0.88; }
        .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
      `}</style>
    </div>
  );
}
