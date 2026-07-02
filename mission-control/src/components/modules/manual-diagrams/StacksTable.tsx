/**
 * manual-diagrams/StacksTable.tsx — FRD-08 ("Stacks · golden paths")
 *
 * The four golden-path archetypes (A–D): each a Panel row with a big accent
 * letter, a name, a deploy target (right), and the mono stack line.
 *
 * Faithful recreation of the prototype `docPage(11)` stacks block (index.html
 * L1089-1090).
 *
 * Tokens only · light+dark first-class.
 *
 * Traceability: CMP-08-diagrams (stacks).
 */

import type React from "react";
import { Panel } from "@/components/core/Panel/Panel";

type Stack = {
  readonly key: string;
  readonly name: string;
  readonly stack: string;
  readonly deploy: string;
};

const STACKS: readonly Stack[] = [
  {
    key: "A",
    name: "Web full-stack (validado en producción)",
    stack: "Next.js + React + TS + Tailwind/shadcn + Prisma + Postgres (Neon) + Better Auth",
    deploy: "Vercel",
  },
  {
    key: "B",
    name: "API / servicio TypeScript",
    stack: "Hono + Zod (+ OpenAPI derivado) + Drizzle + Postgres",
    deploy: "Railway / Fly",
  },
  {
    key: "C",
    name: "Datos / scraping / APIs Python (absorbe el viejo D)",
    stack: "FastAPI + Pydantic + SQLAlchemy + httpx/Playwright + ARQ/Redis",
    deploy: "Railway / Fly (Docker)",
  },
] as const;

const STARTING_POINTS =
  "Puntos de partida (aún sin validar en producción): CLI (Commander/Typer) · extensión de navegador (WXT) · sitio estático (Astro) · app de agentes IA (Claude Agent SDK / Vercel AI SDK).";

export function StacksTable(): React.JSX.Element {
  return (
    <div data-testid="manual-diagram-stacks">
      {STACKS.map((s) => (
        <div key={s.key} style={{ marginBottom: "8px" }}>
          <Panel>
            <div style={{ display: "flex", gap: "10px", alignItems: "baseline", flexWrap: "wrap" }}>
              <span
                style={{ fontSize: "16px", fontWeight: 500, color: "var(--color-accent-text)" }}
              >
                {s.key}
              </span>
              <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--color-text)" }}>
                {s.name}
              </span>
              <span style={{ marginLeft: "auto", fontSize: "11px", color: "var(--color-text3)" }}>
                <i
                  className="ti ti-cloud-up"
                  aria-hidden="true"
                  style={{ fontSize: "11px", verticalAlign: "-1px" }}
                />{" "}
                {s.deploy}
              </span>
            </div>
            <div
              style={{
                fontSize: "12px",
                color: "var(--color-text2)",
                marginTop: "4px",
                fontFamily: "var(--font-mono, monospace)",
              }}
            >
              {s.stack}
            </div>
          </Panel>
        </div>
      ))}
      <div style={{ fontSize: "11px", color: "var(--color-text3)", lineHeight: 1.6 }}>
        {STARTING_POINTS}
      </div>
    </div>
  );
}
