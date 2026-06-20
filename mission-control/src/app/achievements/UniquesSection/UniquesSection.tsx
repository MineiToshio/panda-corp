/**
 * CMP-10-uniques — Unique achievements grouped by category (WO-10-007)
 *
 * Renders unique (one-time) achievements grouped by category
 * (Discovery, Speed, Quality, Consistency, Mastery).
 *
 * When unlocked: shows date + project.
 * When locked: shows the condition (achievable, not obscure).
 *
 * Visual difference between locked/unlocked does NOT rely on color alone:
 * each state has a distinct icon/label (FRD-13 AC-10-007.3).
 *
 * Styling uses FRD-13 tokens only — zero hardcoded colors.
 * Numbers use tabular-nums (FRD-13 AC-10-007.4).
 * Spanish labels and aria-labels.
 *
 * Traceability:
 *   AC-10-007.1 — groups by category from computeUniques()
 *   AC-10-007.2 — unlocked: date + project; locked: condition
 *   AC-10-007.3 — locked/unlocked NOT color-alone (icon + label)
 *   AC-10-007.4 — FRD-13 tokens only; tabular-nums on dates
 *
 * Blueprint: CMP-10-uniques (FRD-10 blueprint §4)
 * Source-of-truth: FRD > FDD > design-tokens > blueprint > work order
 */

import type { Unique } from "@/lib/achievements/achievements";
import type { UniqueCategory } from "@/lib/achievements/predicates";

// ─── Category order & Spanish display names ──────────────────────────────────

/** Canonical display order for categories (docs/achievements.md §3). */
const CATEGORY_ORDER: readonly UniqueCategory[] = [
  "Discovery",
  "Speed",
  "Quality",
  "Consistency",
  "Mastery",
] as const;

/** Spanish display names for each category. */
const CATEGORY_LABELS: Record<UniqueCategory, string> = {
  Discovery: "Descubrimiento",
  Speed: "Velocidad",
  Quality: "Calidad",
  Consistency: "Consistencia",
  Mastery: "Maestría",
};

// ─── Date formatting ──────────────────────────────────────────────────────────

/**
 * Format an ISO date string to a readable Spanish-style date (e.g. "01/05/2026").
 * Falls back to the raw string if parsing fails.
 * Uses a fixed locale format so tabular-nums is meaningful.
 */
function formatDate(isoDate: string): string {
  const d = new Date(isoDate);
  if (!Number.isFinite(d.getTime())) return isoDate;
  // DD/MM/YYYY — readable + fixed-width (works well with tabular-nums)
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
 * Locked:   lock icon (🔒) with aria-label "Bloqueado" + condition text.
 * Unlocked: check icon (✓) with aria-label "Desbloqueado" + date + project.
 *
 * Visual difference NOT by color alone: distinct icon + label text (AC-10-007.3).
 */
function UniqueItem({ unique }: UniqueItemProps): React.JSX.Element {
  const { unlocked } = unique;

  return (
    <li
      data-testid="unique-item"
      data-unlocked={String(unlocked)}
      aria-label={`${unlocked ? "Desbloqueado" : "Bloqueado"}: ${unique.name}`}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "calc(var(--space-base) * 0.25)",
        padding: "calc(var(--space-base) * 0.625) calc(var(--space-base) * 0.75)",
        borderRadius: "var(--radius)",
        background: unlocked ? "var(--color-base)" : "var(--color-surface)",
        boxShadow: unlocked ? "var(--shadow-1)" : "none",
        border: "var(--hairline) solid var(--color-base)",
        opacity: unlocked ? 1 : 0.65,
      }}
    >
      {/* Header row: icon + name */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "calc(var(--space-base) * 0.5)",
        }}
      >
        {/* State indicator — NOT color-alone (AC-10-007.3) */}
        {unlocked ? (
          <span
            data-testid="unique-unlock-indicator"
            role="img"
            aria-label="Desbloqueado"
            style={{
              fontSize: "0.875rem",
              color: "var(--color-accent)",
              flexShrink: 0,
              lineHeight: 1,
            }}
          >
            ✓
          </span>
        ) : (
          <span
            data-testid="unique-lock-indicator"
            role="img"
            aria-label="Bloqueado"
            style={{
              fontSize: "0.875rem",
              color: "var(--color-text)",
              flexShrink: 0,
              lineHeight: 1,
              opacity: 0.5,
            }}
          >
            🔒
          </span>
        )}

        {/* Achievement name */}
        <span
          data-testid="unique-name"
          style={{
            fontSize: "0.875rem",
            fontWeight: unlocked ? 600 : 400,
            color: "var(--color-text)",
            lineHeight: 1.3,
          }}
        >
          {unique.name}
        </span>
      </div>

      {/* Condition — always visible (not obscure, AC-10-007.2) */}
      <span
        data-testid="unique-condition"
        style={{
          fontSize: "0.75rem",
          color: "var(--color-text)",
          opacity: 0.7,
          paddingLeft: "calc(var(--space-base) * 1.25)",
        }}
      >
        {unique.condition}
      </span>

      {/* Unlock metadata: date + project (only when unlocked — AC-10-007.2) */}
      {unlocked && unique.date !== undefined && (
        <div
          style={{
            display: "flex",
            gap: "calc(var(--space-base) * 0.5)",
            paddingLeft: "calc(var(--space-base) * 1.25)",
            flexWrap: "wrap",
          }}
        >
          <span
            data-testid="unique-date"
            className="tabular-nums"
            style={{
              fontSize: "0.6875rem",
              color: "var(--color-accent)",
              fontWeight: 500,
            }}
          >
            {formatDate(unique.date)}
          </span>
          {unique.project !== undefined && (
            <span
              data-testid="unique-project"
              style={{
                fontSize: "0.6875rem",
                color: "var(--color-text)",
                opacity: 0.6,
              }}
            >
              {unique.project}
            </span>
          )}
        </div>
      )}
    </li>
  );
}

