/** Pure command resolver shared by all copy-only build surfaces. No browser persistence. */
export type BuildAction = "build" | "resume" | "target";

export interface BuildTarget {
  readonly value: string;
  readonly label: string;
  readonly status?: string;
  readonly staleSuspect?: string;
}

const TARGET_PATTERN = /^(?:FRD-\d+|change:[a-zA-Z0-9][a-zA-Z0-9_-]*)$/;

/** Accept only the engine's FRD and card dialect, never individual work orders. */
export function isBuildTarget(target: BuildTarget): boolean {
  if (!TARGET_PATTERN.test(target.value)) return false;
  if (target.value.startsWith("change:") && !target.status) return false;
  if (target.staleSuspect) return false;
  return !target.status || ["ready", "draft"].includes(target.status);
}

export function buildCommand(action: BuildAction, target?: string): string | null {
  if (action === "resume") return "/pandacorp:implement --resume";
  if (action === "build") return "/pandacorp:implement";
  return target && TARGET_PATTERN.test(target) ? `/pandacorp:implement ${target}` : null;
}
