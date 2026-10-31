"use client";
import { BoardColumn } from "@/app/board/_components/BoardColumn/BoardColumn";
import { PhaseNav } from "@/app/board/_components/PhaseNav/PhaseNav";
import type { IdeaCardProps } from "@/components/modules/IdeaCard/IdeaCard";
import type { Adr } from "@/lib/architecture/adr";
import type { DataModelResult } from "@/lib/architecture/data-model/types";
import type { EnvVar } from "@/lib/architecture/env";
import type { BoardColumn as ColumnId } from "@/lib/board/board";
import { t } from "@/lib/copy/copy";
import type { DocNode } from "@/lib/docs/tree";
import type { FavoriteResult } from "@/lib/favorite/favorite";
import type { DeployTarget, Phase } from "@/lib/status/status";
import type { WorkOrder } from "@/lib/work-orders/work-orders";
import { BOARD_PHASES, columnFor } from "./boardPhases";
import styles from "./IdeaBoardView.module.css";
export interface BoardCardEntry extends IdeaCardProps {
  /** Registered public idea slug, independent of the card filename. */
  navigationSlug?: string;
  /** Pre-computed two-axis column (set by page.tsx via deriveColumn). */
  boardColumn?: ColumnId;
  /**
   * The linked project's phase (from readStatus in page.tsx), for any project-linked card.
   * Forwarded to CardDetail so the campaign's active phase matches the board column
   * (without it the card detail falls back to research → board/detail desync).
   */
  phase?: Phase;
  /** The linked project's deploy target (DR-085) — shown in the Release ficha. */
  deployTarget?: DeployTarget;
  /** The linked project's web target platform (DR-074) — a "qué es" tag in Propuesta + Spec. */
  targetPlatforms?: string;
  /**
   * Scoped doc STRUCTURE (PRD + research + per-FRD docs) from listProjectDocs in
   * page.tsx, for any project-linked card. Forwarded to CardDetail's Documentos tab; the
   * doc body loads lazily on select (the board ships structure only, never bodies).
   */
  docNodes?: DocNode[];
  /**
   * Real on-disk FRD folder count (`countFrdFolders` over `listProjectDocs` in page.tsx) —
   * the Spec tab's "N FRDs" badge. Derived LIVE from disk, never from the spec digest's
   * prose count (DR-092/DR-115): if the digest lists an FRD that doesn't exist on disk (or
   * omits one that does), the badge still shows the real folder count.
   */
  frdCount?: number;
  /**
   * Spanish high-level spec digest (PRD + research + FRDs) from readSpecDigest in page.tsx,
   * for any project-linked card once the product phase wrote it. Forwarded to CardDetail's Spec tab;
   * absent → the tab is hidden.
   */
  specContent?: string;
  /**
   * Spanish high-level architecture digest from readArchitectureDigest in page.tsx, for any
   * project-linked card once the architecture phase wrote it. Forwarded to CardDetail's Arquitectura tab; absent → tab hidden.
   */
  architectureContent?: string;
  dataModel?: DataModelResult;
  /** Live work orders (listWorkOrders) for the Arquitectura tab's implementation-plan DAG. */
  workOrders?: WorkOrder[];
  /** Live env vars (`.env.example`) for the Arquitectura tab. */
  envVars?: EnvVar[];
  /** Live ADRs (`docs/adr/*`) for the Arquitectura tab. */
  adrs?: Adr[];
  /** `discard_reason` (discarded cards only) — shown in the "Ver descartadas" modal + the detail. */
  discardReason?: string;
}

export interface IdeaBoardViewProps {
  cards: BoardCardEntry[];
  allCards?: BoardCardEntry[];
  hideEmpty?: boolean;
  isLoading?: boolean;
  error?: string;
  onCardClick?: (slug: string) => void;
  favoriteAction?: (slug: string, favorite: boolean) => Promise<FavoriteResult>;
}
/** Six phase columns and their keyboard-operable jump navigation. */
export function IdeaBoardView({
  cards,
  allCards = cards,
  hideEmpty = false,
  isLoading,
  error,
  onCardClick,
  favoriteAction,
}: IdeaBoardViewProps): React.JSX.Element {
  if (isLoading) return <section aria-busy="true" data-testid="board-loading-state" />;
  if (error)
    return (
      <section role="alert" data-testid="board-error-state">
        {error}
      </section>
    );
  const columns = BOARD_PHASES.map((phase) => ({
    ...phase,
    cards: cards.filter((card) => columnFor(card) === phase.id),
    total: allCards.filter((card) => columnFor(card) === phase.id).length,
  })).filter((phase) => !hideEmpty || phase.total > 0);
  return (
    <section data-testid="idea-board" aria-label={t("tablero.title")}>
      <PhaseNav phases={columns} />
      <section
        id="board-scroller"
        className={`kanban ideas ${styles.scroller}`}
        data-testid="board-scroll-container"
        aria-label={t("tablero.boardAria")}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: horizontal scroll region must be keyboard reachable
        tabIndex={0}
      >
        {columns.map((phase) => (
          <BoardColumn
            key={phase.id}
            phase={phase}
            onCardClick={onCardClick}
            favoriteAction={favoriteAction}
          />
        ))}
      </section>
    </section>
  );
}
