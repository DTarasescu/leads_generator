import { createContext, useContext, useState, useCallback } from "react";

const ToastContext = createContext();

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, { type = "info", duration = 3200 } = {}) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="toast-wrap">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}`}>{t.message}</div>
        ))}
      </div>
      <style jsx global>{`
        .toast-wrap {
          position: fixed; top: 24px; left: 50%;
          transform: translateX(-50%);
          z-index: 9999;
          display: flex; flex-direction: column; gap: 10px;
          pointer-events: none;
        }
        .toast {
          min-width: 240px; max-width: 90vw;
          background: white; color: #1e1b4b;
          border-radius: 14px;
          box-shadow: 0 6px 32px rgba(30,27,75,0.13);
          padding: 14px 24px;
          font-size: 0.97rem; font-weight: 700;
          border: 2px solid #e5e7eb;
          animation: toast-in 0.2s cubic-bezier(.4,1.4,.6,1) both;
        }
        .toast.success { border-color: #22c55e; background: #f0fdf4; color: #166534; }
        .toast.error   { border-color: #ef4444; background: #fef2f2; color: #991b1b; }
        .toast.info    { border-color: #6366f1; }
        @keyframes toast-in {
          from { opacity: 0; transform: translateY(-14px) scale(0.97); }
          to   { opacity: 1; transform: none; }
        }
      `}</style>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
