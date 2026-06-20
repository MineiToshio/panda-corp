/**
 * CMP-10-almost-there — "Almost there" / questsNear section (WO-10-005 re-style)
 *
 * Renders the top chains by percentage to next tier (Zeigarnik effect).
 * Shows at most 3 chains — the ones closest to their next tier unlock.
 *
 * Visual reference: prototype questsNear() — rpgpanel cards with:
 *   - 34px accent ItemSlot (chain icon)
 *   - next-tier-name (small, above chain label)
 *   - chain label
 *   - big 18px pixel % numeral (right side)
 *   - 12px compact XpBar
 *   - flag icon + unlock-count line
 *
 * Honesty constraints (FRD-10, FRD-09 honesty contract, blueprint §5):
 *   - NO false urgency: no countdowns, no deadlines, no "¡rápido!", no "hoy".
 *   - NO nagging reminders or notifications.
 *   - Empty state is graceful: no fabricated progress.
 *   - Maxed chains (pctToNext=100) are excluded (nothing to progress toward).
 *
 * Design constraints:
 *   - Reuses CMP-09-xp-bar (compact) — AC-10-006.3 negative AC.
 *   - Reuses CMP-13-itemslot for the 34px icon slot.
 *   - rpgpanel emboss inline (no global CSS class).
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

import { ItemSlot } from "@/components/core/ItemSlot/ItemSlot";
import { XpBar } from "@/components/core/XpBar/XpBar";
import type { ChainState } from "@/lib/achievements/achievements";

// ── Constants ─────────────────────────────────────────────────────────────────

/** Maximum number of chains shown in the "Almost there" section. */
const MAX_ALMOST_THERE = 3;

// ── Chain icon map (matches prototype CHAINS[].ic) ────────────────────────────

const CHAIN_ICONS: Record<string, string> = {
  shipped: "ti-rocket",
  ideas: "ti-bulb",
  workorders: "ti-checkbox",
  phases: "ti-stairs-up",
  iterations: "ti-refresh",
  flawless: "ti-diamond",
  discarded: "ti-trash",
  prds: "ti-file-text",
  adrs: "ti-notebook",
  agents: "ti-users-group",
  streak: "ti-flame",
  speed: "ti-bolt",
};

// ── RPGPanel inline style ─────────────────────────────────────────────────────

const RPGPANEL_STYLE: React.CSSProperties = {
  background: "var(--color-card)",
  border: "1px solid var(--color-border-strong)",
  borderRadius: "10px",
  boxShadow:
    "inset 0 1px 0 rgba(255,255,255,.05), inset 0 -2px 0 rgba(0,0,0,.22), 0 2px 0 var(--color-base)",
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  padding: "10px 12px",
};

// ── AlmostThereItem ───────────────────────────────────────────────────────────

type AlmostThereItemProps = {
  chain: ChainState;
};

/**
 * A single "almost there" entry — matches prototype questsNear() card structure.
 *
 * Layout: 34px accent ItemSlot (left) + body (next-tier-name + label + xpbar) + pct% (right).
 * Reuses CMP-09-xp-bar size="compact" (AC-10-006.3 negative AC).
 * No urgency language — just shows the chain and progress (AC-10-006.4).
 */
function AlmostThereItem({ chain }: AlmostThereItemProps): React.JSX.Element {
  const nextTierName = chain.nextTier?.name ?? "Siguiente nivel";
  const iconClass = CHAIN_ICONS[chain.statKey] ?? "ti-star";

  const iconNode = (
    <i
      data-chain-icon={chain.statKey}
      className={`ti ${iconClass}`}
      aria-hidden="true"
      style={{ fontSize: "1rem", color: "var(--color-accent-text)" }}
    />
  );

  return (
    <li data-testid="almost-there-item" data-stat-key={chain.statKey} style={RPGPANEL_STYLE}>
      {/* Main row: ItemSlot + body + pct numeral */}
      <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
        {/* 34px accent ItemSlot (chain icon) */}
        <ItemSlot icon={iconNode} size={34} tone="accent" aria-label={`Cadena: ${chain.label}`} />

        {/* Body: next-tier name + chain label + xpbar */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px", minWidth: 0 }}>
          {/* Next tier name — small, above label */}
          <span
            style={{
              fontSize: "10px",
              color: "var(--color-accent-text)",
              fontFamily: "var(--font-pixel)",
              opacity: 0.85,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {nextTierName}
          </span>

          {/* Chain label */}
          <span
            style={{
              fontSize: "0.8rem",
              fontWeight: 600,
              color: "var(--color-text)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {chain.label}
          </span>

          {/* Compact XpBar (honest progress — AC-10-006.3) */}
          <div data-testid="almost-there-xpbar">
            <XpBar
              xp={chain.pctToNext}
              next={100}
              pctToNext={chain.pctToNext}
              label={chain.currentTierName ?? chain.label}
              nextTitle={nextTierName}
              size="compact"
            />
          </div>
        </div>

        {/* Big pixel % numeral (right side — prototype .big 18px pixel) */}
        <span
          aria-hidden="true"
          style={{
            fontFamily: "var(--font-pixel)",
            fontSize: "18px",
            color: "var(--color-accent)",
            lineHeight: 1,
            flexShrink: 0,
            letterSpacing: "-0.5px",
          }}
        >
          {chain.pctToNext}
          <span style={{ fontSize: "10px", opacity: 0.7 }}>%</span>
        </span>
      </div>

      {/* Flag icon + unlock-count (prototype: flag icon + tier count) */}
      {chain.unlocks.length > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            fontSize: "10px",
            color: "var(--color-text3)",
          }}
        >
          <i className="ti ti-flag" aria-hidden="true" style={{ fontSize: "11px" }} />
          <span>
            {chain.unlocks.length}{" "}
            {chain.unlocks.length === 1 ? "nivel desbloqueado" : "niveles desbloqueados"}
          </span>
        </div>
      )}
    </li>
  );
}

// ── AlmostThere ───────────────────────────────────────────────────────────────

export type AlmostThereProps = {
  chains: readonly ChainState[];
};

/**
 * CMP-10-almost-there — the "Próximas hazañas" section.
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
      aria-label="Cadenas próximas al siguiente nivel"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-base)",
      }}
    >
      {/* Section heading — matches prototype questsNear() SectionHead text */}
      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
        <span
          style={{
            fontSize: "0.875rem",
            fontWeight: 700,
            color: "var(--color-text)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          Próximas hazañas
        </span>
        <span
          style={{
            fontSize: "0.75rem",
            color: "var(--color-text3)",
          }}
        >
          a un paso de caer
        </span>
      </div>

      {candidates.length === 0 ? (
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
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(225px, 1fr))",
            gap: "calc(var(--space-base) * 0.75)",
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
