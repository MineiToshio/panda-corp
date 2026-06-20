/**
 * CMP-10-chain-card — Cumulative chain card (WO-10-006, re-styled WO-10-005)
 *
 * Renders a single cumulative chain in three variants matching the prototype:
 *   "card"  (default) — rpgChainCard(): 42px ItemSlot + node pips + 12px xpbar + stamp
 *   "spot"             — rpgChainSpot(): 58px ItemSlot + big pixel % right + 14px xpbar
 *   "mini"             — rpgChainMini(): 34px ItemSlot + 9px compact xpbar + next-tier label
 *
 * Visual reference: prototype rpgChainCard / rpgChainSpot / rpgChainMini functions.
 *
 * Design constraints (FRD-10, FRD-13, blueprint §4):
 *   - Tier colors via CSS custom properties only — zero hardcoded hex/rgb/hsl.
 *   - State never by color alone: badge has text label + data-tier attribute.
 *   - Reuses CMP-09-xp-bar — does NOT implement a custom bar (AC-10-006.3 negative AC).
 *   - No false urgency, countdowns or nagging language.
 *   - rpgpanel emboss via inline style (not a global CSS class).
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

import { ItemSlot } from "@/components/core/ItemSlot/ItemSlot";
import { XpBar } from "@/components/core/XpBar/XpBar";
import type { ChainState } from "@/lib/achievements/achievements";
import { CHAIN_DEFINITIONS } from "@/lib/achievements/definitions";
import type { TierUnlockEvent } from "@/lib/achievements/stats";

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

// ── RPGPanel inline styles ────────────────────────────────────────────────────

/**
 * The rpgpanel emboss style (from design-tokens.json rpgSkin.rpgpanel).
 * Applied inline — no CSS class in globals.css.
 */
const RPGPANEL_STYLE: React.CSSProperties = {
  background: "var(--color-card)",
  border: "1px solid var(--color-border-strong)",
  borderRadius: "10px",
  boxShadow:
    "inset 0 1px 0 rgba(255,255,255,.05), inset 0 -2px 0 rgba(0,0,0,.22), 0 2px 0 var(--color-base)",
  display: "flex",
  flexDirection: "column",
  gap: "10px",
  padding: "12px",
};

// ── Chain icon map ────────────────────────────────────────────────────────────

/** Tabler icon class per statKey (matches prototype CHAINS[].ic). */
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

// ── TierPips — node ladder ────────────────────────────────────────────────────

type TierPipsProps = {
  totalTiers: number;
  currentTierIndex: number;
  /** Size of each pip circle in px (default 9). */
  size?: number;
};

// ── TierPip (single pip + optional connector) ────────────────────────────────

type TierPipProps = {
  index: number;
  currentTierIndex: number;
  size: number;
};

/** One pip circle with an optional leading connector line. */
function TierPip({ index, currentTierIndex, size }: TierPipProps): React.JSX.Element {
  const filled = index <= currentTierIndex;
  const tierNum = index + 1;
  const pipLabel = filled
    ? `Nivel ${TIER_LABELS[tierNum] ?? tierNum} desbloqueado`
    : `Nivel ${TIER_LABELS[tierNum] ?? tierNum} bloqueado`;
  const color = filled ? tierColorToken(tierNum) : "var(--color-border-strong)";
  const connectorColor =
    index <= currentTierIndex ? tierColorToken(index) : "var(--color-border-strong)";

  return (
    <span key={`pip-${tierNum}`} style={{ display: "flex", alignItems: "center" }}>
      {/* Connector line between pips (not before first) */}
      {index > 0 && (
        <span
          aria-hidden="true"
          style={{
            display: "inline-block",
            width: "12px",
            height: "1.5px",
            background: connectorColor,
            opacity: index <= currentTierIndex ? 0.6 : 0.25,
            flexShrink: 0,
          }}
        />
      )}
      <span
        data-testid={`chain-pip-${index}`}
        data-filled={filled ? "true" : "false"}
        title={pipLabel}
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          background: filled ? color : "var(--color-base)",
          border: `1.5px solid ${color}`,
          opacity: filled ? 1 : 0.3,
          flexShrink: 0,
          display: "inline-block",
        }}
      />
    </span>
  );
}

/**
 * Renders one pip per tier connected by lines — matches prototype .node + connector.
 * State is NOT conveyed by color alone: data-filled attribute present.
 * No role="group" (not a fieldset context — plain presentational pip row).
 */
function TierPips({ totalTiers, currentTierIndex, size = 9 }: TierPipsProps): React.JSX.Element {
  // Build a stable array of tier indices (not generated inline to avoid index-as-key)
  const tierIndices = Array.from({ length: totalTiers }, (_, i) => i);
  return (
    <span
      role="img"
      aria-label={`${currentTierIndex + 1} de ${totalTiers} niveles`}
      style={{
        display: "flex",
        gap: 0,
        alignItems: "center",
      }}
    >
      {tierIndices.map((i) => (
        <TierPip key={`tier-pip-${i}`} index={i} currentTierIndex={currentTierIndex} size={size} />
      ))}
    </span>
  );
}

