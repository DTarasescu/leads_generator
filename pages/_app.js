import Head from "next/head";
import { ToastProvider } from "../components/ToastProvider";
import { supabase } from "../lib/supabase";
import { useEffect } from "react";

const INACTIVITY_MS = 10 * 60 * 1000;
const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"];

export default function App({ Component, pageProps }) {
  useEffect(() => {
    if (typeof window === "undefined" || process.env.NODE_ENV !== "production") return;
    let timer;
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(() => supabase.auth.signOut(), INACTIVITY_MS);
    };
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => {
      clearTimeout(timer);
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, reset));
    };
  }, []);

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        try {
          window.localStorage.removeItem("lg-cached-leads");
          window.localStorage.removeItem("lg-cached-owner");
        } catch {}
      }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  return (
    <>
      <div className="bg-base" aria-hidden="true" />
      <div className="bg-grid" aria-hidden="true" />
      <ToastProvider>
        <Head>
          <title>Leads Generator</title>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <meta name="description" content="AI-powered lead discovery and outreach for service businesses" />
          <meta name="theme-color" content="#6366f1" />
        </Head>
        <div className="app-content">
          <Component {...pageProps} />
        </div>
      </ToastProvider>

      <style jsx global>{`
        :root {
          --canvas: #f5f3ff;
          --surface: rgba(255, 255, 255, 0.90);
          --surface-strong: rgba(255, 255, 255, 0.98);
          --ink: #1e1b4b;
          --muted: #6b7280;
          --line: rgba(99, 102, 241, 0.15);
          --accent: #6366f1;
          --accent-soft: rgba(99, 102, 241, 0.12);
          --accent-2: #8b5cf6;
          --accent-2-soft: rgba(139, 92, 246, 0.12);
          --success: #22c55e;
          --danger: #ef4444;
          --warning: #f59e0b;
          --shadow-lg: 0 30px 80px rgba(30, 27, 75, 0.15);
          --shadow-md: 0 8px 32px rgba(30, 27, 75, 0.10);
          --radius-xl: 28px;
          --radius-lg: 20px;
          --radius-md: 14px;
          --font-display: "Space Grotesk", "Segoe UI", sans-serif;
          --font-body: "Inter", "Segoe UI", sans-serif;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          font-family: var(--font-body);
          background: var(--canvas);
          color: var(--ink);
          min-height: 100vh;
        }
        .bg-base {
          position: fixed; inset: 0; z-index: 0;
          background: linear-gradient(135deg, #ede9fe 0%, #f5f3ff 50%, #eef2ff 100%);
        }
        .bg-grid {
          position: fixed; inset: 0; z-index: 0; opacity: 0.04;
          background-image: linear-gradient(var(--accent) 1px, transparent 1px),
            linear-gradient(90deg, var(--accent) 1px, transparent 1px);
          background-size: 32px 32px;
        }
        .app-content { position: relative; z-index: 1; min-height: 100vh; }
        a { color: var(--accent); text-decoration: none; }
        a:hover { text-decoration: underline; }
        button {
          cursor: pointer;
          font-family: var(--font-body);
          border: none;
          outline: none;
        }
        input, select, textarea {
          font-family: var(--font-body);
          outline: none;
        }
      `}</style>
    </>
  );
}
