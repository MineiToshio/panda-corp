/**
 * HallTabs — 4-tab client shell for the Achievements Hall (WO-10-005)
 *
 * Manages the active sub-tab (Resumen · Misiones · Trofeos · Estadísticas).
 * Receives all pre-computed data from the Server Component page and renders
 * the appropriate tab body.
 *
 * Client Component: needs useState for the active tab.
 * All tab bodies are pure presentational — no additional I/O.
 *
 * Visual reference: prototype logrosTabs() + logrosResumen() / logrosMisiones() /
 *   logrosTrofeos() / logrosStats() functions.
 *
 * Traceability:
 *   AC-10-005.1 — sub-tab bar (Resumen · Misiones · Trofeos · Estadísticas)
 *   AC-10-006.1..5 — Misiones tab (ChainCard variants)
 *   AC-10-007.1..4 — Trofeos tab (UniquesSection)
 *   AC-10-008.1..4 — Trofeos tab (SecretsPanel)
 *   AC-10-005.2..3 — Estadísticas tab (StatsPanel with HeroStat + ledger)
 *
 * FDD: logrosResumen / logrosMisiones / logrosTrofeos / logrosStats
 * Source-of-truth hierarchy: FRD > FDD > design-tokens > blueprint > work order
 */

"use client";

import { useState } from "react";
import { SectionHead } from "@/components/core/SectionHead/SectionHead";
import { Tabs } from "@/components/core/Tabs/Tabs";
import type { ChainState, Seal, Secret, Unique } from "@/lib/achievements/achievements";
import { computeSeals } from "@/lib/achievements/achievements";
import type { Saga } from "@/lib/achievements/definitions";
import { SAGA_ICONS, SAGA_ORDER } from "@/lib/achievements/definitions";
import type { ReaderData } from "@/lib/achievements/stats";
import { rarityColor } from "@/lib/achievements/tiers";
import type { GuildLevel } from "@/lib/gamification/gamification";
import { AlmostThere } from "../AlmostThere";
import { ChainCard } from "../ChainCard/ChainCard";
import { RankLadder } from "../RankLadder/RankLadder";
import { SecretsPanel } from "../SecretsPanel/SecretsPanel";
import { StatsPanel } from "../StatsPanel";
import { UniquesSection } from "../UniquesSection/UniquesSection";

// ── Tab definitions ───────────────────────────────────────────────────────────

type TabId = "resumen" | "misiones" | "trofeos" | "estadisticas" | "rangos";

/** Tab metadata (id + label + icon). Counts are added at render time. */
const TAB_META: Array<{ id: TabId; label: string; icon: string }> = [
  { id: "resumen", label: "Resumen", icon: "ti-layout-dashboard" },
  { id: "misiones", label: "Misiones", icon: "ti-map-2" },
  { id: "trofeos", label: "Trofeos", icon: "ti-trophy" },
  { id: "estadisticas", label: "Estadísticas", icon: "ti-chart-bar" },
  { id: "rangos", label: "Rangos", icon: "ti-stairs-up" },
];

/** Type guard: narrow the shared Tabs onChange string back to a TabId. */
function isTabId(id: string): id is TabId {
  return TAB_META.some((t) => t.id === id);
}

// ── RecentTrophies (Resumen tab) ──────────────────────────────────────────────

type RecentTrophiesProps = {
  uniques: readonly Unique[];
};

/**
 * Vitrina del gremio — last 4 unlocked trophies (prototype recentTrophies()).
 * rpgpanel glowwarn + warn ItemSlot + name + stamp.
 */
