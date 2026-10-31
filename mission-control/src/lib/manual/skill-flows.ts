/** Shared flow graph types used by the Manual diagram renderer. */

/** A clickable reference from a flow step to another skill or agent. */
export interface FlowCall {
  /** Skill slug (e.g. "spec") or agent id (e.g. "reviewer"). */
  ref: string;
  as: "skill" | "agent";
  /** What it does at this step (optional, for the tooltip/sub-line). */
  note?: string;
}

/**
 * Step kind drives the node's color/icon:
 * - action: a normal step      - gate: a decision / human gate
 * - safe: a safe point/commit  - io: owner input/output
 * - loop: a repeating phase
 */
export type FlowStepKind = "action" | "gate" | "safe" | "io" | "loop";

export interface FlowStep {
  title: string;
  kind: FlowStepKind;
  /** One plain-language line — what happens here, for dummies. */
  detail?: string;
  /** When true, the step's `calls` run in parallel (rendered side-by-side with an "en paralelo" tag). */
  parallel?: boolean;
  /** Optional condition / caveat note. */
  note?: string;
  /** Skills/agents this step invokes — clickable. */
  calls?: FlowCall[];
}

export interface SkillFlow {
  slug: string;
  /** 2–4 sentences, plain language: what it does, why it matters, when you use it. */
  explainer: string;
  runsIn: "factory" | "project";
  steps: FlowStep[];
  /** What repeats across the flow (optional). */
  loop?: string;
}
