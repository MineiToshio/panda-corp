/**
 * CMP-17-promoqueue — Promotions queue (WO-17-006, FRD-17, REQ-17-006).
 *
 * The durable, reviewable list of factory/memory lessons with promotion: "proposed"
 * or promotion: "rejected". Shows each lesson's target (type/domain), rationale
 * (body), evidence (lesson id + source + links), and the /pandacorp:learn command
 * for the owner to copy and run.
 *
 * Read-only: MC never promotes. The approve affordance is the copyable command only.
 * Rejected lessons are shown as state (no write affordance).
 * High-risk targets (DR-* links, must-* domain) are display-only with a risk badge.
 *
 * Design constraints (FRD-13 / FRD-17):
 *   - Zero hardcoded colors — only CSS custom properties from @theme.
 *   - Spanish user-facing copy (honest, no urgency per REQ-17-007/FRD-09).
 *   - data-testid on every interactive/testable element.
 *   - Server Component compatible (no "use client" — props are pre-fetched).
 *
 * Traceability:
 *   AC-17-006.1  queue lists exactly promotion: proposed/rejected lessons
 *   AC-17-006.2  each entry shows target, rationale, and evidence
 *   AC-17-006.3  CopyButton with /pandacorp:learn command (MC never promotes)
 *   AC-17-006.4  rejected state shown as badge only (no write)
 *   AC-17-006.5  high-risk targets (DR-*, must-* domain) display-only with badge
 *   AC-17-006.6  empty queue → calm al día state, Spanish + a11y
 */

import { CopyButton } from "@/components/core/CopyButton/CopyButton";
import type { Lesson } from "@/lib/memory/memory";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PromotionsQueueProps = {
  /**
   * Lessons to display. Should include lessons with promotion === "proposed" or
   * promotion === "rejected". Lessons with other promotion states are silently
   * filtered out (AC-17-006.1: queue shows only proposed/rejected).
   */
  lessons: Lesson[];
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Determine whether a lesson is high-risk for display purposes.
 *
 * High-risk = target is a MUST standard, skill/agent, or DR (REQ-17-009, AC-17-006.5).
 * Signals:
 *   - links contains a "DR-*" reference
 *   - domain contains "must" (MUST standard)
 */
function isHighRisk(lesson: Lesson): boolean {
  const hasDrLink = lesson.links.some((link) => link.trim().toUpperCase().startsWith("DR-"));
  const hasMustDomain = lesson.domain.toLowerCase().includes("must");
  return hasDrLink || hasMustDomain;
}

/**
 * Build the /pandacorp:learn command string for a proposed lesson.
 * The command is what the owner copies and runs to promote the lesson.
 */
function buildLearnCommand(lesson: Lesson): string {
  return `/pandacorp:learn ${lesson.id}`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Evidence block: lesson id, source, links (AC-17-006.2). */
function EvidenceBlock({ lesson }: { lesson: Lesson }): React.JSX.Element {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "calc(var(--space-base) * 0.25)",
        fontSize: "0.75rem",
        color: "color-mix(in oklch, var(--color-text) 70%, transparent)",
      }}
    >
      <span data-testid="promotion-lesson-id" style={{ fontFamily: "monospace", fontWeight: 600 }}>
        {lesson.id}
      </span>
      {lesson.source && (
        <span data-testid="promotion-source">
          <span style={{ opacity: 0.6 }}>Origen: </span>
          {lesson.source}
        </span>
      )}
      {lesson.links.length > 0 && (
        <span data-testid="promotion-links">
          <span style={{ opacity: 0.6 }}>Vínculos: </span>
          {lesson.links.join(", ")}
        </span>
      )}
    </div>
  );
}

/** Proposed entry: shows target, rationale, evidence, and copyable /pandacorp:learn command. */
function ProposedEntry({ lesson }: { lesson: Lesson }): React.JSX.Element {
  const highRisk = isHighRisk(lesson);
  const command = buildLearnCommand(lesson);

  return (
    <article
      data-testid={`promotion-entry-${lesson.id}`}
      data-promotion-state="proposed"
      aria-label={`Propuesta de promoción ${lesson.id}`}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "calc(var(--space-base) * 0.5)",
        padding: "var(--space-base)",
        borderRadius: "var(--radius)",
        border: "var(--hairline) solid color-mix(in oklch, var(--color-text) 12%, transparent)",
        background: "color-mix(in oklch, var(--color-surface) 80%, var(--color-accent) 3%)",
        boxShadow: "var(--shadow-1)",
      }}
    >
      {/* Header row: target + high-risk badge */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "calc(var(--space-base) * 0.5)",
          flexWrap: "wrap",
        }}
      >
        <h3
          data-testid="promotion-target"
          style={{
            margin: 0,
            fontSize: "0.875rem",
            fontWeight: 600,
            color: "var(--color-text)",
          }}
        >
          {lesson.type} · {lesson.domain}
        </h3>
        {highRisk && (
          <span
            data-testid="promotion-high-risk-badge"
            title="Objetivo de alto riesgo — ejecutar el comando en el skill correspondiente"
            style={{
              fontSize: "0.65rem",
              fontWeight: 700,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              color: "var(--color-accent)",
              border: "var(--hairline) solid var(--color-accent)",
              borderRadius: "calc(var(--radius) * 0.5)",
              padding: "0.1em 0.4em",
            }}
          >
            Alto riesgo
          </span>
        )}
      </div>

      {/* Rationale (body excerpt) */}
      {lesson.body && (
        <p
          data-testid="promotion-rationale"
          style={{
            margin: 0,
            fontSize: "0.8rem",
            color: "color-mix(in oklch, var(--color-text) 85%, transparent)",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {lesson.body.slice(0, 300)}
          {lesson.body.length > 300 ? "…" : ""}
        </p>
      )}

      {/* Evidence */}
      <EvidenceBlock lesson={lesson} />

      {/* Approve affordance: copyable /pandacorp:learn command (AC-17-006.3) */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "calc(var(--space-base) * 0.5)",
          flexWrap: "wrap",
          marginTop: "calc(var(--space-base) * 0.25)",
        }}
      >
        <code
          data-testid="promotion-learn-command"
          style={{
            fontFamily: "monospace",
            fontSize: "0.75rem",
            padding: "0.2em 0.5em",
            borderRadius: "calc(var(--radius) * 0.5)",
            background: "color-mix(in oklch, var(--color-text) 8%, transparent)",
            color: "var(--color-text)",
          }}
        >
          {command}
        </code>
        <CopyButton value={command} label="Copiar comando" />
      </div>
    </article>
  );
}