function RecentTrophies({ uniques }: RecentTrophiesProps): React.JSX.Element | null {
  const recent = [...uniques]
    .filter((u) => u.unlocked && u.date !== undefined)
    .sort((a, b) => {
      // Most recent first (ISO dates sort lexicographically)
      const da = a.date ?? "";
      const db = b.date ?? "";
      return db.localeCompare(da);
    })
    .slice(0, 4);

  if (recent.length === 0) return null;

  return (
    <section
      aria-label="Últimos trofeos"
      style={{ display: "flex", flexDirection: "column", gap: "10px" }}
    >
      {/* Canonical SectionHead (LOG-03) — prototype recentTrophies():
          secthead("ti-sparkles","Vitrina del gremio","tus últimos trofeos"). */}
      <SectionHead
        icon="ti-sparkles"
        label="Vitrina del gremio"
        rightHtml={
          <span
            style={{
              fontSize: "11px",
              color: "var(--color-text3)",
              fontFamily: "var(--font-pixel)",
            }}
          >
            tus últimos trofeos
          </span>
        }
      />
      <ul
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(235px, 1fr))",
          gap: "8px",
        }}
      >
        {recent.map((u) => (
          <li
            key={u.name}
            style={{
              background: "var(--color-card)",
              border: "1px solid var(--color-border-strong)",
              // Calm warn LEFT accent instead of the big yellow glow (owner feedback) —
              // consistent with the conquered-trophy cards in UniquesSection.
              borderLeft: "3px solid var(--color-warn)",
              borderRadius: "10px",
              boxShadow:
                "inset 0 1px 0 rgba(255,255,255,.05), inset 0 -2px 0 rgba(0,0,0,.22), 0 2px 0 var(--color-base)",
              display: "flex",
              gap: "10px",
              alignItems: "center",
              padding: "10px 12px",
            }}
          >
            <span
              role="img"
              aria-label={`Trofeo: ${u.name}`}
              style={{
                width: 40,
                height: 40,
                borderRadius: "9px",
                border: "2px solid var(--color-warn)",
                background: "var(--color-warn-bg)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <i
                className="ti ti-trophy"
                aria-hidden="true"
                style={{ fontSize: "1.2em", color: "var(--color-warn)" }}
              />
            </span>
            <div
              style={{ flex: 1, display: "flex", flexDirection: "column", gap: "3px", minWidth: 0 }}
            >
              <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--color-text)" }}>
                {u.name}
              </span>
              {u.date !== undefined && (
                <span
                  style={{
                    fontSize: "10px",
                    color: "var(--color-text3)",
                    display: "flex",
                    gap: "4px",
                    alignItems: "center",
                  }}
                >
                  <i className="ti ti-calendar" aria-hidden="true" />
                  <span className="tabular-nums">{u.date}</span>
                  {u.project !== undefined && (
                    <>
                      <span aria-hidden="true" style={{ opacity: 0.5 }}>
                        ·
                      </span>
                      <span style={{ fontStyle: "italic" }}>{u.project}</span>
                    </>
                  )}
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ── MisionesTab ────────────────────────────────────────────────────────────────

type MisionesTabProps = {
  chains: readonly ChainState[];
};

/** One saga's section: a header + a grid of its chain cards (FRD-10 v2 §6). */
function SagaSection({
  saga,
  chains,
}: {
  saga: Saga;
  chains: readonly ChainState[];
}): React.JSX.Element | null {
  if (chains.length === 0) return null;
  const legendary = chains.filter((c) => c.nextTier === null).length;
  return (
    <section aria-label={`Saga: ${saga}`}>
      <SectionHead
        icon={SAGA_ICONS[saga]}
        label={saga}
        rightHtml={
          <span
            style={{
              fontSize: "11px",
              color: "var(--color-text3)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {chains.length} misiones
            {legendary > 0 ? ` · ${legendary} legendaria${legendary > 1 ? "s" : ""}` : ""}
          </span>
        }
      />
      <ul
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))",
          gap: "10px",
        }}
      >
        {chains.map((c) => (
          <li key={c.statKey}>
            <ChainCard chain={c} variant="card" />
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Misiones tab body (FRD-10 v2 §6): a spotlight on the closest-to-levelling chain, then
 * the cumulative missions grouped into narrative **sagas** (La Construcción · Las Ideas ·
 * El Oficio · El Gremio · El Tiempo) — so the surface reads as an organised, abundant
 * questboard rather than one flat "Comunes" bucket.
 */
function MisionesTab({ chains }: MisionesTabProps): React.JSX.Element {
  // Spotlight: highest pctToNext among active (non-maxed) chains.
  const activeChains = [...chains.filter((c) => c.nextTier !== null)].sort(
    (a, b) => b.pctToNext - a.pctToNext,
  );
  const spotlightChain = activeChains[0];
  const spotlightKey = spotlightChain?.statKey;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <p style={{ fontSize: "0.8rem", color: "var(--color-text3)", margin: 0 }}>
        Misiones acumulativas, agrupadas por saga — cada tier alcanzado deja huella verificable en
        el tiempo.
      </p>

      {/* Spotlight chain (spot variant) — the "A UN PASO DE SUBIR" chip lives inside the card. */}
      {spotlightChain !== undefined && (
        <section aria-label="Misión en destaque">
          <ChainCard chain={spotlightChain} variant="spot" />
        </section>
      )}

      {/* Saga sections — the spotlight chain is not repeated inside its saga grid. */}
      {SAGA_ORDER.map((saga) => (
        <SagaSection
          key={saga}
          saga={saga}
          chains={chains.filter((c) => c.saga === saga && c.statKey !== spotlightKey)}
        />
      ))}
    </div>
  );
}

// ── SealsShelf — meta-trophies (one per axis + Grand Seal), FRD-10 v2 ───────────

function SealItem({ seal }: { seal: Seal }): React.JSX.Element {
  const isGrand = seal.axis === "grand";
  const accent = isGrand ? "var(--color-warn)" : rarityColor("Leyenda");
  return (
    <li
      data-testid="seal-item"
      data-unlocked={seal.unlocked}
      aria-label={`Sello ${seal.name}: ${seal.unlocked ? "conseguido" : "bloqueado"} (${seal.earned}/${seal.total})`}
      style={{
        display: "flex",
        gap: "8px",
        alignItems: "center",
        padding: "8px 10px",
        borderRadius: "9px",
        background: "var(--color-card)",
        border: `1px solid ${seal.unlocked ? accent : "var(--color-border-strong)"}`,
        boxShadow: seal.unlocked ? `0 0 14px -6px ${accent}` : "none",
        opacity: seal.unlocked ? 1 : 0.62,
      }}
    >
      <i
        className={`ti ${seal.unlocked ? "ti-seeding" : "ti-lock"}`}
        aria-hidden="true"
        style={{ fontSize: "16px", color: seal.unlocked ? accent : "var(--color-text3)" }}
      />
      <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--color-text)" }}>
          {seal.name}
        </span>
        <span className="tabular-nums" style={{ fontSize: "10px", color: "var(--color-text3)" }}>
          {seal.unlocked ? "Conseguido" : `${seal.earned}/${seal.total}`}
        </span>
      </span>
    </li>
  );
}

function SealsShelf({ seals }: { seals: readonly Seal[] }): React.JSX.Element | null {
  if (seals.length === 0) return null;
  return (
    <section data-testid="seals-shelf" aria-label="Sellos del gremio">
      <SectionHead
        icon="ti-seeding"
        label="Sellos"
        count={seals.filter((s) => s.unlocked).length}
      />
      <ul
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))",
          gap: "8px",
        }}
      >
        {seals.map((seal) => (
          <SealItem key={seal.axis} seal={seal} />
        ))}
      </ul>
    </section>
  );
}

// ── TrofeosTab ─────────────────────────────────────────────────────────────────

type TrofeosTabProps = {
  uniques: readonly Unique[];
  secrets: readonly Secret[];
  trophiesCount: number;
  trophiesTotal: number;
};

/**
 * Trofeos tab body — prototype logrosTrofeos():
 *   - Trophy count strip (rpgpanel + counts)
 *   - UniquesSection (category chips + grids)
 *   - SecretsPanel
 */
function TrofeosTab({
  uniques,
  secrets,
  trophiesCount,
  trophiesTotal,
}: TrofeosTabProps): React.JSX.Element {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Trophy count strip */}
      <div
        style={{
          background: "var(--color-card)",
          border: "1px solid var(--color-border-strong)",
          borderRadius: "10px",
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,.05), inset 0 -2px 0 rgba(0,0,0,.22), 0 2px 0 var(--color-base)",
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          gap: "12px",
        }}
      >
        <i
          className="ti ti-trophy"
          aria-hidden="true"
          style={{ fontSize: "18px", color: "var(--color-warn)" }}
        />
        <span style={{ fontSize: "0.875rem", color: "var(--color-text)", fontWeight: 600 }}>
          <span className="tabular-nums">{trophiesCount}</span>
          {" / "}
          <span className="tabular-nums">{trophiesTotal}</span>
          {" trofeos conquistados"}
        </span>
      </div>

      {/* Seals — meta-trophies (one per axis + Grand Seal) */}
      <SealsShelf seals={computeSeals(uniques)} />

      {/* Unique achievements (category-filtered grid + lockchip reveal) */}
      <UniquesSection uniques={uniques} />

      {/* Secrets */}
      {secrets.length > 0 && <SecretsPanel secrets={secrets} />}
    </div>
  );
}

