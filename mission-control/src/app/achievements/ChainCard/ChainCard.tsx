/**
 * CMP-10-chain-card — Cumulative chain card (WO-10-006)
 *
 * Renders a single cumulative chain with:
 *   - tier pips (one per tier, filled = unlocked)
 *   - current tier badge (text label + data-tier attribute, not color-alone)
 *   - honest endowed-progress bar to the next tier (reuses CMP-09-xp-bar)
 *   - next tier name
 *   - unlock date + project per tier (AC-10-006.2)
 *
 * Design constraints (FRD-10, FRD-13, blueprint §4):
 *   - Tier colors via CSS custom properties only — zero hardcoded hex/rgb/hsl.
 *   - State never by color alone: badge has text label + data-tier attribute.
 *   - Reuses CMP-09-xp-bar — does NOT implement a custom bar (AC-10-006.3 negative AC).
 *   - No false urgency, countdowns or nagging language.
 *
 * Traceability:
 *   AC-10-006.1 — current tier, bar with next tier name, tier pips
 *   AC-10-006.2 — unlock date + project per tier
 *   AC-10-006.3 — honest endowed bar reusing CMP-09-xp-bar (negative AC)
 *   AC-10-006.5 — tier colors from tokens; state not color-alone
 *
 * Blueprint: CMP-10-chain-card (FRD-10 blueprint §4)
 * Source-of-truth hierarchy: FRD > FDD > design-tokens > blueprint > work order
 */

import { XpBar } from "@/components/core/XpBar/XpBar";
import {
  CHAIN_DEFINITIONS,
  type ChainState,
  type TierUnlockEvent,
} from "@/lib/achievements/achievements";

// ── Tier label helpers ────────────────────────────────────────────────────────

/** Spanish tier labels (Bronze → Legend), 1-indexed. */
const TIER_LABELS: Record<number, string> = {
  1: "Bronce",
  2: "Plata",
  3: "Oro",
  4: "Platino",
  5: "Leyenda",
};

/**
 * Returns the CSS color token for a given tier (1-indexed).
 * Uses --color-tier-N with fallback to known agent tokens.
 * Never a hardcoded color.
 */
function tierColorToken(tier: number): string {
  switch (tier) {
    case 1:
      return "var(--color-tier-1, var(--color-agent-researcher))";
    case 2:
      return "var(--color-tier-2, var(--color-agent-frontend-dev))";
    case 3:
      return "var(--color-tier-3, var(--color-accent))";
    case 4:
      return "var(--color-tier-4, var(--color-agent-reviewer))";
    case 5:
      return "var(--color-tier-5, var(--color-agent-product-manager))";
    default:
      return "var(--color-text)";
  }
}

// ── Tier pips ────────────────────────────────────────────────────────────────

type TierPipsProps = {
  totalTiers: number;
  currentTierIndex: number;
};

/**
 * Renders one pip per tier. Filled pips = unlocked tiers.
 * State is NOT conveyed by color alone: data-filled attribute present.
 * Uses role="group" to support aria-label on the container.
 */
function TierPips({ totalTiers, currentTierIndex }: TierPipsProps): React.JSX.Element {
  return (
    <span
      title={`${currentTierIndex + 1} de ${totalTiers} niveles desbloqueados`}
      style={{
        display: "flex",
        gap: "calc(var(--space-base) * 0.25)",
        alignItems: "center",
      }}
    >
      {Array.from({ length: totalTiers }, (_, i) => {
        const filled = i <= currentTierIndex;
        const tierNum = i + 1;
        const pipLabel = filled
          ? `Nivel ${TIER_LABELS[tierNum] ?? tierNum} desbloqueado`
          : `Nivel ${TIER_LABELS[tierNum] ?? tierNum} bloqueado`;
        return (
          <span
            key={`pip-${tierNum}`}
            data-testid={`chain-pip-${i}`}
            data-filled={filled ? "true" : "false"}
            title={pipLabel}
            style={{
              width: "calc(var(--space-base) * 0.5)",
              height: "calc(var(--space-base) * 0.5)",
              borderRadius: "50%",
              background: filled ? tierColorToken(tierNum) : "var(--color-base)",
              border: `var(--hairline) solid ${filled ? tierColorToken(tierNum) : "var(--color-text)"}`,
              opacity: filled ? 1 : 0.35,
              flexShrink: 0,
              display: "inline-block",
            }}
          />
        );
      })}
    </span>
  );
}

// ── Unlock list ───────────────────────────────────────────────────────────────

type UnlockListProps = {
  unlocks: ChainState["unlocks"];
};

/**
 * Shows the date + project for each unlocked tier.
 * AC-10-006.2: every unlocked tier entry must be visible.
 */