// ─── CategoryGroup ────────────────────────────────────────────────────────────

type CategoryGroupProps = {
  category: UniqueCategory;
  uniques: readonly Unique[];
};

function CategoryGroup({ category, uniques }: CategoryGroupProps): React.JSX.Element {
  return (
    <section
      data-testid={`uniques-category-${category}`}
      aria-label={`Categoría ${CATEGORY_LABELS[category]}`}
    >
      {/* Category heading */}
      <h3
        data-testid={`uniques-category-heading-${category}`}
        style={{
          fontSize: "0.75rem",
          fontWeight: 600,
          color: "var(--color-text)",
          opacity: 0.6,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          marginBottom: "calc(var(--space-base) * 0.5)",
        }}
      >
        {CATEGORY_LABELS[category]}
      </h3>

      {/* Achievement list */}
      <ul
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
          display: "flex",
          flexDirection: "column",
          gap: "calc(var(--space-base) * 0.375)",
        }}
      >
        {uniques.map((u) => (
          <UniqueItem key={u.name} unique={u} />
        ))}
      </ul>
    </section>
  );
}

// ─── UniquesSection ───────────────────────────────────────────────────────────

export type UniquesSectionProps = {
  /** All unique achievements from computeUniques(). */
  uniques: readonly Unique[];
};

/**
 * CMP-10-uniques — Section rendering all unique achievements grouped by category.
 *
 * Server Component: receives the Unique[] array (pre-computed by the caller
 * via computeUniques(readerData)) and renders without any I/O.
 *
 * Empty uniques list → renders the section container with no category groups.
 */
export function UniquesSection({ uniques }: UniquesSectionProps): React.JSX.Element {
  // Group by category, preserving CATEGORY_ORDER
  const byCategory = new Map<UniqueCategory, Unique[]>();
  for (const cat of CATEGORY_ORDER) {
    byCategory.set(cat, []);
  }
  for (const u of uniques) {
    const arr = byCategory.get(u.category);
    if (arr !== undefined) {
      arr.push(u);
    }
  }

  // Only render categories that have at least one achievement
  const presentCategories = CATEGORY_ORDER.filter((cat) => (byCategory.get(cat)?.length ?? 0) > 0);

  return (
    <section
      data-testid="uniques-section"
      aria-label="Logros únicos por categoría"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "calc(var(--space-base) * 1.5)",
      }}
    >
      {presentCategories.map((cat) => {
        const catUniques = byCategory.get(cat);
        if (!catUniques || catUniques.length === 0) return null;
        return <CategoryGroup key={cat} category={cat} uniques={catUniques} />;
      })}
    </section>
  );
}
