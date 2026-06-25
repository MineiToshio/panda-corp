/**
 * CMP-10-chain-card — Cumulative chain card (WO-10-006, re-styled WO-10-005)
 *
 * Three variants faithful to the prototype rpgChainSpot / rpgChainCard / rpgChainMini:
 *   - The prominent title is the CURRENT TIER's fun name (e.g. "Máquina de ideas");
 *     the chain name (e.g. "Ideas capturadas") is the subtitle.
 *   - The badge shows the tier RARITY (Común → Leyenda), tier-colored.
 *   - A full-width node ladder (the stepped tier dots) shows progress across tiers.
 *   - The bar is tier-colored (reuses CMP-09-xp-bar via its fillColor prop — honest,
 *     no custom bar, AC-10-006.3) with a goal row "→ <next> · valor / umbral".
 *   - Completed chains show "Cadena legendaria completada" + the unlock stamp.
 *
 * Visual reference: prototype rpgChainSpot / rpgChainCard / rpgChainMini functions.
 *
 * Design constraints (FRD-10, FRD-13, blueprint §4):
 *   - Tier colors via tokens only (lib/achievements/tiers) — zero hardcoded hex/rgb/hsl.
 *   - State never by color alone: badge has a text rarity label + data-tier attribute.
 *   - Reuses CMP-09-xp-bar — does NOT implement a custom bar (AC-10-006.3 negative AC).
 *
 * Traceability:
 *   AC-10-006.1 — current tier, bar with next tier name, tier nodes
 *   AC-10-006.2 — unlock date + project per tier (incl. completed)
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
import { tierColor, tierRarityName } from "@/lib/achievements/tiers";

// ── RPGPanel inline style (design-tokens.json rpgSkin.rpgpanel) ─────────────────

const RPGPANEL_STYLE: React.CSSProperties = {
  background: "var(--color-card)",
  border: "1px solid var(--color-border-strong)",
  borderRadius: "10px",
  boxShadow:
    "inset 0 1px 0 rgba(255,255,255,.05), inset 0 -2px 0 rgba(0,0,0,.22), 0 2px 0 var(--color-base)",
  display: "flex",
  flexDirection: "column",
  gap: "10px",
  padding: "14px",
};

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

// ── Node ladder (the stepped tier dots, full-width flex — prototype .node row) ───

type NodeLadderProps = {
  totalTiers: number;
  currentTierIndex: number;
  /** Dot diameter in px (card 10, spot 18). */
  nodeSize?: number;
  /** Connector line height in px (card 3, spot 4). */
  connectorHeight?: number;
};

function NodeLadder({
  totalTiers,
  currentTierIndex,
  nodeSize = 10,
  connectorHeight = 3,
}: NodeLadderProps): React.JSX.Element {
  const indices = Array.from({ length: totalTiers }, (_, i) => i);
  return (
    <span
      role="img"
      aria-label={`${currentTierIndex + 1} de ${totalTiers} niveles`}
      style={{ display: "flex", alignItems: "center", width: "100%" }}
    >
      {indices.map((i) => {
        const filled = i <= currentTierIndex;
        const color = filled ? tierColor(i) : "var(--color-border-strong)";
        return (
          <span key={`tier-node-${i}`} style={{ display: "flex", alignItems: "center", flex: 1 }}>
            {i > 0 && (
              <span
                aria-hidden="true"
                style={{
                  flex: 1,
                  height: `${connectorHeight}px`,
                  borderRadius: "2px",
                  background: filled ? color : "var(--color-border)",
                }}
              />
            )}
            <span
              data-testid={`chain-pip-${i}`}
              data-filled={filled ? "true" : "false"}
              title={`${tierRarityName(i)}${filled ? "" : " · bloqueado"}`}
              style={{
                width: `${nodeSize}px`,
                height: `${nodeSize}px`,
                borderRadius: "50%",
                background: color,
                opacity: filled ? 1 : 0.45,
                boxShadow: filled ? `0 0 9px -2px ${color}` : "none",
                flexShrink: 0,
              }}
            />
          </span>
        );
      })}
    </span>
  );
}

// ── Stamp line (date + project per unlock — AC-10-006.2) ─────────────────────────

