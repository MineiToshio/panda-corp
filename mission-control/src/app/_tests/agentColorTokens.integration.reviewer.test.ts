/**
 * FRD-13 — REVIEWER adversarial integration probe (DR-015).
 *
 * Written by the reviewer (Opus 4.8), NOT the implementer. WO-13-001 removed the
 * fictitious `guild` agent role and WO-13-002 removed `--color-agent-guild` from
 * the globals.css `@theme` block. The implementer's own suite checked the FORWARD
 * direction (every AGENT_COLOR key has a CSS var; guild is gone from @theme) but
 * never the REVERSE: that no production code still references a now-deleted
 * `--color-agent-*` custom property.
 *
 * IF-13-agent-colors is the single synced source: tokens.ts AGENT_COLOR ⟷ globals.css
 * @theme. A dangling `var(--color-agent-X)` in a consuming component resolves to an
 * undefined custom property — a real visual regression that `vitest --changed` cannot
 * catch (the consuming source file wasn't touched, so its tests don't run on the gate).
 *
 * Scope: this probe targets the CANONICAL role set only (AGENT_ROLES). Pre-existing
 * fallback references to non-canonical names (librarian/orchestrator/unknown) are out
 * of scope for FRD-13 and predate this cycle.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { AGENT_ROLES } from "../_design/tokens/tokens";

const SRC_ROOT = path.resolve(__dirname, "../../");
const GLOBALS_CSS = path.resolve(__dirname, "../globals.css");

/** A role that was part of AGENT_ROLES history but is no longer canonical. */
const REMOVED_ROLES = ["guild"] as const;

/** Recursively collect all .ts/.tsx source files under src/, excluding test files. */
function collectSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === "_tests" || entry === "node_modules") continue;
      out.push(...collectSourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry) && !/\.(test|spec)\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

/** Every --color-agent-<role> token the @theme block declares. */
function declaredAgentTokens(): Set<string> {
  const css = readFileSync(GLOBALS_CSS, "utf8");
  const tokens = new Set<string>();
  for (const m of css.matchAll(/--color-agent-([a-z-]+)\s*:/g)) {
    tokens.add(`--color-agent-${m[1]}`);
  }
  return tokens;
}

describe("FRD-13 reviewer — agent-color tokens stay in sync after Party realignment", () => {
  it("no production code references a --color-agent-<removed-role> after WO-13-001/002 removed it", () => {
    const files = collectSourceFiles(SRC_ROOT);
    const offenders: string[] = [];

    for (const file of files) {
      if (file === GLOBALS_CSS) continue;
      const content = readFileSync(file, "utf8");
      for (const role of REMOVED_ROLES) {
        if (content.includes(`--color-agent-${role}`)) {
          offenders.push(`${path.relative(SRC_ROOT, file)} still references --color-agent-${role}`);
        }
      }
    }

    expect(
      offenders,
      `Dangling reference(s) to a removed agent-color token — the var was deleted from @theme by WO-13-002 but consumers still use it:\n  ${offenders.join("\n  ")}`,
    ).toEqual([]);
  });

  it("the canonical AGENT_ROLES set and the @theme --color-agent-* declarations are in exact sync (both directions)", () => {
    const declared = declaredAgentTokens();
    const expected = new Set(AGENT_ROLES.map((r) => `--color-agent-${r}`));

    const missingInCss = [...expected].filter((t) => !declared.has(t));
    const extraInCss = [...declared].filter((t) => !expected.has(t));

    expect(
      missingInCss,
      `Roles in AGENT_ROLES with no @theme CSS var: ${missingInCss.join(", ")}`,
    ).toEqual([]);
    expect(
      extraInCss,
      `Orphan @theme CSS vars with no matching role: ${extraInCss.join(", ")}`,
    ).toEqual([]);
  });
});
