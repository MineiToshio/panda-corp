/**
 * WO-16-004 preview route — visual fidelity check (DR-056).
 *
 * Renders OrphansBanner variants against a mocked /api/orphans endpoint so the
 * implementer can compare the output against the prototype's orphanBanner() function
 * (~L633 of docs/design/prototype/index.html).
 *
 * Strategy: install the fetch mock at module scope (executes synchronously before
 * any React component is mounted or any effect runs) so the OrphansBanner's initial
 * poll on mount always hits the mock. Each scenario uses a unique URL parameter
 * to distinguish which candidate set to return.
 *
 * This file does NOT ship as product code — preview-only (DR-055 smoke gate).
 */

"use client";

// ---------------------------------------------------------------------------
// Module-scope fetch mock — installed BEFORE any component mounts
// (module-scope code runs synchronously when the JS chunk is evaluated)
// ---------------------------------------------------------------------------

import type { Candidate } from "@/lib/orphans/orphans";

const TWO_CANDIDATES: Candidate[] = [
  {
    name: "funko-tracker",
    path: "~/Proyectos/funko-tracker",
    kind: "orphan",
    hasMarker: false,
    inPortfolio: false,
  },
  {
    name: "budget-buddy",
    path: "~/Proyectos/budget-buddy",
    kind: "unlisted",
    hasMarker: true,
    inPortfolio: false,
  },
];

const FOUR_CANDIDATES: Candidate[] = [
  ...TWO_CANDIDATES,
  {
    name: "quote-forge",
    path: "~/Proyectos/quote-forge",
    kind: "orphan",
    hasMarker: false,
    inPortfolio: false,
  },
  {
    name: "recipe-keeper",
    path: "~/Proyectos/recipe-keeper",
    kind: "unlisted",
    hasMarker: true,
    inPortfolio: false,
  },
];