function StampLine({ unlock }: { unlock: TierUnlockEvent }): React.JSX.Element {
  return (
    <span
      data-testid="chain-unlock-item"
      data-tier={unlock.tier + 1}
      style={{
        display: "flex",
        gap: "5px",
        alignItems: "center",
        fontSize: "11px",
        color: "var(--color-text3)",
        lineHeight: 1.2,
      }}
    >
      <i className="ti ti-calendar" aria-hidden="true" style={{ fontSize: "11px" }} />
      <span className="tabular-nums">{unlock.date}</span>
      {unlock.project && unlock.project !== "—" && (
        <>
          <span aria-hidden="true" style={{ opacity: 0.5 }}>
            ·
          </span>
          <span style={{ fontStyle: "italic", opacity: 0.85 }}>{unlock.project}</span>
        </>
      )}
    </span>
  );
}

// ── Derived values ──────────────────────────────────────────────────────────────

type ChainCardVariant = "card" | "spot" | "mini";

export type ChainCardProps = {
  chain: ChainState;
  /** "card" (grid), "spot" (full-width spotlight), "mini" (compact). */
  variant?: ChainCardVariant;
};

type Derived = {
  label: string;
  tierFunName: string;
  rarityLabel: string;
  hasTier: boolean;
  currentTierIndex: number;
  totalTiers: number;
  tierNum: number;
  tColor: string;
  nextTier: ChainState["nextTier"];
  barPct: number;
  goalText: string;
  unlocks: ChainState["unlocks"];
  iconNode: React.ReactNode;
};

function derive(chain: ChainState): Derived {
  const { statKey, label, currentTierIndex, currentTierName, nextTier, pctToNext, unlocks } = chain;
  const value = chain.value ?? 0;
  const chainDef = CHAIN_DEFINITIONS.find((c) => c.statKey === statKey);
  const totalTiers = chainDef?.tiers.length ?? 0;
  const hasTier = currentTierIndex >= 0;
  const tierFunName = currentTierName ?? chainDef?.tiers[0]?.name ?? label;
  const rarityLabel = hasTier ? tierRarityName(currentTierIndex) : "Sin tier";
  const tColor = tierColor(currentTierIndex);
  const barPct = nextTier !== null ? pctToNext : 100;
  const goalText = nextTier
    ? chain.lowerIsBetter
      ? `récord ${value}d → ≤${nextTier.threshold}d`
      : `${value} / ${nextTier.threshold}`
    : "";
  const iconClass = CHAIN_ICONS[statKey] ?? "ti-star";
  const iconNode = (
    <i
      data-chain-icon={statKey}
      className={`ti ${iconClass}`}
      aria-hidden="true"
      style={{ fontSize: "1.1em", color: hasTier ? tColor : "var(--color-text3)" }}
    />
  );
  return {
    label,
    tierFunName,
    rarityLabel,
    hasTier,
    currentTierIndex,
    totalTiers,
    tierNum: currentTierIndex + 1,
    tColor,
    nextTier,
    barPct,
    goalText,
    unlocks,
    iconNode,
  };
}

// ── Shared badge ────────────────────────────────────────────────────────────────

function TierBadge({
  rarityLabel,
  tierNum,
  tColor,
  fontSize = "9px",
}: {
  rarityLabel: string;
  tierNum: number;
  tColor: string;
  fontSize?: string;
}): React.JSX.Element {
  return (
    <span
      data-testid="chain-tier-badge"
      data-tier={tierNum}
      style={{
        fontFamily: "var(--font-pixel)",
        fontSize,
        background: tColor,
        color: "var(--color-base)",
        padding: "1px 6px",
        borderRadius: "4px",
        flexShrink: 0,
        opacity: tierNum > 0 ? 1 : 0.4,
      }}
    >
      {rarityLabel}
    </span>
  );
}

// ── Chain bar (tier-colored, reuses CMP-09-xp-bar) ──────────────────────────────

function ChainBar({
  barPct,
  tColor,
  nextName,
  height,
}: {
  barPct: number;
  tColor: string;
  nextName: string;
  height: number;
}): React.JSX.Element {
  return (
    <div data-testid="chain-xp-bar-wrapper">
      <XpBar
        size="track"
        fillColor={tColor}
        trackHeight={height}
        xp={barPct}
        next={100}
        pctToNext={barPct}
        label={nextName}
        nextTitle={nextName}
      />
    </div>
  );
}

// ── Goal row "→ <next>   ·   valor / umbral" ────────────────────────────────────

