/**
 * Global error boundary — the last-resort net for failures in the root layout
 * itself, where a per-segment `error.tsx` cannot render. Because it replaces the
 * root layout entirely, it must declare its own `<html>`/`<body>` (Next.js App
 * Router contract).
 *
 * Must be a Client Component (Next.js requirement for error boundaries).
 * No hardcoded colours — only `--color-*` design tokens (styling-and-ui rule).
 */

"use client";

import { useEffect } from "react";

const BODY_STYLE: React.CSSProperties = {
  margin: 0,
  minHeight: "100vh",
  background: "var(--color-base)",
  color: "var(--color-text)",
  fontFamily: "system-ui, sans-serif",
};

const WRAP_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "1rem",
  alignItems: "flex-start",
  maxWidth: "32rem",
  margin: "0 auto",
  padding: "4rem 2rem",
};

const BUTTON_STYLE: React.CSSProperties = {
  padding: "0.5rem 1rem",
  borderRadius: "var(--radius, 0.5rem)",
  border: "var(--hairline, 1px) solid var(--color-accent)",
  background: "var(--color-accent)",
  color: "var(--color-base)",
  cursor: "pointer",
  fontSize: "0.875rem",
};

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Mission Control is a local tool — surface the failure in the console for debugging.
    console.error(error);
  }, [error]);

  return (
    <html lang="es">
      <body style={BODY_STYLE}>
        <main style={WRAP_STYLE} role="alert" aria-live="assertive">
          <h1 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 600 }}>
            Algo se rompió en Mission Control
          </h1>
          <p style={{ margin: 0, fontSize: "0.875rem", opacity: 0.8 }}>
            Ocurrió un error inesperado al cargar la aplicación. Volvé a intentarlo.
          </p>
          <button type="button" onClick={reset} style={BUTTON_STYLE}>
            Reintentar
          </button>
        </main>
      </body>
    </html>
  );
}
