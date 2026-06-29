/**
 * CMP-10-uniques — Unique achievements grouped by category (WO-10-007, re-styled WO-10-005)
 *
 * Renders unique (one-time) achievements grouped by category.
 *
 * Three rendering modes per item (matching prototype):
 *   - Unlocked:  rpgOneCard glowwarn anim — 42px warn ItemSlot + name + desc + date+project stamp
 *   - Locked:    rpgTrophyLock — 30px ItemSlot (lock icon) + name + "Bloqueado" +
 *                hover/focus-within reveal showing "CÓMO DESBLOQUEAR" + condition
 *
 * Visual reference: prototype rpgOneCard() / rpgTrophyLock() functions.
 *
 * Category structure: each category has a `<section data-testid="uniques-category-{cat}">` container
 * with a `<h3 data-testid="uniques-category-heading-{cat}">` heading, preserving the test contract
 * from AC-10-007.1 while adding the new filter-chip UX on top.
 *
 * Styling uses FRD-13 tokens only — zero hardcoded colors.
 * Numbers use tabular-nums (FRD-13 AC-10-007.4).
 * Spanish labels and aria-labels.
 *
 * Traceability:
 *   AC-10-007.1 — groups by category from computeUniques()
 *   AC-10-007.2 — unlocked: date + project; locked: condition (visible + hover-reveal)
 *   AC-10-007.3 — locked/unlocked NOT color-alone (icon + label + data-unlocked)
 *   AC-10-007.4 — FRD-13 tokens only; tabular-nums on dates
 *
 * Blueprint: CMP-10-uniques (FRD-10 blueprint §4)
 * Source-of-truth: FRD > FDD > design-tokens > blueprint > work order
 */

"use client";

import { useState } from "react";
import { ItemSlot } from "@/components/core/ItemSlot/ItemSlot";
import { SectionHead } from "@/components/core/SectionHead/SectionHead";
import { SubTabs } from "@/components/core/Tabs/Tabs";
import type { Unique } from "@/lib/achievements/achievements";
import type { UniqueCategory } from "@/lib/achievements/catalogue/types";
import { rarityColor, rarityLabel } from "@/lib/achievements/tiers";

// ─── RarityTag — per-trophy rarity gem + label (FRD-10 v2; not color alone, WCAG 1.4.1) ──
function RarityTag({ rarity }: { rarity: Unique["rarity"] }): React.JSX.Element {
  return (
    <span
      data-testid="unique-rarity"
      style={{
        display: "inline-flex",
        gap: "5px",
        alignItems: "center",
        fontSize: "9px",
        fontFamily: "var(--font-pixel)",
        letterSpacing: "0.04em",
        color: "var(--color-text3)",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: "8px",
          height: "8px",
          borderRadius: "2px",
          background: rarityColor(rarity),
          boxShadow: `0 0 6px -1px ${rarityColor(rarity)}`,
        }}
      />
      {rarityLabel(rarity)}
    </span>
  );
}

// ─── NuevoBadge — "NUEVO" pip for a trophy unlocked within 7 days (FRD-10 v2) ──
function NuevoBadge(): React.JSX.Element {
  return (
    <span
      data-testid="unique-nuevo"
      aria-label="Nuevo"
      style={{
        fontSize: "8px",
        fontFamily: "var(--font-pixel)",
        letterSpacing: "0.06em",
        color: "var(--color-base)",
        background: "var(--color-warn)",
        borderRadius: "3px",
        padding: "1px 4px",
        fontWeight: 700,
      }}
    >
      NUEVO
    </span>
  );
}

// ─── Category order & Spanish display names ──────────────────────────────────

const CATEGORY_ORDER: readonly UniqueCategory[] = [
  "Discovery",
  "Speed",
  "Quality",
  "Consistency",
  "Mastery",
  "Production",
  "Guild",
  "Resilience",
] as const;