function GoalRow({
  nextName,
  goalText,
}: {
  nextName: string;
  goalText: string;
}): React.JSX.Element {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: "8px",
        fontSize: "11px",
        color: "var(--color-text3)",
      }}
    >
      <span
        data-testid="chain-next-tier-name"
        style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}
      >
        <i
          className="ti ti-arrow-big-right-lines"
          aria-hidden="true"
          style={{ fontSize: "11px", verticalAlign: "-2px" }}
        />{" "}
        {nextName}
      </span>
      <span className="tabular-nums" style={{ flexShrink: 0 }}>
        {goalText}
      </span>
    </div>
  );
}

function CompletedLine(): React.JSX.Element {
  return (
    <div style={{ fontSize: "11px", color: "var(--color-ok)", display: "flex", gap: "5px" }}>
      <i className="ti ti-crown" aria-hidden="true" style={{ fontSize: "14px" }} />
      Cadena legendaria completada
    </div>
  );
}

// ── ChainCard ─────────────────────────────────────────────────────────────────

export function ChainCard({ chain, variant = "card" }: ChainCardProps): React.JSX.Element {
  const d = derive(chain);

  if (variant === "spot") return <SpotCard d={d} />;
  if (variant === "mini") return <MiniCard d={d} />;
  return <StandardCard d={d} />;
}

// ── Spot variant (rpgChainSpot) ─────────────────────────────────────────────────

function SpotCard({ d }: { d: Derived }): React.JSX.Element {
  return (
    <article
      data-testid="chain-card"
      data-variant="spot"
      aria-label={`Misión en destaque: ${d.label}`}
      style={{
        ...RPGPANEL_STYLE,
        flexDirection: "row",
        alignItems: "center",
        gap: "17px",
        flexWrap: "wrap",
        border: "1.5px solid var(--color-accent)",
        padding: "18px",
      }}
    >
      <ItemSlot icon={d.iconNode} size={58} tone="accent" aria-label={`Cadena: ${d.label}`} />

      {/* Left: chips + fun name + chain name + node ladder */}
      <div
        style={{ flex: 1, minWidth: "230px", display: "flex", flexDirection: "column", gap: "4px" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <span
            style={{
              fontFamily: "var(--font-pixel)",
              fontSize: "10px",
              color: "var(--color-accent-text)",
              background: "var(--color-accent-bg)",
              border: "1px solid var(--color-accent)",
              padding: "2px 8px",
              borderRadius: "5px",
            }}
          >
            <i
              className="ti ti-bolt"
              aria-hidden="true"
              style={{ fontSize: "11px", verticalAlign: "-1px" }}
            />{" "}
            A UN PASO DE SUBIR
          </span>
          <TierBadge
            rarityLabel={d.rarityLabel}
            tierNum={d.tierNum}
            tColor={d.tColor}
            fontSize="10px"
          />
        </div>
        <div
          style={{
            fontFamily: "var(--font-display, var(--font-space-grotesk))",
            fontSize: "21px",
            lineHeight: 1.1,
            color: "var(--color-text)",
          }}
        >
          {d.tierFunName}
        </div>
        <span data-testid="chain-label" style={{ fontSize: "12px", color: "var(--color-text2)" }}>
          {d.label}
        </span>
        {d.totalTiers > 0 && (
          <div style={{ marginTop: "9px" }}>
            <NodeLadder
              totalTiers={d.totalTiers}
              currentTierIndex={d.currentTierIndex}
              nodeSize={18}
              connectorHeight={4}
            />
          </div>
        )}
      </div>

      {/* Right: big % + goal + bar + value/threshold */}
      {d.nextTier !== null ? (
        <div
          style={{
            flexShrink: 0,
            minWidth: "185px",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
          }}
        >
          <span
            aria-hidden="true"
            style={{
              fontFamily: "var(--font-pixel)",
              fontSize: "32px",
              color: "var(--color-accent-text)",
              lineHeight: 1,
              textAlign: "right",
            }}
          >
            {d.barPct}
            <span style={{ fontSize: "14px", opacity: 0.7 }}>%</span>
          </span>
          <span
            data-testid="chain-next-tier-name"
            style={{ fontSize: "12px", color: "var(--color-text2)", textAlign: "right" }}
          >
            <i
              className="ti ti-arrow-big-right-lines"
              aria-hidden="true"
              style={{ fontSize: "12px", verticalAlign: "-2px" }}
            />{" "}
            {d.nextTier.name}
          </span>
          <ChainBar barPct={d.barPct} tColor={d.tColor} nextName={d.nextTier.name} height={14} />
          <span
            className="tabular-nums"
            style={{ fontSize: "11px", color: "var(--color-text3)", textAlign: "right" }}
          >
            {d.goalText}
          </span>
        </div>
      ) : (
        <CompletedLine />
      )}
    </article>
  );
}

// ── Standard card variant (rpgChainCard) ────────────────────────────────────────

function StandardCard({ d }: { d: Derived }): React.JSX.Element {
  return (
    <article
      data-testid="chain-card"
      data-variant="card"
      aria-label={`Cadena: ${d.label}`}
      style={RPGPANEL_STYLE}
    >
      {/* Header: medal + [fun name + badge] + chain name */}
      <div style={{ display: "flex", gap: "11px", alignItems: "center" }}>
        <ItemSlot icon={d.iconNode} size={42} aria-label={`Cadena: ${d.label}`} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "7px", flexWrap: "wrap" }}>
            <span style={{ fontWeight: 600, fontSize: "0.875rem", color: "var(--color-text)" }}>
              {d.tierFunName}
            </span>
            <TierBadge rarityLabel={d.rarityLabel} tierNum={d.tierNum} tColor={d.tColor} />
          </div>
          <div data-testid="chain-label" style={{ fontSize: "11px", color: "var(--color-text2)" }}>
            {d.label}
          </div>
        </div>
      </div>

      {/* Node ladder */}
      {d.totalTiers > 0 && (
        <div style={{ margin: "3px 3px 2px" }}>
          <NodeLadder totalTiers={d.totalTiers} currentTierIndex={d.currentTierIndex} />
        </div>
      )}

      {/* Goal + bar OR completed */}
      {d.nextTier !== null ? (
        <>
          <GoalRow nextName={d.nextTier.name} goalText={d.goalText} />
          <ChainBar barPct={d.barPct} tColor={d.tColor} nextName={d.nextTier.name} height={12} />
        </>
      ) : (
        <CompletedLine />
      )}

      {/* Stamp lines (date + project per unlock — incl. completed) */}
      {d.unlocks.map((unlock) => (
        <StampLine key={`unlock-tier-${unlock.tier}`} unlock={unlock} />
      ))}
    </article>
  );
}