/** Rejected entry: shows lesson info + rejected badge, no write affordance (AC-17-006.4). */
function RejectedEntry({ lesson }: { lesson: Lesson }): React.JSX.Element {
  return (
    <article
      data-testid={`promotion-entry-${lesson.id}`}
      data-promotion-state="rejected"
      aria-label={`Promoción rechazada ${lesson.id}`}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "calc(var(--space-base) * 0.5)",
        padding: "var(--space-base)",
        borderRadius: "var(--radius)",
        border: "var(--hairline) solid color-mix(in oklch, var(--color-text) 8%, transparent)",
        background: "color-mix(in oklch, var(--color-surface) 90%, transparent)",
        opacity: 0.7,
      }}
    >
      {/* Header row: target + rejected badge */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "calc(var(--space-base) * 0.5)",
          flexWrap: "wrap",
        }}
      >
        <h3
          data-testid="promotion-target"
          style={{
            margin: 0,
            fontSize: "0.875rem",
            fontWeight: 600,
            color: "color-mix(in oklch, var(--color-text) 70%, transparent)",
          }}
        >
          {lesson.type} · {lesson.domain}
        </h3>
        <span
          data-testid="promotion-rejected-badge"
          style={{
            fontSize: "0.65rem",
            fontWeight: 700,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            color: "color-mix(in oklch, var(--color-text) 50%, transparent)",
            border: "var(--hairline) solid color-mix(in oklch, var(--color-text) 30%, transparent)",
            borderRadius: "calc(var(--radius) * 0.5)",
            padding: "0.1em 0.4em",
          }}
        >
          Rechazada
        </span>
      </div>

      {/* Evidence (read-only, informational) */}
      <EvidenceBlock lesson={lesson} />
    </article>
  );
}

/** Empty state: calm "al día" message, no urgency (AC-17-006.6, REQ-17-007 White-Hat). */
function EmptyState(): React.JSX.Element {
  return (
    <div
      data-testid="promotions-queue-empty"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "calc(var(--space-base) * 0.5)",
        padding: "calc(var(--space-base) * 2)",
        textAlign: "center",
        color: "color-mix(in oklch, var(--color-text) 55%, transparent)",
      }}
    >
      <span style={{ fontSize: "1.5rem", lineHeight: 1 }}>📜</span>
      <p style={{ margin: 0, fontSize: "0.875rem" }}>Sin propuestas pendientes — todo al día.</p>
      <p style={{ margin: 0, fontSize: "0.75rem", opacity: 0.7 }}>
        Cuando <code>/pandacorp:memory review</code> proponga una promoción, aparecerá aquí.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * PromotionsQueue — durable list of promotion proposals (CMP-17-promoqueue).
 *
 * Renders `promotion: proposed` lessons with a copyable /pandacorp:learn command,
 * and `promotion: rejected` lessons as informational state.
 *
 * The component is a pure display component — it never writes to factory/memory/.
 * All data is passed as props (pre-fetched by the Server Component page or a test).
 *
 * @param lessons - All lessons to consider. Those with promotion other than
 *                  "proposed" or "rejected" are silently filtered out.
 */
export function PromotionsQueue({ lessons }: PromotionsQueueProps): React.JSX.Element {
  // Filter to only proposed and rejected lessons (AC-17-006.1).
  const queueLessons = lessons.filter(
    (l) => l.promotion === "proposed" || l.promotion === "rejected",
  );

  return (
    <section
      data-testid="promotions-queue"
      aria-label="Cola de promociones"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-base)",
      }}
    >
      {/* Section heading */}
      <h2
        style={{
          margin: 0,
          fontSize: "1rem",
          fontWeight: 700,
          color: "var(--color-text)",
        }}
      >
        Cola de promociones
      </h2>
      <p
        style={{
          margin: 0,
          fontSize: "0.8rem",
          color: "color-mix(in oklch, var(--color-text) 65%, transparent)",
        }}
      >
        Lecciones propuestas para promover a estándar, regla o skill. El cronista propone; tú
        decides.
      </p>

      {/* Content */}
      {queueLessons.length === 0 ? (
        <EmptyState />
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "calc(var(--space-base) * 0.75)",
          }}
        >
          {queueLessons.map((lesson) =>
            lesson.promotion === "proposed" ? (
              <ProposedEntry key={lesson.id} lesson={lesson} />
            ) : (
              <RejectedEntry key={lesson.id} lesson={lesson} />
            ),
          )}
        </div>
      )}
    </section>
  );
}
