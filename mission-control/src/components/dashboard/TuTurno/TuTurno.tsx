/**
 * WO-18-002 — `CMP-18-turn` — "Tu turno" human-gate queue component
 *
 * Renders the urgency-ordered queue of genuine human gates (from IF-18-turn).
 * Each item shows its label, the exact /pandacorp:* command (copyable via CopyButton),
 * and a link that navigates to the relevant project/idea/board.
 *
 * When the queue is empty, renders a calm al-día badge (no manufactured urgency — REQ-18-003).
 *
 * Server-renderable: no "use client" needed — CopyButton is already "use client" internally.
 *
 * Traceability:
 *   CMP-18-turn → AC-18-002.3 (count/al-día header)
 *               → AC-18-002.4 (copyable command + navigable href)
 *               → AC-18-002.5 (empty → al-día, Spanish, a11y)
 *   REQ-18-010, REQ-18-011, REQ-18-012
 */

import Link from "next/link";
import type { TurnItem } from "@/app/(dashboard)/_lib/turn";
import { CopyButton } from "@/components/core/CopyButton/CopyButton";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface TuTurnoProps {
  /**
   * Urgency-ordered human-gate queue from buildTurnQueue (IF-18-turn).
   * Empty array → al-día state.
   */
  items: TurnItem[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * TuTurno — the "Tu turno" hero section.
 *
 * Renders the urgency-ordered human-gate decision queue. Each row links to
 * the relevant destination and surfaces the exact /pandacorp:* command via
 * a CopyButton. When the queue is empty, shows a calm "al día" badge.
 *
 * @param items - Urgency-ordered TurnItem array from buildTurnQueue().
 */
export function TuTurno({ items }: TuTurnoProps): React.JSX.Element {
  const isEmpty = items.length === 0;

  return (
    <section aria-labelledby="tu-turno-heading-id">
      {/* ------------------------------------------------------------------ */}
      {/* Header                                                              */}
      {/* ------------------------------------------------------------------ */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          marginBottom: "0.75rem",
        }}
      >
        <h2
          id="tu-turno-heading-id"
          data-testid="tu-turno-heading"
          style={{
            margin: 0,
            fontSize: "1rem",
            fontWeight: 600,
            color: "var(--color-foreground)",
          }}
        >
          Tu turno
        </h2>

        {isEmpty ? (
          /* Calm al-día badge — no manufactured urgency (REQ-18-003) */
          <span
            data-testid="tu-turno-al-dia"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.25rem",
              padding: "0.125rem 0.5rem",
              borderRadius: "9999px",
              fontSize: "0.75rem",
              fontWeight: 500,
              background: "var(--color-success, var(--color-primary))",
              color: "var(--color-background)",
            }}
          >
            al día
          </span>
        ) : (
          /* Count badge */
          <span
            data-testid="tu-turno-count"
            role="status"
            aria-label={`${items.length} elemento${items.length === 1 ? "" : "s"} en espera`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              minWidth: "1.25rem",
              height: "1.25rem",
              padding: "0 0.375rem",
              borderRadius: "9999px",
              fontSize: "0.75rem",
              fontWeight: 700,
              background: "var(--color-primary)",
              color: "var(--color-background)",
            }}
          >
            {items.length}
          </span>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Item list                                                           */}
      {/* ------------------------------------------------------------------ */}
      {!isEmpty && (
        <ul
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
          }}
        >
          {items.map((item) => (
            <li
              key={`${item.kind}:${item.href}`}
              data-testid="tu-turno-item"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "0.75rem",
                padding: "0.625rem 0.75rem",
                borderRadius: "0.375rem",
                border: "1px solid var(--color-border)",
                background: "var(--color-card, var(--color-background))",
              }}
            >
              {/* Left: link (navigates to the project/board/proposals) */}
              <Link
                href={item.href}
                data-testid="tu-turno-item-link"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.125rem",
                  flex: 1,
                  minWidth: 0,
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                <span
                  style={{
                    fontSize: "0.875rem",
                    fontWeight: 500,
                    color: "var(--color-foreground)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {item.label}
                </span>
                <span
                  style={{
                    fontSize: "0.75rem",
                    color: "var(--color-muted-foreground, var(--color-foreground))",
                    fontFamily: "monospace",
                  }}
                >
                  {item.command}
                </span>
              </Link>

              {/* Right: CopyButton with the /pandacorp:* command */}
              <CopyButton value={item.command} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
