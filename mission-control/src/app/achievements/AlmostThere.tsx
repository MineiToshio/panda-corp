/**
 * CMP-10-almost-there — "Almost there" section (WO-10-006)
 *
 * Renders the top chains by percentage to next tier (Zeigarnik effect).
 * Shows at most 3 chains — the ones closest to their next tier unlock.
 *
 * Honesty constraints (FRD-10, FRD-09 honesty contract, blueprint §5):
 *   - NO false urgency: no countdowns, no deadlines, no "¡rápido!", no "hoy".
 *   - NO nagging reminders or notifications.
 *   - Empty state is graceful: no fabricated progress.
 *   - Maxed chains (pctToNext=100) are excluded (nothing to progress toward).
 *
 * Design constraints:
 *   - Reuses CMP-09-xp-bar for the progress bar (honest, endowed).
 *   - Design tokens only — zero hardcoded colors.
 *   - Spanish labels and aria-labels.
 *
 * Traceability:
 *   AC-10-006.4 — top chains by % to next tier; no false urgency (negative AC)
 *   AC-10-006.3 — reuses CMP-09-xp-bar
 *   AC-10-006.5 — tokens only
 *
 * Blueprint: CMP-10-almost-there (FRD-10 blueprint §4)
 * Source-of-truth hierarchy: FRD > FDD > design-tokens > blueprint > work order
 */

import { XpBar } from "@/components/core/XpBar/XpBar";
import type { ChainState } from "@/lib/achievements/achievements";

// ── Constants ─────────────────────────────────────────────────────────────────

/** Maximum number of chains shown in the "Almost there" section. */
const MAX_ALMOST_THERE = 3;

// ── AlmostThereItem ───────────────────────────────────────────────────────────

type AlmostThereItemProps = {
  chain: ChainState;
};

/**
 * A single "almost there" entry: chain label + honest progress bar.
 *
 * Reuses CMP-09-xp-bar directly (AC-10-006.3 negative AC: no custom bar).
 * No urgency language — just shows the chain and progress (AC-10-006.4).
 */
function AlmostThereItem({ chain }: AlmostThereItemProps): React.JSX.Element {
  const nextTierName = chain.nextTier?.name ?? "Siguiente nivel";

  return (
    <li
      data-testid="almost-there-item"
      data-stat-key={chain.statKey}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "calc(var(--space-base) * 0.375)",
        padding: "calc(var(--space-base) * 0.75)",
        borderRadius: "var(--radius)",
        background: "var(--color-base)",
        boxShadow: "var(--shadow-1)",
      }}
    >
      {/* Chain label */}
      <span
        style={{
          fontSize: "0.875rem",
          fontWeight: 600,
          color: "var(--color-text)",
        }}
      >
        {chain.label}
      </span>

      {/* Honest progress bar (CMP-09-xp-bar — AC-10-006.3) */}
      <XpBar
        xp={chain.pctToNext}
        next={100}
        pctToNext={chain.pctToNext}
        label={chain.currentTierName ?? chain.label}
        nextTitle={nextTierName}
      />
    </li>
  );
}

// ── AlmostThere ───────────────────────────────────────────────────────────────

export type AlmostThereProps = {
  chains: readonly ChainState[];
};

/**
 * CMP-10-almost-there — the "Casi allí" section.
 *
 * Selects the top MAX_ALMOST_THERE chains by pctToNext (descending),
 * excluding maxed chains (pctToNext === 100 or nextTier === null).
 *
 * Server Component: pure render from already-computed chain states.
 * No I/O, no client hooks.
 *
 * AC-10-006.4 negative ACs (all enforced here by absence):
 *   - No countdown timers or deadlines in the output.
 *   - No urgency words ("hoy", "ahora mismo", "rápido", "¡", "urgente").
 *   - No nagging text or notification-style CTA.
 */
export function AlmostThere({ chains }: AlmostThereProps): React.JSX.Element {
  // Filter out maxed chains and sort descending by pctToNext
  const candidates = [...chains]
    .filter((c) => c.nextTier !== null && c.pctToNext < 100)
    .sort((a, b) => b.pctToNext - a.pctToNext)
    .slice(0, MAX_ALMOST_THERE);

  return (
    <section
      data-testid="almost-there"
      aria-label="Cadenas casi desbloqueadas"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "calc(var(--space-base) * 0.75)",
      }}
    >
      {/* Section heading — calm, no urgency */}
      <h3
        style={{
          fontSize: "0.875rem",
          fontWeight: 600,
          color: "var(--color-text)",
          opacity: 0.7,
          margin: 0,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        Cerca del siguiente logro
      </h3>

      {candidates.length === 0 ? (
        // Empty state: no fabrication, no pressure
        <p
          data-testid="almost-there-empty"
          style={{
            fontSize: "0.875rem",
            color: "var(--color-text)",
            opacity: 0.5,
            margin: 0,
          }}
        >
          Sigue construyendo para ver tu progreso aquí.
        </p>
      ) : (
        <ul
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "flex",
            flexDirection: "column",
            gap: "calc(var(--space-base) * 0.5)",
          }}
        >
          {candidates.map((chain) => (
            <AlmostThereItem key={chain.statKey} chain={chain} />
          ))}
        </ul>
      )}
    </section>
  );
}
