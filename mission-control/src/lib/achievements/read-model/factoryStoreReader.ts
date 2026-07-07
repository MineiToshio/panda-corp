/**
 * lib/achievements/read-model/factoryStoreReader.ts — the fail-loud factory store reader (FRD-23, WO-23-005, REQ-23-006.3).
 *
 * Platform golden rule (architecture §1): read-only over the read-model. This module only READS
 * `<factory-root>/.pandacorp/stats-factory.json`; the writer lives in the factory tooling (ADR-0004).
 *
 * Fail-loud (DR-078): every read returns a discriminated result — a typed value OR an explicit
 * reason — never a silent `[]`/`null` that reads as "no activity" (AC-23-006.3). Mirrors
 * `readStatsPortada`'s convention exactly so the composed reader (WO-23-006) branches identically:
 *   - present + well-formed + factory seal matches → `{ ok: true, value }`
 *   - missing                                      → `{ ok: false, reason: "missing" }`
 *   - present but factory seal mismatches (stale)  → `{ ok: false, reason: "stale" }`
 *   - present but unparseable/corrupt              → `{ ok: false, reason: "unparseable" }`
 */

import fs from "node:fs";
import path from "node:path";
import { currentFactorySeal, isFactoryFresh } from "./factorySeal";
import { parseStatsFactory, type StatsFactory } from "./statsSchema";

/** The factory-scoped store filename, under the factory root's `.pandacorp/`. */
const STATS_FACTORY_FILENAME = "stats-factory.json";

/**
 * The result of reading the factory store (DR-078 discriminated union). `reason` distinguishes
 * "missing" from "stale" from "unparseable" so the composed reader acts correctly (all three fall
 * back to the live `derive*` cores, but the distinction is observable, not a silent empty).
 */
export type FactoryResult =
  | { readonly ok: true; readonly value: StatsFactory }
  | { readonly ok: false; readonly reason: "missing" | "stale" | "unparseable" };

/** Absolute path to the factory-scoped store. */
function factoryStorePath(factoryRoot: string): string {
  return path.join(factoryRoot, ".pandacorp", STATS_FACTORY_FILENAME);
}

/** True when a filesystem error is a "file not found" (ENOENT) — a real absence, not corruption. */
function isNotFound(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "ENOENT"
  );
}

/**
 * Read the factory-scoped store, validating its freshness seal against live git.
 *
 * Fail-loud (DR-078): a corrupt/unrecognised `stats-factory.json` yields
 * `{ ok: false, reason: "unparseable" }`, NEVER a silent empty. `currentFactorySeal` is `null`
 * (git unavailable) ⇒ the store can't be validated ⇒ treated as `stale` (fall back to the live
 * cores, never trust an unvalidatable store). A stale/missing/corrupt store returns an explicit
 * reason so the composed reader re-derives ONLY the factory-wide facts (AC-23-007.2).
 *
 * @param factoryRoot - Absolute path to the factory repo root.
 * @returns A `FactoryResult` the caller branches on (`ok` → use the numbers; else fall back).
 */
export function readStatsFactory(factoryRoot: string): FactoryResult {
  const filePath = factoryStorePath(factoryRoot);

  let raw: string;
  try {
    raw = fs.readFileSync(filePath, "utf-8");
  } catch (error) {
    // ENOENT → the store was never written. Any OTHER read error (permissions, I/O) is genuinely
    // unexpected — surface it, don't swallow it (error-handling rule).
    if (isNotFound(error)) {
      return { ok: false, reason: "missing" };
    }
    throw error;
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    // Malformed JSON — fail loud (AC-23-006.3), never a silent empty.
    return { ok: false, reason: "unparseable" };
  }

  const store = parseStatsFactory(json);
  if (store === null) {
    // Well-formed JSON but an unrecognised shape — fail loud (AC-23-006.3).
    return { ok: false, reason: "unparseable" };
  }

  if (!isFactoryFresh(store, currentFactorySeal(factoryRoot))) {
    // Seal mismatch (or git unavailable) → stale → fall back to the live cores (AC-23-006.2/.3).
    return { ok: false, reason: "stale" };
  }

  return { ok: true, value: store };
}