function UnlockList({ unlocks }: UnlockListProps): React.JSX.Element | null {
  if (unlocks.length === 0) return null;

  return (
    <ul
      style={{
        listStyle: "none",
        margin: 0,
        padding: 0,
        display: "flex",
        flexDirection: "column",
        gap: "calc(var(--space-base) * 0.25)",
      }}
    >
      {unlocks.map((unlock: TierUnlockEvent) => {
        const tierNum = unlock.tier + 1;
        const tierLabel = TIER_LABELS[tierNum] ?? `Nivel ${tierNum}`;
        return (
          <li
            key={`unlock-tier-${unlock.tier}`}
            data-testid="chain-unlock-item"
            data-tier={tierNum}
            style={{
              display: "flex",
              gap: "calc(var(--space-base) * 0.375)",
              alignItems: "baseline",
              fontSize: "0.75rem",
              color: "var(--color-text)",
              opacity: 0.7,
            }}
          >
            {/* Tier label */}
            <span
              style={{
                fontWeight: 600,
                color: tierColorToken(tierNum),
                opacity: 1,
                minWidth: "3.5rem",
              }}
            >
              {tierLabel}
            </span>
            {/* Date */}
            <span className="tabular-nums">{unlock.date}</span>
            {/* Separator */}
            <span aria-hidden="true" style={{ opacity: 0.5 }}>
              ·
            </span>
            {/* Project */}
            <span
              style={{
                fontStyle: "italic",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                maxWidth: "10rem",
              }}
            >
              {unlock.project}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

// ── ChainCard ─────────────────────────────────────────────────────────────────

export type ChainCardProps = {
  chain: ChainState;
};

/**
 * CMP-10-chain-card — a single cumulative chain card.
 *
 * Server Component: all data is passed in from computeChains() — no I/O, no hooks.
 */
export function ChainCard({ chain }: ChainCardProps): React.JSX.Element {
  const { statKey, label, currentTierIndex, currentTierName, nextTier, pctToNext, unlocks } = chain;

  // Resolve total tiers for this chain's definition
  const chainDef = CHAIN_DEFINITIONS.find((c) => c.statKey === statKey);
  const totalTiers = chainDef?.tiers.length ?? 0;

  // Current tier number (1-indexed; 0 = no tier yet)
  const tierNum = Math.max(0, currentTierIndex + 1);
  const tierLabel = tierNum > 0 ? (TIER_LABELS[tierNum] ?? currentTierName ?? "—") : "Sin nivel";

  // For XpBar: pass pctToNext directly as xp (0–100 scale, next=100).
  // The visual fill is the real derived value from computeChains — honest by construction.
  const xpBarLabel = tierLabel;
  const nextTierName = nextTier?.name ?? "Máximo";

  // When maxed (no next tier), render at 100%.
  const barPct = nextTier !== null ? pctToNext : 100;

  return (
    <article
      data-testid="chain-card"
      aria-label={`Cadena: ${label}`}
      style={{
        background: "var(--color-base)",
        borderRadius: "var(--radius)",
        boxShadow: "var(--shadow-1)",
        padding: "calc(var(--space-base) * 1)",
        display: "flex",
        flexDirection: "column",
        gap: "calc(var(--space-base) * 0.625)",
        border: `var(--hairline) solid var(--color-base)`,
      }}
    >
      {/* ── Header: label + tier pips + tier badge ──────────────────────── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "calc(var(--space-base) * 0.5)",
        }}
      >
        {/* Chain label */}
        <span
          data-testid="chain-label"
          style={{
            fontSize: "0.875rem",
            fontWeight: 600,
            color: "var(--color-text)",
            flex: 1,
          }}
        >
          {label}
        </span>

        {/* Tier pips + current tier badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "calc(var(--space-base) * 0.5)",
            flexShrink: 0,
          }}
        >
          {totalTiers > 0 && (
            <TierPips totalTiers={totalTiers} currentTierIndex={currentTierIndex} />
          )}

          {/* Tier badge — text label + data-tier (not color-alone — AC-10-006.5) */}
          <span
            data-testid="chain-tier-badge"
            data-tier={tierNum}
            style={{
              fontSize: "0.75rem",
              fontWeight: 700,
              color: tierNum > 0 ? tierColorToken(tierNum) : "var(--color-text)",
              opacity: tierNum > 0 ? 1 : 0.45,
              padding: "calc(var(--space-base) * 0.125) calc(var(--space-base) * 0.375)",
              borderRadius: "var(--radius)",
              border: `var(--hairline) solid ${tierNum > 0 ? tierColorToken(tierNum) : "var(--color-text)"}`,
              whiteSpace: "nowrap",
            }}
          >
            {tierLabel}
          </span>
        </div>
      </div>

      {/* ── Progress bar (CMP-09-xp-bar — AC-10-006.3) ─────────────────── */}
      <div data-testid="chain-xp-bar-wrapper">
        <XpBar
          xp={barPct}
          next={100}
          pctToNext={barPct}
          label={xpBarLabel}
          nextTitle={nextTierName}
        />
      </div>

      {/* Next tier name label (AC-10-006.1) */}
      {nextTier !== null && (
        <span
          data-testid="chain-next-tier-name"
          style={{
            fontSize: "0.75rem",
            color: "var(--color-text)",
            opacity: 0.6,
          }}
        >
          Siguiente: {nextTier.name}
        </span>
      )}

      {/* ── Unlock history (AC-10-006.2) ────────────────────────────────── */}
      <UnlockList unlocks={unlocks} />
    </article>
  );
}
