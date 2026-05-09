"use client";

// Global toast system (F19).
//
// SECURITY:
// - Toast content never accepts raw user input. All callers pass
//   either predefined message templates or short strings derived
//   from server-validated data (e.g. action result codes).
// - role="alert" + aria-live="assertive" so screen readers announce
//   immediately; hard-coded ARIA semantics — not data-driven.
// - No persistence — state lives in memory only, cleared on
//   navigation. No XSS surface from rehydration.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { CheckCircle2, AlertCircle, X } from "lucide-react";

export type ToastVariant = "success" | "error";

type Toast = {
  id: number;
  variant: ToastVariant;
  message: string;
};

type ToastContextValue = {
  show: (variant: ToastVariant, message: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const AUTO_DISMISS_MS = 3000;
const MAX_MESSAGE_LEN = 200;

export function ToastProvider({ children }: { children: ReactNode }) {
  // PRD: "no stacking (latest replaces)" — keep at most one.
  const [current, setCurrent] = useState<Toast | null>(null);

  const show = useCallback((variant: ToastVariant, message: string) => {
    // Guardrail: cap message length so a long string from a buggy
    // caller can't push the layout off-screen.
    const trimmed = String(message).slice(0, MAX_MESSAGE_LEN);
    setCurrent({ id: Date.now(), variant, message: trimmed });
  }, []);

  useEffect(() => {
    if (!current) return;
    const timer = setTimeout(() => setCurrent(null), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [current]);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <ToastViewport
        toast={current}
        onDismiss={() => setCurrent(null)}
      />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Defensive: if rendered outside the provider, return a no-op so a
    // missing provider can't crash the page. The console.warn helps
    // catch this in dev.
    if (typeof window !== "undefined") {
      console.warn("[toast] useToast() called outside ToastProvider");
    }
    return { show: () => {} };
  }
  return ctx;
}

function ToastViewport({
  toast,
  onDismiss,
}: {
  toast: Toast | null;
  onDismiss: () => void;
}) {
  // The viewport is always rendered (so screen readers see the
  // aria-live region from the start), but is empty when no toast is
  // active.
  return (
    <div
      role="region"
      aria-label="Notifications"
      className="pointer-events-none fixed bottom-6 left-1/2 z-[100] -translate-x-1/2"
    >
      <div role="alert" aria-live="assertive" aria-atomic="true">
        {toast ? (
          <div
            key={toast.id}
            className={`pointer-events-auto flex max-w-[420px] items-start gap-2.5 rounded-lg border px-4 py-2.5 shadow-lg ${
              toast.variant === "success"
                ? "border-[color:var(--cal-status-approved-border)] bg-[color:var(--cal-status-approved-bg)] text-[color:var(--cal-status-approved-text)]"
                : "border-[color:var(--cal-status-deleted-border)] bg-[color:var(--cal-status-deleted-bg)] text-[color:var(--cal-status-deleted-text)]"
            }`}
          >
            {toast.variant === "success" ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            ) : (
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            )}
            <span className="text-[13px] font-medium leading-snug">
              {toast.message}
            </span>
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Dismiss notification"
              className="ml-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-current opacity-70 transition-opacity hover:opacity-100"
            >
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