// ── Mini card variant (rpgChainMini) ────────────────────────────────────────────

function MiniCard({ d }: { d: Derived }): React.JSX.Element {
  return (
    <article
      data-testid="chain-card"
      data-variant="mini"
      aria-label={`Cadena: ${d.label}`}
      style={{ ...RPGPANEL_STYLE, padding: "11px 12px", gap: "9px" }}
    >
      <div style={{ display: "flex", gap: "9px", alignItems: "center" }}>
        <ItemSlot icon={d.iconNode} size={34} aria-label={`Cadena: ${d.label}`} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: "12px",
              fontWeight: 600,
              color: "var(--color-text)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {d.tierFunName}
          </div>
          <div data-testid="chain-label" style={{ fontSize: "10px", color: "var(--color-text3)" }}>
            {d.label}
          </div>
        </div>
        <TierBadge rarityLabel={d.rarityLabel} tierNum={d.tierNum} tColor={d.tColor} />
      </div>

      {d.nextTier !== null ? (
        <>
          <ChainBar barPct={d.barPct} tColor={d.tColor} nextName={d.nextTier.name} height={9} />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "6px",
              fontSize: "10px",
              color: "var(--color-text3)",
            }}
          >
            <span
              data-testid="chain-next-tier-name"
              style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                minWidth: 0,
              }}
            >
              <i
                className="ti ti-arrow-big-right-lines"
                aria-hidden="true"
                style={{ fontSize: "10px", verticalAlign: "-1px" }}
              />{" "}
              {d.nextTier.name}
            </span>
            <span className="tabular-nums" style={{ flexShrink: 0 }}>
              {d.goalText}
            </span>
          </div>
        </>
      ) : (
        <div style={{ fontSize: "10px", color: "var(--color-ok)", display: "flex", gap: "4px" }}>
          <i className="ti ti-crown" aria-hidden="true" style={{ fontSize: "11px" }} />
          Completada
        </div>
      )}
    </article>
  );
}
