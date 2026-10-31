import { Chip, type ChipTone } from "@/components/core/Chip/Chip";
import type { IconName } from "@/components/core/Icon/iconData";
import { ProgressBar } from "@/components/core/ProgressBar/ProgressBar";
import { t } from "@/lib/copy/copy";
import type { IdeaStatus } from "@/lib/ideas/ideas";
import styles from "./IdeaCard.module.css";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface IdeaCardProps {
  href?: string;
  onNavigate?: () => void;
  ordersDone?: number;
  ordersTotal?: number;
  /** Filename without .md — uniquely identifies the card. */
  slug: string;
  /** Frontmatter `title` field. */
  title: string;
  /** Frontmatter `status` field — validated against the IdeaStatus union. */
  status: IdeaStatus;
  /** Frontmatter `project_type` — shown as the category chip. Optional. */
  projectType?: string;
  /** Frontmatter `return_type` — shown as the return chip. Optional. */
  returnType?: "monetary" | "opportunity" | "personal" | "mixed";
  /** Frontmatter `score` — shown with tabular-nums. Optional. */
  score?: number;
  /** Frontmatter `project` pointer (when in-pipeline). Not displayed directly. */
  project?: string;
  /** Markdown body (gray-matter .content). Not rendered in the card summary. */
  body: string;
  /**
   * Whether the linked project is actively building (running: true in status.yaml).
   * Set by the board view after reading readStatus. Drives the building indicator (REQ-02-008).
   */
  isRunning?: boolean;
  /**
   * Whether the owner pinned this card as a favourite (`favorite: true` frontmatter, REQ-02-012).
   * Visual-only: the filled star and accessible name indicate the favourite. Works in any
   * column; does NOT change the status or the board column.
   */
  favorite?: boolean;
}

// ---------------------------------------------------------------------------
// Spanish label maps (faithful to the prototype CAT / RET maps).
// The category map carries a Spanish label + Órbita icon; unknown categories
// fall back to the raw value (keeps free-form project_type values visible).
// The return map carries a Spanish label + Chip tone (semantic colour).
// ---------------------------------------------------------------------------

/** project_type → [Spanish label, Órbita icon] (prototype CAT, index.html L185). */
export const CATEGORY_LABELS: Record<string, readonly [string, IconName]> = {
  web: ["web", "circle"],
  mobile: ["mobile", "grid"],
  desktop: ["desktop", "grid"],
  ia: ["IA", "sparkles"],
  "claude-code": ["claude-code", "terminal"],
  "prompt-system": ["prompts", "file"],
  automatizacion: ["automatización", "users"],
  cli: ["CLI", "terminal"],
  rework: ["rework", "rotate"],
  otro: ["otro", "cube"],
};

/** Web target platform → Spanish label + icon, for the "qué es" tags (DR-074). */
const PLATFORM_LABELS: Record<string, readonly [string, IconName]> = {
  desktop: ["Desktop", "grid"],
  mobile: ["Mobile", "grid"],
  responsive: ["Responsive", "grid"],
};

/** A "qué es" meta chip — what kind of app it is (and, for web, its platform). */
export interface MetaChip {
  label: string;
  icon?: IconName;
}

/**
 * The "qué es" chips for a card/project: its app type (web / mobile / API …) and, when
 * known, its web target platform (desktop / mobile / responsive). Single source reused by
 * both the Propuesta (IdeaPitch) and Spec (SpecDigest) tabs so they never drift.
 */
export function projectMetaChips(projectType?: string, targetPlatforms?: string): MetaChip[] {
  const chips: MetaChip[] = [];
  if (projectType != null && projectType !== "") {
    const entry = CATEGORY_LABELS[projectType];
    chips.push({ label: entry?.[0] ?? projectType, icon: entry?.[1] });
  }
  if (targetPlatforms != null && targetPlatforms !== "") {
    const entry = PLATFORM_LABELS[targetPlatforms];
    chips.push({ label: entry?.[0] ?? targetPlatforms, icon: entry?.[1] });
  }
  return chips;
}

/** return_type values mapped to a Spanish label + a Chip tone. */
export type ReturnTypeKey = NonNullable<IdeaCardProps["returnType"]>;

/** return_type → [Spanish label, Chip tone] (prototype RET, index.html L184). */
export const RETURN_LABELS: Record<ReturnTypeKey, readonly [string, ChipTone]> = {
  monetary: ["Monetaria", "teal"],
  opportunity: ["Oportunidad", "amber"],
  personal: ["Personal", "violet"],
  mixed: ["Mixta", "pink"],
};

/** Idea summary with a real navigation link and optional live project progress. */
export function IdeaCard({
  title,
  slug,
  href,
  onNavigate,
  status,
  projectType,
  returnType,
  score,
  isRunning,
  favorite,
  project,
  ordersDone,
  ordersTotal,
}: IdeaCardProps): React.JSX.Element {
  const category = projectType
    ? (CATEGORY_LABELS[projectType]?.[0] ?? projectType)
    : t("tablero.card.noCategory");
  const returnEntry = returnType && RETURN_LABELS[returnType];
  return (
    <article
      className={`kcard ${styles.card}`}
      data-testid="idea-card"
      data-favorite={favorite ? "true" : undefined}
      aria-label={`Idea: ${title}${favorite ? " (favorita)" : ""}`}
    >
      <h3 data-testid="idea-card-title">
        <a
          className={`title ${styles.title}`}
          href={href ?? `/board/${encodeURIComponent(slug)}`}
          onClick={onNavigate ? (event) => navigate(event, onNavigate) : undefined}
        >
          {title}
        </a>
      </h3>
      <div className={styles.meta}>
        <span data-testid="idea-card-category">
          <Chip tone="slate" variant="plain">
            {category}
          </Chip>
        </span>
        {returnEntry && (
          <span data-testid="idea-card-return-type">
            <Chip tone={returnEntry[1]}>{returnEntry[0]}</Chip>
          </span>
        )}
        <span className={styles.score} data-testid={score != null ? "idea-card-score" : undefined}>
          {score == null ? (
            t("tablero.card.noScore")
          ) : (
            <>
              {t("tablero.card.score")}
              <ProgressBar
                done={score}
                total={100}
                tone="teal"
                ariaLabel={t("tablero.card.score")}
              />
              {score}
            </>
          )}
        </span>
      </div>
      {project && <ProjectProgress done={ordersDone} total={ordersTotal} />}
      {status === "in-pipeline" && isRunning && (
        <span
          data-testid="idea-card-building-indicator"
          role="status"
          aria-label={t("common.build.building")}
        >
          <Chip tone="green">{t("common.build.building")}</Chip>
        </span>
      )}
    </article>
  );
}
function navigate(event: React.MouseEvent<HTMLAnchorElement>, onNavigate: () => void): void {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
    return;
  event.preventDefault();
  onNavigate();
}

function ProjectProgress({ done, total }: { done?: number; total?: number }): React.JSX.Element {
  return (
    <div className={styles.project}>
      {total != null && total > 0 ? (
        <>
          {t("tablero.card.ordersProgress", { done: done ?? 0, total: total })}
          <ProgressBar
            done={done ?? 0}
            total={total}
            tone="blue"
            ariaLabel={t("tablero.card.ordersProgress", {
              done: done ?? 0,
              total: total,
            })}
          />
        </>
      ) : (
        t("tablero.card.projectCreated")
      )}
    </div>
  );
}
