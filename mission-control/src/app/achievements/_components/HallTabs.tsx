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
import { Tabs } from "@/components/core/Tabs/Tabs";
import type { ChainState, Secret, Unique } from "@/lib/achievements/achievements";
import type { ReaderData } from "@/lib/achievements/stats";
import { AlmostThere } from "../AlmostThere";
import { ChainCard } from "../ChainCard/ChainCard";
import { SecretsPanel } from "../SecretsPanel/SecretsPanel";
import { StatsPanel } from "../StatsPanel";
import { UniquesSection } from "../UniquesSection/UniquesSection";

// ── Tab definitions ───────────────────────────────────────────────────────────

type TabId = "resumen" | "misiones" | "trofeos" | "estadisticas";

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "resumen", label: "Resumen" },
  { id: "misiones", label: "Misiones" },
  { id: "trofeos", label: "Trofeos" },
  { id: "estadisticas", label: "Estadísticas" },
];

/** Type guard: narrow the shared Tabs onChange string back to a TabId. */
function isTabId(id: string): id is TabId {
  return TABS.some((t) => t.id === id);
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
          Vitrina del gremio
        </span>
        <span style={{ fontSize: "0.75rem", color: "var(--color-text3)" }}>
          tus últimos trofeos
        </span>
      </div>
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
              borderRadius: "10px",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,.05), 0 0 18px -7px var(--color-warn)",
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

/**
 * Misiones tab body — prototype logrosMisiones():
 *   - Spotlight (spot variant) for the highest-% active chain
 *   - "En ascenso" bigGrid for chains with currentTierIndex ≥ 0
 *   - "Comunes" miniGrid for chains with no tier yet
 *   - "Legendarias" bigGrid for tier ≥ 3 chains
 */
function MisionesTab({ chains }: MisionesTabProps): React.JSX.Element {
  // Spotlight: highest pctToNext among active (non-maxed) chains
  const activeChains = chains.filter((c) => c.nextTier !== null);
  const spotlightChain = [...activeChains].sort((a, b) => b.pctToNext - a.pctToNext)[0];

  // Tiers unlocked (ascending): "En ascenso" — chains with at least one tier
  const risingChains = chains.filter((c) => c.currentTierIndex >= 0 && c.nextTier !== null);
  // No tier yet: "Comunes" — chains with no tier unlocked
  const commonChains = chains.filter((c) => c.currentTierIndex < 0);
  // High tier (Oro+): "Legendarias"
  const legendChains = chains.filter((c) => c.currentTierIndex >= 2);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Info blurb */}
      <p style={{ fontSize: "0.8rem", color: "var(--color-text3)", margin: 0 }}>
        Misiones acumulativas — cada tier alcanzado deja huella verificable en el tiempo.
      </p>

      {/* Spotlight chain (spot variant) */}
      {spotlightChain !== undefined && (
        <section aria-label="Misión en destaque">
          <div style={{ marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
            <span
              style={{
                fontSize: "10px",
                fontFamily: "var(--font-pixel)",
                color: "var(--color-text3)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              A UN PASO DE SUBIR
            </span>
          </div>
          <ChainCard chain={spotlightChain} variant="spot" />
        </section>
      )}

      {/* "En ascenso" — rising chains grid (bigGrid minmax 430px) */}
      {risingChains.length > 0 && (
        <section aria-label="Misiones en ascenso">
          <span
            style={{
              display: "block",
              fontSize: "10px",
              fontFamily: "var(--font-pixel)",
              color: "var(--color-text3)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: "10px",
            }}
          >
            En ascenso ({risingChains.length})
          </span>
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(430px, 1fr))",
              gap: "10px",
            }}
          >
            {risingChains.map((c) => (
              <li key={c.statKey}>
                <ChainCard chain={c} variant="card" />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* "Comunes" — mini grid (minmax 232px) */}
      {commonChains.length > 0 && (
        <section aria-label="Misiones comunes">
          <span
            style={{
              display: "block",
              fontSize: "10px",
              fontFamily: "var(--font-pixel)",
              color: "var(--color-text3)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: "10px",
            }}
          >
            Comunes ({commonChains.length})
          </span>
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(232px, 1fr))",
              gap: "8px",
            }}
          >
            {commonChains.map((c) => (
              <li key={c.statKey}>
                <ChainCard chain={c} variant="mini" />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* "Legendarias" — bigGrid */}
      {legendChains.length > 0 && (
        <section aria-label="Misiones legendarias">
          <span
            style={{
              display: "block",
              fontSize: "10px",
              fontFamily: "var(--font-pixel)",
              color: "var(--color-text3)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: "10px",
            }}
          >
            Legendarias ({legendChains.length})
          </span>
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(430px, 1fr))",
              gap: "10px",
            }}
          >
            {legendChains.map((c) => (
              <li key={c.statKey}>
                <ChainCard chain={c} variant="card" />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
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
};

/**
 * Resumen tab body — prototype logrosResumen():
 *   - AlmostThere (questsNear — top-3 chains by pct)
 *   - RecentTrophies (vitrina — last 4 unlocked trophies)
 */
function ResumenTab({ chains, uniques }: ResumenTabProps): React.JSX.Element {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
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
};

/**
 * HallTabs — Client Component managing the 4-tab active state.
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
}: HallTabsProps): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<TabId>("resumen");

  const handleTabChange = (id: string): void => {
    if (isTabId(id)) setActiveTab(id);
  };

  return (
    <div
      style={{
        marginTop: "calc(var(--space-base) * 1.5)",
        display: "flex",
        flexDirection: "column",
        gap: "20px",
        maxWidth: "80rem",
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
          tabs={TABS}
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
          <ResumenTab chains={chains} uniques={uniques} />
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
      </div>
    </div>
  );
}