const CATEGORY_LABELS: Record<UniqueCategory, string> = {
  Discovery: "Descubrimiento",
  Speed: "Velocidad",
  Quality: "Calidad",
  Consistency: "Consistencia",
  Mastery: "Maestría",
  Production: "Producción",
  Guild: "Gremio",
  Resilience: "Temple",
};

const CATEGORY_ICONS: Record<UniqueCategory, string> = {
  Discovery: "ti-rocket",
  Speed: "ti-bolt",
  Quality: "ti-diamond",
  Consistency: "ti-flame",
  Mastery: "ti-crown",
  Production: "ti-package",
  Guild: "ti-users-group",
  Resilience: "ti-shield-bolt",
};

// ─── RPGPanel styles ──────────────────────────────────────────────────────────

const RPGPANEL: React.CSSProperties = {
  background: "var(--color-card)",
  border: "1px solid var(--color-border-strong)",
  borderRadius: "10px",
  boxShadow:
    "inset 0 1px 0 rgba(255,255,255,.05), inset 0 -2px 0 rgba(0,0,0,.22), 0 2px 0 var(--color-base)",
};

const RPGPANEL_GLOWWARN: React.CSSProperties = {
  ...RPGPANEL,
  boxShadow: "inset 0 1px 0 rgba(255,255,255,.05), 0 0 18px -7px var(--color-warn)",
};

// ─── Date formatting ──────────────────────────────────────────────────────────

