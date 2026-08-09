import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

/* ─── Per-type config ────────────────────────────────────────────── */
const TOAST_CONFIG = {
  success: {
    Icon: CheckCircle2,
    accent: '#16a34a',
    bg: 'rgba(240,253,244,0.97)',
    border: '#bbf7d0',
    iconColor: '#16a34a',
    label: 'Success',
  },
  error: {
    Icon: XCircle,
    accent: '#dc2626',
    bg: 'rgba(254,242,242,0.97)',
    border: '#fecaca',
    iconColor: '#dc2626',
    label: 'Error',
  },
  warning: {
    Icon: AlertTriangle,
    accent: '#d97706',
    bg: 'rgba(255,251,235,0.97)',
    border: '#fde68a',
    iconColor: '#d97706',
    label: 'Warning',
  },
  info: {
    Icon: Info,
    accent: '#2563eb',
    bg: 'rgba(239,246,255,0.97)',
    border: '#bfdbfe',
    iconColor: '#2563eb',
    label: 'Info',
  },
};

/* ─── Individual Toast Item ─────────────────────────────────────── */
const ToastItem = ({ toast, onRemove }) => {
  const [mounted, setMounted] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [progress, setProgress] = useState(100);
  const intervalRef = useRef(null);
  const duration = toast.duration ?? 4000;

  const cfg = TOAST_CONFIG[toast.type] || TOAST_CONFIG.info;
  const { Icon } = cfg;

  const dismiss = useCallback(() => {
    clearInterval(intervalRef.current);
    setLeaving(true);
    setTimeout(() => onRemove(toast.id), 400);
  }, [onRemove, toast.id]);

  useEffect(() => {
    // Trigger entrance animation on next tick
    const t = setTimeout(() => setMounted(true), 16);

    // Progress bar countdown
    if (duration > 0) {
      const start = Date.now();
      intervalRef.current = setInterval(() => {
        const pct = Math.max(0, 100 - ((Date.now() - start) / duration) * 100);
        setProgress(pct);
        if (pct <= 0) {
          clearInterval(intervalRef.current);
          dismiss();
        }
      }, 20);
    }

    return () => {
      clearTimeout(t);
      clearInterval(intervalRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const className = [
    'toast-card',
    mounted && !leaving ? 'toast-card--visible' : '',
    leaving ? 'toast-card--leaving' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={className}
      style={{
        '--t-accent': cfg.accent,
        '--t-bg': cfg.bg,
        '--t-border': cfg.border,
        '--t-icon': cfg.iconColor,
      }}
      role="alert"
    >
      {/* Colored left accent stripe */}
      <span className="toast-stripe" aria-hidden="true" />

      {/* Icon */}
      <span className="toast-icon-wrap" aria-hidden="true">
        <Icon size={18} strokeWidth={2.2} />
      </span>

      {/* Text content */}
      <span className="toast-content">
        <span className="toast-label">{cfg.label}</span>
        <span className="toast-message">{toast.message}</span>
      </span>

      {/* Dismiss button */}
      <button className="toast-dismiss-btn" onClick={dismiss} aria-label="Dismiss">
        <X size={13} strokeWidth={2.5} />
      </button>

      {/* Progress bar */}
      {duration > 0 && (
        <span className="toast-progress-track" aria-hidden="true">
          <span className="toast-progress-fill" style={{ width: `${progress}%` }} />
        </span>
      )}
    </div>
  );
};

/* ─── Provider ───────────────────────────────────────────────────── */
export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (message, type = 'info', duration = 4000) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      // cap stack at 5
      setToasts((prev) => [...prev.slice(-4), { id, message, type, duration }]);
    },
    []
  );

  const toast = {
    success: (msg, dur) => addToast(msg, 'success', dur),
    error:   (msg, dur) => addToast(msg, 'error',   dur),
    warning: (msg, dur) => addToast(msg, 'warning', dur),
    info:    (msg, dur) => addToast(msg, 'info',    dur),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toast-viewport" aria-label="Notifications" aria-live="polite">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onRemove={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
};
