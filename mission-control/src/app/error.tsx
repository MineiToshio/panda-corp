/**
 * Root segment error boundary — catches render/runtime errors thrown below the
 * root layout (the layout's `<html>`/`<body>` and `GuildBar` stay mounted; only
 * the page content is replaced). For failures in the layout itself, the net is
 * `global-error.tsx`.
 *
 * Must be a Client Component (Next.js requirement for error boundaries).
 * No hardcoded colours — only `--color-*` design tokens (styling-and-ui rule).
 */

"use client";

import { useEffect } from "react";

const WRAP_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "1rem",
  alignItems: "flex-start",
  maxWidth: "32rem",
  margin: "0 auto",
  padding: "4rem 2rem",
  color: "var(--color-text)",
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

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main style={WRAP_STYLE} role="alert" aria-live="assertive">
      <h1 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 600 }}>
        No se pudo cargar la vista
      </h1>
      <p style={{ margin: 0, fontSize: "0.875rem", opacity: 0.8 }}>
        Algo falló al renderizar esta pantalla. Podés reintentar sin recargar toda la aplicación.
      </p>
      <button type="button" onClick={reset} style={BUTTON_STYLE}>
        Reintentar
      </button>
    </main>
  );
}
