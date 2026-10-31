import type { IconName } from "@/components/core/Icon/iconData";
import type { CopyKey } from "@/lib/copy/copy";

/** Status hues: they mean status or severity only (a project's phase counts as status). */
export const STATUS_TONES = ["green", "amber", "coral"] as const;
/** Category hues: they carry no status meaning. */
export const CATEGORY_TONES = ["blue", "teal", "violet", "pink", "slate", "gold"] as const;

type StatusTone = (typeof STATUS_TONES)[number];
export type CategoryTone = (typeof CATEGORY_TONES)[number];
export type Tone = StatusTone | CategoryTone;

export interface Presentation {
  readonly tone: Tone;
  readonly icon: IconName;
  readonly labelKey: CopyKey;
}

export const PHASES = [
  "discovered",
  "product",
  "design",
  "architecture",
  "implementation",
  "release",
] as const;
export type Phase = (typeof PHASES)[number];

/** Phase to tone, icon and label: the single source every surface reads (DR-115). */
export const PHASE_PRESENTATION = {
  discovered: { tone: "teal", icon: "search", labelKey: "common.phases.discovered" },
  product: { tone: "blue", icon: "layers", labelKey: "common.phases.product" },
  design: { tone: "pink", icon: "palette", labelKey: "common.phases.design" },
  architecture: { tone: "amber", icon: "cube", labelKey: "common.phases.architecture" },
  implementation: { tone: "violet", icon: "bolt", labelKey: "common.phases.implementation" },
  release: { tone: "green", icon: "rocket", labelKey: "common.phases.release" },
} as const satisfies Record<Phase, Presentation>;

/** Fallback for a phase the reader does not know. */
const UNKNOWN_PHASE = {
  tone: "slate",
  icon: "dot",
  labelKey: "common.phases.none",
} as const satisfies Presentation;

/** Presentation of a phase id; unknown ids fall back to the neutral «Sin fase». */
export function phasePresentation(phase: string | undefined): Presentation {
  return PHASES.includes(phase as Phase) ? PHASE_PRESENTATION[phase as Phase] : UNKNOWN_PHASE;
}

export const WORK_ORDER_STATES = ["todo", "in_progress", "review", "done", "blocked"] as const;
export type WorkOrderState = (typeof WORK_ORDER_STATES)[number];

/** Work-order state to tone, icon and label (the reader's failed state maps to `blocked`). */
export const WORK_ORDER_STATE_PRESENTATION = {
  todo: { tone: "slate", icon: "circle", labelKey: "common.workOrderStates.todo" },
  in_progress: { tone: "blue", icon: "loader", labelKey: "common.workOrderStates.inProgress" },
  review: { tone: "amber", icon: "eye", labelKey: "common.workOrderStates.review" },
  done: { tone: "green", icon: "check", labelKey: "common.workOrderStates.done" },
  blocked: { tone: "coral", icon: "alert", labelKey: "common.workOrderStates.blocked" },
} as const satisfies Record<WorkOrderState, Presentation>;

/** Completed work first in progress stacks; independent of filter/board ordering. */
export const WORK_ORDER_STACK_STATES = [
  "done",
  "review",
  "in_progress",
  "blocked",
  "todo",
] as const satisfies readonly WorkOrderState[];

const UNKNOWN_STATE = {
  tone: "slate",
  icon: "dot",
  labelKey: "common.workOrderStates.none",
} as const satisfies Presentation;

/** Presentation of a work-order state; unknown values fall back to «Sin estado». */
export function statePresentation(state: string | undefined): Presentation {
  return WORK_ORDER_STATES.includes(state as WorkOrderState)
    ? WORK_ORDER_STATE_PRESENTATION[state as WorkOrderState]
    : UNKNOWN_STATE;
}

const RETURN_TYPES = ["monetary", "personal", "mixed"] as const;
export type ReturnType = (typeof RETURN_TYPES)[number];

/** Return type to tone and label (category hues only). */
export const RETURN_PRESENTATION = {
  monetary: { tone: "teal", labelKey: "common.returnTypes.monetary" },
  personal: { tone: "violet", labelKey: "common.returnTypes.personal" },
  mixed: { tone: "pink", labelKey: "common.returnTypes.mixed" },
} as const satisfies Record<ReturnType, { tone: CategoryTone; labelKey: CopyKey }>;

/** Achievement rarity to a category tone (the rarity word is always shown). */
export const RARITY_TONE = {
  common: "slate",
  uncommon: "teal",
  rare: "blue",
  epic: "violet",
  legend: "gold",
} as const satisfies Record<string, CategoryTone>;
