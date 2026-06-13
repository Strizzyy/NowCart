import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';
import { PopIn } from './Transition';

type ToastTone = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  tone: ToastTone;
  message: string;
}

interface ToastContextValue {
  notify: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TONE_STYLES: Record<ToastTone, { ring: string; icon: ReactNode }> = {
  success: { ring: 'border-l-4 border-l-primary', icon: <CheckCircle2 size={18} className="text-primary-ink" /> },
  error: { ring: 'border-l-4 border-l-accent', icon: <AlertTriangle size={18} className="text-accent-dark" /> },
  info: { ring: 'border-l-4 border-l-blue-500', icon: <Info size={18} className="text-blue-700" /> },
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  useEffect(() => {
    const t = setTimeout(() => onDismiss(toast.id), 4000);
    return () => clearTimeout(t);
  }, [toast.id, onDismiss]);

  const style = TONE_STYLES[toast.tone];
  return (
    <PopIn>
      <div
        role="status"
        className={`flex items-start gap-2.5 bg-surface shadow-[var(--shadow-pop)] rounded-xl px-4 py-3 ${style.ring} min-w-[240px] max-w-sm`}
      >
        <span className="mt-0.5 shrink-0">{style.icon}</span>
        <p className="text-sm text-dark flex-1">{toast.message}</p>
        <button
          onClick={() => onDismiss(toast.id)}
          className="text-muted hover:text-dark transition shrink-0"
          aria-label="Dismiss notification"
        >
          <X size={16} />
        </button>
      </div>
    </PopIn>
  );
}

/**
 * ToastProvider — app-wide transient notification host. Wrap the app once and
 * call useToast().notify(message, tone) from anywhere.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((cur) => cur.filter((t) => t.id !== id));
  }, []);

  const notify = useCallback((message: string, tone: ToastTone = 'info') => {
    setToasts((cur) => [...cur, { id: Date.now() + Math.random(), tone, message }]);
  }, []);

  return (
    <ToastContext.Provider value={{ notify }}>
      {children}
      <div
        className="fixed bottom-4 right-4 z-[80] flex flex-col gap-2 items-end"
        aria-live="polite"
        aria-atomic="false"
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Safe no-op fallback so components never crash outside a provider.
    return { notify: () => {} };
  }
  return ctx;
}