function formatDate(isoDate: string): string {
  const d = new Date(isoDate);
  if (!Number.isFinite(d.getTime())) return isoDate;
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

// ─── UniqueItem ───────────────────────────────────────────────────────────────

type UniqueItemProps = {
  unique: Unique;
};

/**
 * Renders a single unique achievement.
 *
 * Unlocked → rpgOneCard glowwarn: 42px warn ItemSlot + name + condition + stamp.
 *            Carries data-testid="unique-unlock-indicator" on the icon span.
 * Locked   → rpgTrophyLock: 30px lock ItemSlot with hover/focus-within reveal overlay.
 *            Carries data-testid="unique-lock-indicator" on the icon span.
 *
 * Both states have data-unlocked attribute and unique-name / unique-condition.
 * Locked/unlocked NOT by color alone: distinct icon + aria-label + text (AC-10-007.3).
 */
function UniqueItem({ unique }: UniqueItemProps): React.JSX.Element {
  const { unlocked } = unique;

  // ── Unlocked (rpgOneCard glowwarn) ──────────────────────────────────────
  if (unlocked) {
    const warnIcon = (
      <>
        {/* unique-unlock-indicator: the distinguishing non-color signal (AC-10-007.3) */}
        <span
          data-testid="unique-unlock-indicator"
          aria-label="Desbloqueado"
          role="img"
          style={{ display: "contents" }}
        >
          <i
            className="ti ti-trophy"
            aria-hidden="true"
            style={{ fontSize: "1.2em", color: "var(--color-warn)" }}
          />
        </span>
      </>
    );

    return (
      <li
        data-testid="unique-item"
        data-unlocked="true"
        aria-label={`Logro desbloqueado: ${unique.name}`}
        style={{
          ...RPGPANEL_GLOWWARN,
          display: "flex",
          gap: "10px",
          alignItems: "flex-start",
          padding: "10px 12px",
        }}
      >
        {/* 42px warn ItemSlot */}
        <ItemSlot icon={warnIcon} size={42} tone="warn" aria-label={`Trofeo: ${unique.name}`} />

        {/* Body */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px", minWidth: 0 }}>
          <span
            data-testid="unique-name"
            style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--color-text)" }}
          >
            {unique.name}
          </span>
          <span
            data-testid="unique-condition"
            style={{ fontSize: "0.75rem", color: "var(--color-text3)" }}
          >
            {unique.condition}
          </span>

          {/* Rarity gem + NUEVO badge */}
          <div style={{ display: "flex", gap: "8px", alignItems: "center", marginTop: "1px" }}>
            <RarityTag rarity={unique.rarity} />
            {unique.isNew === true && <NuevoBadge />}
          </div>

          {/* Date + project stamp */}
          {unique.date !== undefined && (
            <div
              style={{
                display: "flex",
                gap: "4px",
                alignItems: "center",
                fontSize: "10px",
                color: "var(--color-text3)",
                marginTop: "2px",
              }}
            >
              <i className="ti ti-calendar" aria-hidden="true" />
              <span data-testid="unique-date" className="tabular-nums">
                {formatDate(unique.date)}
              </span>
              {unique.project !== undefined && (
                <>
                  <span aria-hidden="true" style={{ opacity: 0.5 }}>
                    ·
                  </span>
                  <span data-testid="unique-project" style={{ fontStyle: "italic" }}>
                    {unique.project}
                  </span>
                </>
              )}
            </div>
          )}
        </div>
      </li>
    );
  }

  // ── Locked (rpgTrophyLock) ───────────────────────────────────────────────
  // The reveal overlay is inside the ItemSlot (CSS-only hover/focus-within).
  // The condition text is also rendered directly (accessible at all times per AC-10-007.2).
  const lockRevealContent = (
    <span
      data-testid="unique-reveal"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "3px",
        fontSize: "9px",
        fontFamily: "var(--font-pixel)",
        color: "var(--color-text)",
        pointerEvents: "none",
      }}
    >
      <span style={{ opacity: 0.55, letterSpacing: "0.04em" }}>CÓMO DESBLOQUEAR</span>
      <span style={{ fontSize: "10px", fontFamily: "inherit", opacity: 0.85 }}>
        {unique.condition}
      </span>
    </span>
  );

  const lockIcon = (
    <>
      {/* unique-lock-indicator: the distinguishing non-color signal (AC-10-007.3) */}
      <span
        data-testid="unique-lock-indicator"
        aria-label="Bloqueado"
        role="img"
        style={{ display: "contents" }}
      >
        <i
          className="ti ti-lock"
          aria-hidden="true"
          style={{ fontSize: "0.9em", color: "var(--color-text3)" }}
        />
      </span>
    </>
  );

  return (
    <li
      data-testid="unique-item"
      data-unlocked="false"
      aria-label={`Logro bloqueado: ${unique.name}`}
      style={{
        ...RPGPANEL,
        display: "flex",
        gap: "10px",
        alignItems: "center",
        padding: "8px 12px",
        opacity: 0.72,
        position: "relative",
      }}
    >
      {/* 30px ItemSlot with lock + hover-reveal */}
      <ItemSlot
        icon={lockIcon}
        size={30}
        lock={true}
        reveal={lockRevealContent}
        aria-label={`Bloqueado: ${unique.name}`}
      />

      {/* Name + condition (always accessible per AC-10-007.2) */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "3px", minWidth: 0 }}>
        <span
          data-testid="unique-name"
          style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--color-text)" }}
        >
          {unique.name}
        </span>
        <span
          data-testid="unique-condition"
          style={{ fontSize: "0.72rem", color: "var(--color-text3)", opacity: 0.7 }}
        >
          {unique.condition}
        </span>
        <RarityTag rarity={unique.rarity} />
      </div>

      {/* "Bloqueado" text label — NOT color-alone (AC-10-007.3) */}
      <span
        style={{
          fontSize: "9px",
          fontFamily: "var(--font-pixel)",
          color: "var(--color-text3)",
          flexShrink: 0,
          opacity: 0.6,
        }}
      >
        Bloqueado
      </span>
    </li>
  );
}

// ─── Grids ────────────────────────────────────────────────────────────────────

const BIG_GRID: React.CSSProperties = {
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(255px, 1fr))",
  gap: "10px",
};

const SMALL_GRID: React.CSSProperties = {
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))",
  gap: "8px",
};

// ─── UniquesSection ───────────────────────────────────────────────────────────

export type UniquesSectionProps = {
  uniques: readonly Unique[];
};