// ── Stamp line ────────────────────────────────────────────────────────────────

type StampLineProps = {
  unlock: TierUnlockEvent;
};

function StampLine({ unlock }: StampLineProps): React.JSX.Element {
  return (
    <span
      data-testid="chain-unlock-item"
      data-tier={unlock.tier + 1}
      style={{
        display: "flex",
        gap: "5px",
        alignItems: "center",
        fontSize: "10px",
        color: "var(--color-text3)",
        lineHeight: 1.2,
      }}
    >
      <i className="ti ti-calendar" aria-hidden="true" style={{ fontSize: "11px" }} />
      <span className="tabular-nums">{unlock.date}</span>
      <span aria-hidden="true" style={{ opacity: 0.5 }}>
        ·
      </span>
      <span style={{ fontStyle: "italic", opacity: 0.85 }}>{unlock.project}</span>
    </span>
  );
}

// ── ChainCard ─────────────────────────────────────────────────────────────────

export type ChainCardVariant = "card" | "spot" | "mini";

export type ChainCardProps = {
  chain: ChainState;
  /**
   * Visual variant — matches prototype rendering functions:
   *   "card"  (default) → rpgChainCard(): the standard grid card
   *   "spot"             → rpgChainSpot(): full-width spotlight for the top chain
   *   "mini"             → rpgChainMini(): compact row for common chains
   */
  variant?: ChainCardVariant;
};

/** Shared derived values passed to each ChainCard variant sub-renderer. */
type ChainCardDerived = {
  statKey: string;
  label: string;
  currentTierIndex: number;
  currentTierName: string | null;
  nextTier: ChainState["nextTier"];
  unlocks: ChainState["unlocks"];
  totalTiers: number;
  tierNum: number;
  tierLabel: string;
  nextTierName: string;
  barPct: number;
  tierColor: string;
  iconNode: React.ReactNode;
};

function deriveChainCard(chain: ChainState): ChainCardDerived {
  const { statKey, label, currentTierIndex, currentTierName, nextTier, pctToNext, unlocks } = chain;
  const chainDef = CHAIN_DEFINITIONS.find((c) => c.statKey === statKey);
  const totalTiers = chainDef?.tiers.length ?? 0;
  const tierNum = Math.max(0, currentTierIndex + 1);
  const tierLabel = tierNum > 0 ? (TIER_LABELS[tierNum] ?? currentTierName ?? "—") : "Sin nivel";
  const nextTierName = nextTier?.name ?? "Máximo";
  const barPct = nextTier !== null ? pctToNext : 100;
  const tierColor = tierNum > 0 ? tierColorToken(tierNum) : "var(--color-border-strong)";
  const iconClass = CHAIN_ICONS[statKey] ?? "ti-star";
  const iconNode = (
    <i
      data-chain-icon={statKey}
      className={`ti ${iconClass}`}
      aria-hidden="true"
      style={{ fontSize: "1.1em", color: tierNum > 0 ? tierColor : "var(--color-text3)" }}
    />
  );
  return {
    statKey,
    label,
    currentTierIndex,
    currentTierName,
    nextTier,
    unlocks,
    totalTiers,
    tierNum,
    tierLabel,
    nextTierName,
    barPct,
    tierColor,
    iconNode,
  };
}

/**
 * CMP-10-chain-card — a single cumulative chain card.
 *
 * Server Component: all data is passed in from computeChains() — no I/O, no hooks.
 * Variant rendering is delegated to sub-functions to keep cognitive complexity low.
 */
