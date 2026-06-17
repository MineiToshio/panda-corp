/**
 * lib/registry.ts — WO-07-003 (FRD-07, IF-07-registry)
 *
 * Reads `factory/decisions/registry.yaml` and parses its `decisiones[]` array
 * into typed `DecisionRule` objects.
 *
 * Platform golden rule (architecture §1): read-only, never call Claude, never write.
 *
 * Traceability:
 *   IF-07-registry → AC-07-003.1 / AC-07-003.2 / AC-07-003.3 / AC-07-003.4 / AC-07-003.5
 *
 * Contract:
 *   export function readDecisionRules(): DecisionRule[]
 *   // Returns one entry per item in decisiones[] with id, patron, default,
 *   // requiereHumano: boolean, and optional nota.
 *   // Missing file or parse error → []. Never throws.
 *
 * Tolerance rules:
 *   - File missing or unreadable → []
 *   - Unparseable YAML           → []
 *   - decisiones key absent/null → []
 *   - decisiones is empty []     → []
 *   - requiere_humano absent     → false  (AC-07-003.2)
 *   - Extra/unknown YAML keys    → ignored (AC-07-003.3)
 *   - Entry missing id/patron/default → entry skipped
 */

import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { resolveFactoryRoot } from "./config";

// ---------------------------------------------------------------------------
// Types (exported — consumed by FRD-07 configuration view and FRD-08 Manual)
// ---------------------------------------------------------------------------

export type DecisionRule = {
  /** e.g. "DR-001" */
  id: string;
  /** The decision pattern (what situation triggers this rule). */
  patron: string;
  /** The pre-approved default answer / behavior. */
  default: string;
  /** Whether this rule requires human approval (true) or is auto-approved (false). */
  requiereHumano: boolean;
  /** Optional clarifying note. */
  nota?: string;
};

// ---------------------------------------------------------------------------
// Internal: YAML raw shape (the yaml parser produces plain objects)
// ---------------------------------------------------------------------------

type RawEntry = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Path resolver (uses resolveFactoryRoot for fixture-testing via env override)
// ---------------------------------------------------------------------------

function registryPath(): string {
  return path.join(resolveFactoryRoot(), "factory", "decisions", "registry.yaml");
}

// ---------------------------------------------------------------------------
// Field parsers
// ---------------------------------------------------------------------------

/** Parse one raw YAML entry into a DecisionRule, or return null if invalid. */
function parseEntry(entry: unknown): DecisionRule | null {
  if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
    return null;
  }

  const raw = entry as RawEntry;

  // Required fields: id, patron, default — must all be non-empty strings.
  // Extract into locals so biome's useLiteralKeys is satisfied with dot-notation.
  const rawId = raw.id;
  const rawPatron = raw.patron;
  const rawDefault = raw.default;

  const id = typeof rawId === "string" && rawId.trim() !== "" ? rawId : undefined;
  const patron = typeof rawPatron === "string" && rawPatron.trim() !== "" ? rawPatron : undefined;
  // "default" is a reserved word in JS syntax but valid as a property name.
  const defaultValue =
    typeof rawDefault === "string" && rawDefault.trim() !== "" ? rawDefault : undefined;

  if (id === undefined || patron === undefined || defaultValue === undefined) {
    return null;
  }

  // requiereHumano: maps from requiere_humano; absent → false (AC-07-003.2).
  const rawRh = raw.requiere_humano;
  const requiereHumano = typeof rawRh === "boolean" ? rawRh : false;

  // nota: optional string field (AC-07-003.1).
  const rawNota = raw.nota;
  const nota = typeof rawNota === "string" ? rawNota : undefined;

  // Extra/unknown keys are silently ignored (AC-07-003.3) — we only read
  // the fields above, so any other key on `raw` is simply not accessed.

  const rule: DecisionRule = {
    id,
    patron,
    default: defaultValue,
    requiereHumano,
  };

  if (nota !== undefined) {
    rule.nota = nota;
  }

  return rule;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Read and parse `factory/decisions/registry.yaml`, returning one `DecisionRule`
 * per item in `decisiones[]`.
 *
 * - Reads from `resolveFactoryRoot()` so fixture testing works via
 *   `PANDACORP_FACTORY_ROOT` env override (AC-07-003.5).
 * - Missing file or unreadable → [] with no throw (AC-07-003.4).
 * - Unparseable YAML → [] with no throw (AC-07-003.4).
 * - `requiere_humano` absent on an entry → defaults to false (AC-07-003.2).
 * - Extra/unknown YAML keys tolerated (AC-07-003.3).
 *
 * @returns Typed `DecisionRule[]`; never throws.
 */
export function readDecisionRules(): DecisionRule[] {
  const filePath = registryPath();

  // Read file — missing or unreadable → [] (AC-07-003.4).
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, "utf-8");
  } catch {
    return [];
  }

  if (!raw.trim()) {
    return [];
  }

  // Parse YAML — malformed → [] (AC-07-003.4).
  let parsed: unknown;
  try {
    parsed = parseYaml(raw);
  } catch {
    return [];
  }

  // The top-level structure must be an object with a `decisiones` array.
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return [];
  }

  const top = parsed as Record<string, unknown>;
  const decisiones = top.decisiones;

  if (!Array.isArray(decisiones)) {
    return [];
  }

  // Parse each entry, skipping any that are malformed (AC-07-003.4 graceful).
  const rules: DecisionRule[] = [];
  for (const entry of decisiones) {
    const rule = parseEntry(entry);
    if (rule !== null) {
      rules.push(rule);
    }
  }

  return rules;
}