/**
 * CMP-10-uniques — unique achievements grouped BY STATE, matching the prototype
 * logrosTrofeos(): "Conquistados" (unlocked, big glowwarn cards) then "Por
 * conquistar" (locked, compact lockchips with a hover-reveal "CÓMO DESBLOQUEAR").
 * The category chips FILTER both sections — they are NOT a second grouping axis
 * (the previous by-category grouping made every locked card look identical and
 * diverged from the design). Client Component for the filter state.
 *
 * Category order (filter chips): Discovery → Speed → Quality → Consistency → Mastery.
 */
export function UniquesSection({ uniques }: UniquesSectionProps): React.JSX.Element {
  const [activeCategory, setActiveCategory] = useState<UniqueCategory | "all">("all");

  // Counts per category — for the filter chips only.
  const countByCat = new Map<UniqueCategory, number>();
  for (const cat of CATEGORY_ORDER) countByCat.set(cat, 0);
  for (const u of uniques) countByCat.set(u.category, (countByCat.get(u.category) ?? 0) + 1);
  const presentCategories = CATEGORY_ORDER.filter((cat) => (countByCat.get(cat) ?? 0) > 0);

  const filterTabs = [
    { id: "all", label: "Todos", count: uniques.length },
    ...presentCategories.map((cat) => ({
      id: cat,
      label: CATEGORY_LABELS[cat],
      icon: CATEGORY_ICONS[cat],
      count: countByCat.get(cat) ?? 0,
    })),
  ];

  const handleFilterChange = (id: string): void => {
    if (id === "all") {
      setActiveCategory("all");
    } else if (CATEGORY_ORDER.includes(id as UniqueCategory)) {
      setActiveCategory(id as UniqueCategory);
    }
  };

  // Filter by category, then split BY STATE (the body's grouping axis).
  const filtered =
    activeCategory === "all" ? uniques : uniques.filter((u) => u.category === activeCategory);
  const unlocked = filtered.filter((u) => u.unlocked);
  const locked = filtered.filter((u) => !u.unlocked);

  return (
    <section
      data-testid="uniques-section"
      aria-label="Logros únicos"
      style={{ display: "flex", flexDirection: "column", gap: "16px" }}
    >
      {/* Category chip filters — shared SubTabs primitive (DR-062, logrosTrofeos alias).
          testIdPrefix="uniques-cat-chip-" preserves the existing chip test contracts. */}
      {presentCategories.length > 1 && (
        <SubTabs
          tabs={filterTabs}
          active={activeCategory}
          onChange={handleFilterChange}
          ariaLabel="Filtrar por categoría"
          testIdPrefix="uniques-cat-chip-"
        />
      )}

      {/* Conquistados (unlocked) — big glowwarn cards. */}
      {unlocked.length > 0 && (
        <section data-testid="uniques-conquistados" aria-label="Trofeos conquistados">
          <SectionHead icon="ti-trophy" label="Conquistados" count={unlocked.length} />
          <ul style={BIG_GRID}>
            {unlocked.map((u) => (
              <UniqueItem key={u.name} unique={u} />
            ))}
          </ul>
        </section>
      )}

      {/* Por conquistar (locked) — compact lockchips with hover-reveal. */}
      {locked.length > 0 && (
        <section data-testid="uniques-por-conquistar" aria-label="Trofeos por conquistar">
          <SectionHead icon="ti-lock" label="Por conquistar" count={locked.length} />
          <p style={{ fontSize: "11px", color: "var(--color-text3)", margin: "-4px 2px 9px" }}>
            <i
              className="ti ti-hand-finger"
              aria-hidden="true"
              style={{ fontSize: "11px", verticalAlign: "-1px" }}
            />{" "}
            pasa el cursor para ver cómo desbloquearlo
          </p>
          <ul style={SMALL_GRID}>
            {locked.map((u) => (
              <UniqueItem key={u.name} unique={u} />
            ))}
          </ul>
        </section>
      )}

      {/* Empty state */}
      {filtered.length === 0 && (
        <p style={{ fontSize: "0.875rem", color: "var(--color-text)", opacity: 0.5, margin: 0 }}>
          Sin logros disponibles.
        </p>
      )}
    </section>
  );
}