export function ChainCard({ chain, variant = "card" }: ChainCardProps): React.JSX.Element {
  const d = deriveChainCard(chain);
  const {
    statKey: _statKey,
    label,
    currentTierIndex,
    nextTier,
    unlocks,
    totalTiers,
    tierNum,
    tierLabel,
    nextTierName,
    barPct,
    tierColor,
    iconNode,
  } = d;

  // ── Spot variant (rpgChainSpot) ─────────────────────────────────────────────
  if (variant === "spot") {
    return (
      <article
        data-testid="chain-card"
        data-variant="spot"
        aria-label={`Misión en destaque: ${label}`}
        style={{
          ...RPGPANEL_STYLE,
          flexDirection: "row",
          alignItems: "center",
          gap: "14px",
          border: "1.5px solid var(--color-border-strong)",
          padding: "14px 16px",
        }}
      >
        {/* Large ItemSlot (58px) */}
        <ItemSlot icon={iconNode} size={58} tone="accent" aria-label={`Cadena: ${label}`} />

        {/* Body: label + xpbar */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "8px" }}>
          {/* Tier badge + label */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <span
              data-testid="chain-tier-badge"
              data-tier={tierNum}
              style={{
                fontFamily: "var(--font-pixel)",
                fontSize: "9px",
                background: tierColor,
                color: "var(--color-base)",
                padding: "1px 5px",
                borderRadius: "3px",
              }}
            >
              {tierLabel}
            </span>
            <span style={{ fontWeight: 600, fontSize: "0.875rem", color: "var(--color-text)" }}>
              {label}
            </span>
          </div>
          {/* Next tier name */}
          {nextTier !== null && (
            <span
              data-testid="chain-next-tier-name"
              style={{ fontSize: "0.75rem", color: "var(--color-text3)" }}
            >
              → {nextTier.name}
            </span>
          )}
          {/* Xpbar 14px */}
          <div data-testid="chain-xp-bar-wrapper">
            <XpBar
              xp={barPct}
              next={100}
              pctToNext={barPct}
              label={tierLabel}
              nextTitle={nextTierName}
            />
          </div>
          {/* Tier pips */}
          {totalTiers > 0 && (
            <TierPips totalTiers={totalTiers} currentTierIndex={currentTierIndex} />
          )}
        </div>

        {/* Big pixel % numeral (right side) */}
        <span
          aria-hidden="true"
          style={{
            fontFamily: "var(--font-pixel)",
            fontSize: "32px",
            color: tierColor,
            lineHeight: 1,
            letterSpacing: "-1px",
            flexShrink: 0,
          }}
        >
          {barPct}
          <span style={{ fontSize: "14px", opacity: 0.7 }}>%</span>
        </span>
      </article>
    );
  }

  // ── Mini variant (rpgChainMini) ─────────────────────────────────────────────
  if (variant === "mini") {
    return (
      <article
        data-testid="chain-card"
        data-variant="mini"
        aria-label={`Cadena: ${label}`}
        style={{
          ...RPGPANEL_STYLE,
          flexDirection: "row",
          alignItems: "center",
          gap: "8px",
          padding: "8px 10px",
        }}
      >
        {/* Small ItemSlot (34px) */}
        <ItemSlot icon={iconNode} size={34} aria-label={`Cadena: ${label}`} />

        {/* Body: label + compact xpbar + next-tier */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "5px", minWidth: 0 }}>
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
            {label}
          </span>
          <div data-testid="chain-xp-bar-wrapper">
            <XpBar
              xp={barPct}
              next={100}
              pctToNext={barPct}
              label={tierLabel}
              nextTitle={nextTierName}
              size="compact"
            />
          </div>
          {nextTier !== null && (
            <span
              data-testid="chain-next-tier-name"
              style={{ fontSize: "10px", color: "var(--color-text3)" }}
            >
              {nextTier.name}
            </span>
          )}
        </div>

        {/* Tier badge */}
        <span
          data-testid="chain-tier-badge"
          data-tier={tierNum}
          style={{
            fontFamily: "var(--font-pixel)",
            fontSize: "9px",
            background: tierColor,
            color: "var(--color-base)",
            padding: "1px 5px",
            borderRadius: "3px",
            flexShrink: 0,
          }}
        >
          {tierLabel}
        </span>
      </article>
    );
  }

  // ── Card variant (default, rpgChainCard) ────────────────────────────────────
  return (
    <article
      data-testid="chain-card"
      data-variant="card"
      aria-label={`Cadena: ${label}`}
      style={{
        ...RPGPANEL_STYLE,
      }}
    >
      {/* ── Header: ItemSlot + label + tier pips + badge ────────────────── */}
      <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
        {/* ItemSlot (42px, tier-colored border) */}
        <ItemSlot icon={iconNode} size={42} aria-label={`Cadena: ${label}`} />

        {/* Label + tier info */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "5px", minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span
              data-testid="chain-label"
              style={{
                fontSize: "0.875rem",
                fontWeight: 600,
                color: "var(--color-text)",
                flex: 1,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {label}
            </span>

            {/* Tier badge (text + data-tier — not color-alone — AC-10-006.5) */}
            <span
              data-testid="chain-tier-badge"
              data-tier={tierNum}
              style={{
                fontFamily: "var(--font-pixel)",
                fontSize: "9px",
                background: tierColor,
                color: "var(--color-base)",
                padding: "1px 5px",
                borderRadius: "3px",
                flexShrink: 0,
                opacity: tierNum > 0 ? 1 : 0.35,
              }}
            >
              {tierLabel}
            </span>
          </div>

          {/* Node pips ladder */}
          {totalTiers > 0 && (
            <TierPips totalTiers={totalTiers} currentTierIndex={currentTierIndex} />
          )}
        </div>
      </div>

      {/* ── Progress bar (12px — CMP-09-xp-bar, AC-10-006.3) ───────────── */}
      <div data-testid="chain-xp-bar-wrapper">
        <XpBar
          xp={barPct}
          next={100}
          pctToNext={barPct}
          label={tierLabel}
          nextTitle={nextTierName}
        />
      </div>

      {/* Next tier name label (AC-10-006.1) */}
      {nextTier !== null && (
        <span
          data-testid="chain-next-tier-name"
          style={{
            fontSize: "0.75rem",
            color: "var(--color-text3)",
            opacity: 0.8,
          }}
        >
          Siguiente: {nextTier.name}
        </span>
      )}

      {/* ── Stamp lines (date + project per unlock — AC-10-006.2) ────────── */}
      {unlocks.map((unlock: TierUnlockEvent) => (
        <StampLine key={`unlock-tier-${unlock.tier}`} unlock={unlock} />
      ))}
    </article>
  );
}