// ── ResumenTab ─────────────────────────────────────────────────────────────────

type ResumenTabProps = {
  chains: readonly ChainState[];
  uniques: readonly Unique[];
  /** The GuildHero character-sheet — lives ONLY in Resumen (prototype logrosResumen). */
  hero: React.ReactNode;
};

/**
 * Resumen tab body — prototype logrosResumen() = hero + questsNear + recentTrophies:
 *   - GuildHero (character-sheet — scoped to this tab, not a persistent header)
 *   - AlmostThere (questsNear — top-3 chains by pct)
 *   - RecentTrophies (vitrina — last 4 unlocked trophies)
 */
function ResumenTab({ chains, uniques, hero }: ResumenTabProps): React.JSX.Element {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
      {hero}
      <AlmostThere chains={chains} />
      <RecentTrophies uniques={uniques} />
    </div>
  );
}

// ── HallTabs (main export) ────────────────────────────────────────────────────

export type HallTabsProps = {
  chains: readonly ChainState[];
  uniques: readonly Unique[];
  secrets: readonly Secret[];
  readerData: ReaderData;
  trophiesCount: number;
  trophiesTotal: number;
  /** Active missions count (chains in progress) — shown on the Misiones tab. */
  missionsActive: number;
  /** The GuildHero element — rendered inside the Resumen tab only. */
  hero: React.ReactNode;
  /** Guild level — drives the Rangos ladder (current rank + progress). */
  level: GuildLevel;
};

