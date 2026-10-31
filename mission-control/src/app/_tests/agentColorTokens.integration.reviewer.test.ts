/**
 * FRD-13 — REVIEWER adversarial integration probe (DR-015).
 *
 * Written by the reviewer (Opus 4.8), NOT the implementer. WO-13-001 removed the
 * fictitious `guild` agent role and WO-13-002 removed `--color-agent-guild` from
 * the globals.css `@theme` block. The implementer's own suite checked the FORWARD
 * direction (every role had a CSS var; guild was gone from @theme) but
 * never the REVERSE: that no production code still references a now-deleted
 * `--color-agent-*` custom property.
 *
 * WO-13-013 then retired every per-role colour (REQ-13-008): a dangling `var(--color-agent-X)`
 * in a consuming component resolves to an undefined custom property, a real visual regression
 * that `vitest --changed` cannot catch because the consuming file was not touched.
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

describe("FRD-13 reviewer — per-role colour stays retired", () => {
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

  it("no per-role colour survives anywhere: REQ-13-008 leaves sprite and tier as the only identity", () => {
    const css = readFileSync(GLOBALS_CSS, "utf8");
    expect(css).not.toMatch(/--color-agent-/);
    const offenders = collectSourceFiles(SRC_ROOT)
      .filter((file) => /--color-agent-/.test(readFileSync(file, "utf8")))
      .map((file) => path.relative(SRC_ROOT, file));
    expect(offenders).toEqual([]);
  });

  it("the roster stays the thirteen real roles and never the fictitious guild aggregate", () => {
    expect(AGENT_ROLES).toHaveLength(13);
    expect(new Set(AGENT_ROLES).size).toBe(13);
    expect(AGENT_ROLES).not.toContain("guild" as never);
  });
});
