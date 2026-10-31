import type { IdeaCardProps } from "@/components/modules/IdeaCard/IdeaCard";
import type { Adr } from "@/lib/architecture/adr";
import type { DataModelResult } from "@/lib/architecture/data-model/types";
import type { EnvVar } from "@/lib/architecture/env";
import type { BoardColumn as ColumnId } from "@/lib/board/board";
import type { DocNode } from "@/lib/docs/tree";
import type { DeployTarget, Phase } from "@/lib/status/status";
import type { WorkOrder } from "@/lib/work-orders/work-orders";

/** Board card data shared by the board and its consumers. */
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