// Install the global fetch interceptor once, synchronously at module load time.
if (typeof globalThis !== "undefined" && typeof globalThis.fetch === "function") {
  const realFetch = globalThis.fetch.bind(globalThis);
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/api/orphans?s=1")) {
      return new Response(JSON.stringify(TWO_CANDIDATES), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (url.includes("/api/orphans?s=2")) {
      return new Response(JSON.stringify(FOUR_CANDIDATES), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (url.includes("/api/orphans?s=3")) {
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return realFetch(input, init);
  };
}

// ---------------------------------------------------------------------------
// Scoped banner variants — each polls a distinct URL param so the module-scope
// mock can distinguish them and return the right candidate set.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useRef, useState } from "react";
import { Banner } from "@/components/core/Banner/Banner";
import { CopyButton } from "@/components/core/CopyButton/CopyButton";

const POLL_MS = 30_000;
const DISMISS_PREFIX = "mc:orphan-dismissed:";
const COLLAPSE_THRESHOLD = 2;

function dismissKey(p: string) {
  return `${DISMISS_PREFIX}${p}`;
}
function isDismissed(p: string) {
  try {
    return localStorage.getItem(dismissKey(p)) === "1";
  } catch {
    return false;
  }
}
function persistDismissal(p: string) {
  try {
    localStorage.setItem(dismissKey(p), "1");
  } catch {}
}

/** Minimal inline OrphansBanner clone that polls a scenario-keyed URL. */
function ScenarioBanner({ scenario }: { scenario: 1 | 2 | 3 }): React.JSX.Element | null {
  const url = `/api/orphans?s=${scenario}`;
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(() => new Set<string>());
  const [expanded, setExpanded] = useState(false);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);

  const poll = useCallback(async () => {
    try {
      const res = await fetch(url);
      if (!res.ok) return;
      setCandidates((await res.json()) as Candidate[]);
    } catch {}
  }, [url]);

  useEffect(() => {
    void poll();
    ref.current = setInterval(() => void poll(), POLL_MS);
    return () => {
      if (ref.current) clearInterval(ref.current);
    };
  }, [poll]);

  if (!candidates) return null;
  const visible = candidates.filter((c) => !dismissed.has(c.path) && !isDismissed(c.path));
  if (!visible.length) return null;

  const shown = expanded ? visible : visible.slice(0, COLLAPSE_THRESHOLD);
  const hiddenCount = visible.length - shown.length;

  function handleDismiss(path: string) {
    persistDismissal(path);
    setDismissed((prev) => new Set([...prev, path]));
  }

  return (
    <div
      data-testid="orphans-banner"
      role="alert"
      aria-label="Avisos de proyectos de Pandacorp sin registrar"
    >
      <Banner
        tone="warn"
        kind="orphan"
        heading="Proyectos de Pandacorp sin registrar"
        detail="Detecté carpetas con .pandacorp/ que no están en tu portfolio."
      >
        <span data-testid="orphan-icon" aria-hidden="true" style={{ display: "none" }} />
        {shown.map((c) => {
          const isOrphan = c.kind === "orphan";
          const cmd = isOrphan ? "/pandacorp:adopt" : "/pandacorp:sync-portfolio";
          const chipLabel = isOrphan ? "sin adoptar" : "falta en portfolio";
          const hint = isOrphan
            ? "tiene .pandacorp/ pero nunca pasó por el handoff — adóptalo bajo la fábrica"
            : "ya es proyecto de la fábrica, solo falta su fila en el portfolio";
          const recall = isOrphan
            ? "adóptalo desde una sesión en esa carpeta"
            : "refresca el índice del portfolio";

          return (
            <div
              key={c.path}
              data-testid={`orphan-item-${c.name}`}
              style={{
                borderTop: "0.5px solid var(--color-border, var(--bd))",
                padding: "0.5625rem 0 0.25rem",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  flexWrap: "wrap" as const,
                  justifyContent: "space-between",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    flexWrap: "wrap" as const,
                  }}
                >
                  <span style={{ fontSize: "0.8125rem", fontWeight: 500 }}>{c.name}</span>
                  <span
                    style={{
                      fontSize: "0.625rem",
                      padding: "0.0625rem 0.375rem",
                      borderRadius: "var(--radius-sm, 4px)",
                      background: isOrphan
                        ? "var(--color-warn-bg, var(--warn-bg))"
                        : "var(--color-info-bg, var(--info-bg))",
                      color: isOrphan
                        ? "var(--color-warn, var(--warn))"
                        : "var(--color-info, var(--info))",
                    }}
                  >
                    {chipLabel}
                  </span>
                  <code
                    data-testid={`orphan-path-${c.name}`}
                    style={{
                      fontFamily: "var(--font-mono, monospace)",
                      fontSize: "0.6875rem",
                      color: "var(--color-text-tertiary, var(--text3))",
                      background: "var(--color-surface, var(--panel))",
                      padding: "0.0625rem 0.375rem",
                      borderRadius: "4px",
                    }}
                  >
                    {c.path}
                  </code>
                </div>
                <button
                  type="button"
                  data-testid={`orphan-dismiss-${c.name}`}
                  aria-label={`Descartar aviso de proyecto ${c.name}`}
                  style={{
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "0.8125rem",
                    opacity: 0.7,
                    color: "inherit",
                  }}
                  onClick={() => handleDismiss(c.path)}
                >
                  ×
                </button>
              </div>
              <div
                style={{
                  fontSize: "0.6875rem",
                  color: "var(--color-warn, var(--warn))",
                  margin: "0.1875rem 0 0",
                }}
              >
                {hint}
              </div>
              <div data-testid={`orphan-copy-cmd-${c.name}`} style={{ marginTop: "0.375rem" }}>
                <span
                  style={{
                    fontFamily: "var(--font-mono, monospace)",
                    fontSize: "0.6875rem",
                    opacity: 0.85,
                    display: "block",
                    marginBottom: "0.25rem",
                  }}
                >
                  {recall}
                </span>
                <code
                  style={{
                    fontFamily: "var(--font-mono, monospace)",
                    fontSize: "0.75rem",
                    userSelect: "all" as const,
                  }}
                >
                  {cmd}
                </code>{" "}
                <CopyButton value={cmd} />
              </div>
            </div>
          );
        })}
        {(hiddenCount > 0 || expanded) && visible.length > COLLAPSE_THRESHOLD && (
          <button
            type="button"
            data-testid="orphans-toggle"
            aria-expanded={expanded}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "var(--color-warn, var(--warn))",
              padding: "0.375rem 0 0",
              fontSize: "0.75rem",
              fontWeight: 500,
              textDecoration: "underline",
              display: "block",
            }}
            onClick={() => setExpanded((p) => !p)}
          >
            {expanded
              ? "Ver menos"
              : `Ver ${hiddenCount} proyecto${hiddenCount === 1 ? "" : "s"} más`}
          </button>
        )}
      </Banner>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section label
// ---------------------------------------------------------------------------

function SectionLabel({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div
      style={{
        fontSize: "0.6875rem",
        fontWeight: 600,
        letterSpacing: "0.06em",
        textTransform: "uppercase" as const,
        color: "var(--color-text-tertiary, var(--text3))",
        borderBottom: "0.5px solid var(--color-border, var(--bd))",
        paddingBottom: "0.25rem",
        marginBottom: "0.75rem",
        marginTop: "1.5rem",
      }}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PreviewPage(): React.JSX.Element {
  return (
    <div
      style={{
        padding: "24px",
        maxWidth: "860px",
        margin: "0 auto",
        fontFamily: "var(--font-sans, system-ui, sans-serif)",
        color: "var(--color-text, var(--text))",
        background: "var(--color-canvas, var(--canvas))",
        minHeight: "100vh",
      }}
    >
      <p
        style={{
          fontSize: "0.6875rem",
          color: "var(--color-text-tertiary, var(--text3))",
          margin: "0 0 1.5rem",
          padding: "0.375rem 0.75rem",
          background: "var(--color-warn-bg, var(--warn-bg))",
          borderLeft: "2px solid var(--color-warn, var(--warn))",
          borderRadius: "var(--radius-sm, 4px)",
        }}
      >
        WO-16-004 · preview route · DR-056 in-loop fidelity check · not product code
      </p>

      {/* Scenario 1: 2 candidates, no collapse */}
      <SectionLabel>Escenario 1 — 2 candidatos (1 orphan + 1 unlisted) · sin colapsar</SectionLabel>
      <p
        style={{
          fontSize: "0.75rem",
          color: "var(--color-text-tertiary, var(--text3))",
          margin: "0 0 0.75rem",
        }}
      >
        Referencia: orphanBanner() con ORPHANS de 2 entradas. Debe mostrarse sin toggle.
      </p>
      <ScenarioBanner scenario={1} />

      {/* Scenario 2: 4 candidates, collapse to 2 + toggle */}
      <SectionLabel>Escenario 2 — 4 candidatos · colapso a 2 + toggle</SectionLabel>
      <p
        style={{
          fontSize: "0.75rem",
          color: "var(--color-text-tertiary, var(--text3))",
          margin: "0 0 0.75rem",
        }}
      >
        Referencia: orphanBanner() con ORPHANS de 4 entradas → primeros 2 + toggle &quot;Ver 2
        proyectos más&quot;.
      </p>
      <ScenarioBanner scenario={2} />

      {/* Scenario 3: no candidates → renders nothing */}
      <SectionLabel>Escenario 3 — sin candidatos → no renderiza nada</SectionLabel>
      <p
        style={{
          fontSize: "0.75rem",
          color: "var(--color-text-tertiary, var(--text3))",
          margin: "0 0 0.75rem",
        }}
      >
        El banner no debe mostrar nada (no empty shell).
      </p>
      <ScenarioBanner scenario={3} />
      <div
        style={{
          height: "40px",
          border: "0.5px dashed var(--color-border, var(--bd))",
          borderRadius: "4px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "0.625rem",
          color: "var(--color-text-tertiary, var(--text3))",
        }}
      >
        ↑ vacío (correcto)
      </div>
    </div>
  );
}
