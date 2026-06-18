/**
 * CMP-10-secrets — Secret achievements panel (WO-10-008)
 *
 * Renders the secret achievements from computeSecrets():
 *   - LOCKED: silhouette + cryptic hint only (criterion hidden — AC-10-008.1)
 *   - UNLOCKED: hint + criterion revealed + date + project (anti-loot-box — AC-10-008.2)
 *
 * Honesty contract (blueprint §5):
 *   - Criterion revealed ONLY when unlocked (never permanent obscurity).
 *   - Reveal is honest: the actual triggering result from the Secret object (AC-10-008.3).
 *   - Locked/unlocked distinction NOT by color alone: silhouette icon + badge label (AC-10-008.4).
 *   - Design tokens only — zero hardcoded colors (FRD-13).
 *
 * Traceability:
 *   AC-10-008.1 — locked silhouette + hint, no criterion
 *   AC-10-008.2 — unlocked: criterion + date + project revealed
 *   AC-10-008.3 — honest reveal: exact Secret data, not fabricated
 *   AC-10-008.4 — tokens only; not color-alone (silhouette/badge/label)
 *
 * Blueprint: CMP-10-secrets (FRD-10 blueprint §4)
 * Source-of-truth hierarchy: FRD > FDD > design-tokens > blueprint > work order
 */

import type { Secret } from "@/lib/achievements/achievements";

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Format an ISO date string for display.
 * Returns the date portion only (YYYY-MM-DD) to keep the display compact.
 * If the date is missing or malformed, returns an empty string.
 */
function formatDate(isoDate: string | undefined): string {
  if (!isoDate) return "";
  // Slice the date portion from "YYYY-MM-DDTHH:MM:SSZ" → "YYYY-MM-DD"
  const datePart = isoDate.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return isoDate;
  return datePart;
}

// ── SecretItem ────────────────────────────────────────────────────────────────

type SecretItemProps = {
  secret: Secret;
};

function SecretItem({ secret }: SecretItemProps): React.JSX.Element {
  const isLocked = !secret.unlocked;
  const ariaLabel = isLocked
    ? `Logro secreto bloqueado: ${secret.hint}`
    : `Logro secreto desbloqueado: ${secret.hint}`;

  return (
    <li
      data-testid="secret-item"
      data-locked={String(isLocked)}
      aria-label={ariaLabel}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "calc(var(--space-base) * 0.375)",
        padding: "calc(var(--space-base) * 0.75)",
        borderRadius: "var(--radius)",
        background: "var(--color-surface)",
        boxShadow: "var(--shadow-1)",
        borderBottom: "var(--hairline) solid var(--color-base)",
        opacity: isLocked ? 0.65 : 1,
      }}
    >
      {/* ── Header row: silhouette/badge + hint ─────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "calc(var(--space-base) * 0.5)",
        }}
      >
        {/* Non-color visual distinction: silhouette (locked) or unlocked badge */}
        {isLocked ? (
          <span
            data-testid="secret-silhouette"
            role="img"
            aria-label="Logro secreto bloqueado"
            style={{
              fontSize: "1.25rem",
              lineHeight: 1,
              flexShrink: 0,
              filter: "grayscale(1) opacity(0.5)",
            }}
          >
            {"?"}
          </span>
        ) : (
          <span
            data-testid="secret-unlocked-badge"
            role="img"
            aria-label="Logro desbloqueado"
            style={{
              fontSize: "1.25rem",
              lineHeight: 1,
              flexShrink: 0,
            }}
          >
            {"!"}
          </span>
        )}

        {/* Cryptic hint — always visible (AC-10-008.1 + AC-10-008.2) */}
        <span
          data-testid="secret-hint"
          style={{
            color: "var(--color-text)",
            fontSize: "0.875rem",
            fontStyle: isLocked ? "italic" : "normal",
            opacity: isLocked ? 0.7 : 1,
            flex: 1,
          }}
        >
          {secret.hint}
        </span>
      </div>

      {/* ── Unlocked reveal: criterion + date + project (AC-10-008.2) ────────── */}
      {!isLocked && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "calc(var(--space-base) * 0.25)",
            paddingLeft: "calc(var(--space-base) * 1.75)",
            borderLeft: "2px solid var(--color-accent)",
          }}
        >
          {/* Criterion: what triggered it — honest reveal (AC-10-008.3) */}
          <span
            data-testid="secret-criterion"
            style={{
              color: "var(--color-text)",
              fontSize: "0.8125rem",
            }}
          >
            {secret.criterion}
          </span>

          {/* Date + project row */}
          <div
            style={{
              display: "flex",
              gap: "calc(var(--space-base) * 0.5)",
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            {secret.date !== undefined && (
              <span
                data-testid="secret-date"
                className="tabular-nums"
                style={{
                  color: "var(--color-text)",
                  fontSize: "0.75rem",
                  opacity: 0.75,
                }}
              >
                {formatDate(secret.date)}
              </span>
            )}

            {secret.project !== undefined && (
              <span
                data-testid="secret-project"
                style={{
                  color: "var(--color-text)",
                  fontSize: "0.75rem",
                  opacity: 0.75,
                  fontFamily: "monospace",
                }}
              >
                {secret.project}
              </span>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

// ── SecretsPanel ──────────────────────────────────────────────────────────────

export type SecretsPanelProps = {
  secrets: readonly Secret[];
};

/**
 * CMP-10-secrets — renders secret achievements.
 *
 * Accepts the Secret[] output of computeSecrets() directly.
 * Pure rendering component — no I/O, no state.
 */
export function SecretsPanel({ secrets }: SecretsPanelProps): React.JSX.Element {
  return (
    <section
      data-testid="secrets-panel"
      aria-label="Logros secretos"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 0,
      }}
    >
      {/* Section heading */}
      <h2
        style={{
          fontSize: "1rem",
          fontWeight: 600,
          color: "var(--color-text)",
          opacity: 0.7,
          marginBottom: "calc(var(--space-base) * 0.75)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        Logros secretos
      </h2>

      {/* Secret items list */}
      <ul
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
          display: "flex",
          flexDirection: "column",
          gap: "calc(var(--space-base) * 0.5)",
          borderRadius: "var(--radius)",
          overflow: "hidden",
          border: `var(--hairline) solid var(--color-base)`,
          boxShadow: "var(--shadow-1)",
        }}
      >
        {secrets.map((secret, idx) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: Secret objects have no stable id; hint is always defined but not guaranteed unique
          <SecretItem key={idx} secret={secret} />
        ))}
      </ul>
    </section>
  );
}
