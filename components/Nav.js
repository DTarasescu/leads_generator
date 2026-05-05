import Link from "next/link";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabase";
import { useToast } from "./ToastProvider";

export default function Nav({ user }) {
  const router = useRouter();
  const { showToast } = useToast();

  async function handleSignOut() {
    await supabase.auth.signOut();
    showToast("Signed out", { type: "info" });
    router.replace("/");
  }

  const links = [
    { href: "/leads-inbox", label: "📋 Pipeline" },
    { href: "/about", label: "ℹ️ About" },
    { href: "/pipeline-playbook", label: "🧭 Playbook" },
    { href: "/discover-leads", label: "🔍 Discover" },
    { href: "/methods-lab", label: "🧪 Methods" },
    { href: "/analytics", label: "📊 Analytics" },
    { href: "/automation", label: "⚙️ Automation" },
    { href: "/capture", label: "📝 Capture" },
  ];

  return (
    <nav className="nav">
      <div className="nav-inner">
        <Link href="/leads-inbox" className="brand">🎯 Leads Generator</Link>
        <div className="links">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={router.pathname === l.href ? "active" : ""}
            >
              {l.label}
            </Link>
          ))}
        </div>
        <div className="user-area">
          {user && <span className="email">{user.email}</span>}
          <button className="sign-out" onClick={handleSignOut}>Sign Out</button>
        </div>
      </div>

      <style jsx>{`
        .nav {
          background: var(--surface-strong);
          border-bottom: 1px solid var(--line);
          position: sticky; top: 0; z-index: 100;
          box-shadow: 0 2px 16px rgba(99,102,241,0.07);
        }
        .nav-inner {
          max-width: 1200px; margin: 0 auto;
          padding: 0 24px;
          height: 60px;
          display: flex; align-items: center; gap: 24px;
        }
        .brand {
          font-family: var(--font-display);
          font-weight: 700; font-size: 1.1rem;
          color: var(--accent);
          white-space: nowrap;
          text-decoration: none;
        }
        .links {
          display: flex; gap: 4px; flex: 1;
        }
        .links a {
          padding: 7px 14px;
          border-radius: 9px;
          font-weight: 600; font-size: 0.92rem;
          color: var(--muted);
          transition: all 0.16s;
          text-decoration: none;
        }
        .links a:hover, .links a.active {
          background: var(--accent-soft);
          color: var(--accent);
        }
        .user-area {
          display: flex; align-items: center; gap: 12px; margin-left: auto;
        }
        .email {
          font-size: 0.85rem; color: var(--muted);
          max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .sign-out {
          padding: 7px 14px;
          background: transparent;
          border: 1.5px solid var(--line);
          border-radius: 9px;
          font-size: 0.88rem; font-weight: 600;
          color: var(--muted);
          transition: all 0.16s;
        }
        .sign-out:hover {
          border-color: var(--danger);
          color: var(--danger);
        }
        @media (max-width: 640px) {
          .email { display: none; }
          .links a { padding: 7px 10px; font-size: 0.85rem; }
        }
      `}</style>
    </nav>
  );
}
