import type { NavigationState } from "./urls";

type Rule = readonly string[] | RegExp | number;
/** Surface ownership controls which enumerated keys are validated. */
export type NavigationContext =
  | "portfolio"
  | "observability"
  | "accounts"
  | "configuration"
  | "skills"
  | "rules"
  | "standards"
  | "manual"
  | "achievements"
  | "proposals"
  | "board"
  | "model";
/** Unsupported selections remain explicit instead of silently falling back. */
export type NavigationQueryResult = { ok: true } | { ok: false; key: string; reason: string };
/** Canonical URL set order, shared by state-filter writers and their validator. */
export const WORK_ORDER_STATE_ORDER: readonly string[] = [
  "todo",
  "in_progress",
  "review",
  "done",
  "fail",
] as const;

const ID = /^[^\\\p{Cc}]{1,512}$/u;
const MODEL = {
  model: ["Diagrama", "Esquema", "diagram", "schema"],
  modelQuery: 2048,
  entity: ID,
  schemaTable: ID,
  relationship: ID,
  expanded: ["1"],
};
const ACCOUNTS = {
  accountsQuery: 200,
  accountsState: ["all", "active", "pending", "candidates", "reference"],
  account: /^[^:/\\\p{Cc}]+:[^:/\\\p{Cc}]+$/u,
};
/** The complete owned key registry; unknown optional keys are retained by the codec. */
export const NAVIGATION_KEYS: Record<NavigationContext, Record<string, Rule>> = {
  portfolio: { view: ["tarjetas", "lista", "cuentas"], ...ACCOUNTS },
  accounts: ACCOUNTS,
  observability: {
    view: ["frd", "tablero", "deps"],
    frd: /^FRD-\d+$/,
    state: /^(todo|in_progress|review|done|fail)(,(todo|in_progress|review|done|fail))*$/,
    wo: /^WO-\d+-\d+$/,
    woview: ["summary", "full"],
    dag: ["frd", "wo"],
    focus: /^WO-\d+-\d+$/,
  },
  configuration: {
    q: 2048,
    type: ID,
    approval: ID,
    severity: ["all", "MUST", "SHOULD", "MAY"],
    domain: ID,
  },
  skills: { q: 2048, type: ID },
  rules: { q: 2048, approval: ID },
  standards: { q: 2048, severity: ["all", "MUST", "SHOULD", "MAY"], domain: ID },
  manual: { q: 2048, index: ["1"] },
  achievements: { category: ID, trophy: ID, eras: ID },
  proposals: {
    proposalsTab: ["resumen", "memory", "memoria", "backlog"],
    stream: ["promotions", "candidate-lesson", "prune"],
    lesson: ID,
    backlogItem: ID,
  },
  board: {
    boardQuery: 2048,
    category: ID,
    discarded: ["1"],
    idea: ID,
    boardTab: [
      "proposal",
      "propuesta",
      "spec",
      "architecture",
      "arquitectura",
      "documents",
      "docs",
      "campaign",
      "campana",
    ],
    doc: ID,
    phase: ID,
    specFrd: ID,
    architectureFrd: ID,
    adr: ID,
    ...MODEL,
  },
  model: MODEL,
};

function matches(rule: Rule, value: string): boolean {
  if (typeof rule === "number") return [...value].length <= rule;
  if (rule instanceof RegExp) return rule.test(value);
  return rule.includes(value);
}

/** Validate the selected surface's keys without mutating input or throwing. */
export function validateNavigationQuery(
  context: NavigationContext,
  state: NavigationState,
): NavigationQueryResult {
  for (const [key, rule] of Object.entries(NAVIGATION_KEYS[context])) {
    const value = state[key];
    if (value === undefined) continue;
    if (value.length > 2048 || !matches(rule, value))
      return { ok: false, key, reason: "unsupported" };
    if (context === "observability" && key === "state") {
      const indexes = value.split(",").map((entry) => WORK_ORDER_STATE_ORDER.indexOf(entry));
      if (indexes.some((entry, index) => index > 0 && entry <= (indexes[index - 1] ?? -1)))
        return { ok: false, key, reason: "unsupported" };
    }
  }
  return { ok: true };
}
