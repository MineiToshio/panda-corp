/**
 * lib/achievements/predicates.ts — Catalogue assembler (FRD-10 v2, WO-10-011)
 *
 * Assembles the full unique-achievement catalogue from the per-axis files under
 * `./catalogue/` and re-exports the secret catalogue + the shared types, so existing
 * consumers keep importing `UNIQUE_DEFINITIONS` / `SECRET_DEFINITIONS` / the types from
 * `@/lib/achievements/predicates` unchanged.
 *
 * The tables are split by axis to respect the ≤500-line file budget and so each axis is a
 * self-contained, reviewable unit. Every unlock derives from a verifiable real signal
 * (statuses · ideas · the real event stream via the signals layer) — see
 * docs/achievements.md §1. No `achievement`/`task=` reads (nothing emits them).
 */

import { CONSISTENCY_UNIQUES } from "./catalogue/consistency";
import { DISCOVERY_UNIQUES } from "./catalogue/discovery";
import { GUILD_UNIQUES } from "./catalogue/guild";
import { MASTERY_UNIQUES } from "./catalogue/mastery";
import { PRODUCTION_UNIQUES } from "./catalogue/production";
import { QUALITY_UNIQUES } from "./catalogue/quality";
import { RESILIENCE_UNIQUES } from "./catalogue/resilience";
import { SPEED_UNIQUES } from "./catalogue/speed";
import type { UniqueDefinition } from "./catalogue/types";

/**
 * The full unique-achievement catalogue, in axis order (FRD-10 v2, docs/achievements.md §3).
 * ~80 trophies across 8 axes, each with a per-trophy rarity and a real-signal unlock check.
 */
export const UNIQUE_DEFINITIONS: readonly UniqueDefinition[] = [
  ...DISCOVERY_UNIQUES,
  ...SPEED_UNIQUES,
  ...QUALITY_UNIQUES,
  ...CONSISTENCY_UNIQUES,
  ...MASTERY_UNIQUES,
  ...PRODUCTION_UNIQUES,
  ...GUILD_UNIQUES,
  ...RESILIENCE_UNIQUES,
];