/**
 * HallTabs — Client Component managing the 5-tab active state.
 *
 * Receives all pre-computed data from the Server Component (page.tsx) and
 * delegates rendering to the appropriate tab body. Uses the shared Tabs/SubTabs
 * primitive for keyboard accessibility.
 *
 * DR-062 cohesion: one tab bar per surface (no nested tab controls).
 */
export function HallTabs({
  chains,
  uniques,
  secrets,
  readerData,
  trophiesCount,
  trophiesTotal,
  missionsActive,
  hero,
  level,
}: HallTabsProps): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<TabId>("resumen");

  const handleTabChange = (id: string): void => {
    if (isTabId(id)) setActiveTab(id);
  };

  // Tabs with icon + count (counts only shown when > 0, prototype logrosTabs).
  const tabCounts: Record<TabId, number> = {
    resumen: 0,
    misiones: missionsActive,
    trofeos: trophiesCount,
    estadisticas: 0,
    rangos: 0,
  };
  const tabs = TAB_META.map((t) => ({
    id: t.id,
    label: t.label,
    icon: t.icon,
    ...(tabCounts[t.id] > 0 ? { count: tabCounts[t.id] } : {}),
  }));

  return (
    <div
      style={{
        marginTop: "calc(var(--space-base) * 1.5)",
        display: "flex",
        flexDirection: "column",
        gap: "20px",
      }}
    >
      {/* Sub-tab bar — the ONE shared Tabs/SubTabs primitive (DR-062, logrosTabs
          alias), not a hand-rolled role=tablist. testIdPrefix keeps the stable
          screen-specific ids (logros-tab-<id>) used by existing tests. */}
      <div data-testid="logros-tabs">
        <Tabs
          level="sub"
          ariaLabel="Secciones de logros"
          testIdPrefix="logros-tab-"
          active={activeTab}
          onChange={handleTabChange}
          tabs={tabs}
        />
      </div>

      {/* Tab panels — all rendered in DOM, visibility toggled via style.
          This keeps server-rendered content accessible in tests and for SEO/a11y
          while giving instant tab switching with no hydration gaps. */}
      <div style={{ minHeight: "200px" }}>
        <div
          id="logros-panel-resumen"
          role="tabpanel"
          aria-labelledby="logros-tab-btn-resumen"
          hidden={activeTab !== "resumen"}
        >
          <ResumenTab chains={chains} uniques={uniques} hero={hero} />
        </div>
        <div
          id="logros-panel-misiones"
          role="tabpanel"
          aria-labelledby="logros-tab-btn-misiones"
          hidden={activeTab !== "misiones"}
        >
          <MisionesTab chains={chains} />
        </div>
        <div
          id="logros-panel-trofeos"
          role="tabpanel"
          aria-labelledby="logros-tab-btn-trofeos"
          hidden={activeTab !== "trofeos"}
        >
          <TrofeosTab
            uniques={uniques}
            secrets={secrets}
            trophiesCount={trophiesCount}
            trophiesTotal={trophiesTotal}
          />
        </div>
        <div
          id="logros-panel-estadisticas"
          role="tabpanel"
          aria-labelledby="logros-tab-btn-estadisticas"
          hidden={activeTab !== "estadisticas"}
        >
          <StatsPanel readerData={readerData} />
        </div>
        <div
          id="logros-panel-rangos"
          role="tabpanel"
          aria-labelledby="logros-tab-btn-rangos"
          hidden={activeTab !== "rangos"}
        >
          <RankLadder level={level} />
        </div>
      </div>
    </div>
  );
}
