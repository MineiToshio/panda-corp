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
    name: "Web full-stack",
    stack: "Next.js + React + TS + Tailwind/shadcn + Prisma + Postgres + Better Auth",
    deploy: "Vercel",
  },
  { key: "B", name: "API TypeScript", stack: "Hono + Drizzle + Zod", deploy: "Railway / Fly" },
  {
    key: "C",
    name: "API Python",
    stack: "FastAPI + Pydantic + SQLAlchemy",
    deploy: "Railway / Fly",
  },
  {
    key: "D",
    name: "Scraping / datos / notificaciones",
    stack: "Python + Playwright + ARQ/Redis + Postgres",
    deploy: "Docker",
  },
] as const;

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
    </div>
  );
}
