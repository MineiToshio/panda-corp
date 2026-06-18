/**
 * Root not-found boundary — rendered for unmatched routes and explicit
 * `notFound()` calls. Server Component (static content, no interactivity).
 *
 * No hardcoded colours — only `--color-*` design tokens (styling-and-ui rule).
 */

import Link from "next/link";

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

const LINK_STYLE: React.CSSProperties = {
  padding: "0.5rem 1rem",
  borderRadius: "var(--radius, 0.5rem)",
  border: "var(--hairline, 1px) solid var(--color-accent)",
  color: "var(--color-accent)",
  textDecoration: "none",
  fontSize: "0.875rem",
};

export default function NotFound() {
  return (
    <main style={WRAP_STYLE}>
      <h1 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 600 }}>Página no encontrada</h1>
      <p style={{ margin: 0, fontSize: "0.875rem", opacity: 0.8 }}>
        La ruta que buscás no existe en Mission Control.
      </p>
      <Link href="/" style={LINK_STYLE}>
        Volver al inicio
      </Link>
    </main>
  );
}
