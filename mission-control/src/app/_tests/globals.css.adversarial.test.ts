/**
 * WO-13-002 — globals.css ADVERSARIAL review tests (reviewer-authored, DR-015)
 *
 * The implementer's globals.css.test.ts is purely textual: it asserts that token
 * names like `--spacing:` are PRESENT, but never that the resulting CSS BEHAVES
 * correctly when compiled by Tailwind v4. These tests close edge cases the
 * implementer did not see — derived from the EARS criteria and from Tailwind v4
 * token-namespace semantics, not from what is already tested.
 *
 * Key adversarial axes:
 *   (A) Tailwind v4 RESERVED token collision — `--spacing` inside @theme is NOT a
 *       free-form token: it is the multiplier for every spacing utility
 *       (p-4 = calc(var(--spacing) * 4)). Overriding it from the default 0.25rem
 *       to 1rem 4x-inflates the entire spacing scale. This is a real, compiled-CSS
 *       behavioural bug that no textual presence check can catch.
 *   (B) High-contrast must override the ACCENT (and base/contrast), not just
 *       surface/text — otherwise enabling high-contrast still leaves the
 *       low-contrast warm accent in place (AC-13-001.1: "without a redesign").
 *   (C) Duration values must be REAL finite numbers, not var() indirection or
 *       non-numeric leakage (regression anchor B1' from WO-13-001).
 *   (D) The reduced-motion var reset must zero the SAME duration vars the @theme
 *       declares — a partial reset (e.g. only --duration-fast) leaves JS RAF
 *       consumers animating (AC-13-006.1: "disables ALL Party animation").
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

const GLOBALS_CSS_PATH = path.resolve(import.meta.dirname, "..", "globals.css");
const PROJECT_ROOT = path.resolve(import.meta.dirname, "..", "..");

function readCss(): string {
  return fs.readFileSync(GLOBALS_CSS_PATH, "utf-8");
}

/**
 * Walk braces from `start` and return the body of the first balanced `{ ... }`
 * block at or after that position. Returns "" if `start` is negative or no
 * balanced block is found. Shared by the at-rule and regex-anchored extractors.
 */
function blockBodyFrom(css: string, start: number): string {
  if (start < 0) return "";
  let depth = 0;
  let open = -1;
  for (let i = start; i < css.length; i++) {
    if (css[i] === "{") {
      if (open === -1) open = i;
      depth++;
    } else if (css[i] === "}") {
      depth--;
      if (depth === 0 && open !== -1) return css.slice(open + 1, i);
    }
  }
  return "";
}

function extractBlock(css: string, atRule: string): string {
  return blockBodyFrom(css, css.indexOf(atRule));
}

// ---------------------------------------------------------------------------
// (A) Tailwind v4 reserved-token collision — COMPILED behaviour, not text.
//     This is the headline finding. Building globals.css with Tailwind and a
//     probe element proves that `p-8` resolves to the inflated value.
// ---------------------------------------------------------------------------

describe("frd-13 AC-13-004.1 [adversarial]: Tailwind v4 reserved --spacing token must not inflate the spacing scale", () => {
  it("frd-13: the @theme --spacing override does not silently 4x every spacing utility (p-4 must stay 1rem, not 4rem)", () => {
    // In Tailwind v4, `--spacing` in @theme is the reserved base multiplier:
    //   .p-4 { padding: calc(var(--spacing) * 4) }
    // Default --spacing is 0.25rem, so p-4 = 1rem. globals.css sets --spacing: 1rem,
    // making p-4 = 4rem — a 4x regression for EVERY consuming component (FRD-02..10).
    //
    // We compile globals.css against a probe and read the resolved value.
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "wo13002-"));
    const probe = path.join(PROJECT_ROOT, `__adv_probe_${Date.now()}.tsx`);
    const outCss = path.join(tmpDir, "out.css");
    fs.writeFileSync(probe, 'export const X = () => <div className="p-4 p-8" />;\n');

    let resolved = "";
    try {
      execFileSync(
        "npx",
        ["--yes", "@tailwindcss/cli@4.1.13", "-i", GLOBALS_CSS_PATH, "-o", outCss],
        { cwd: PROJECT_ROOT, stdio: "pipe", timeout: 120_000 },
      );
      resolved = fs.readFileSync(outCss, "utf-8");
    } finally {
      fs.rmSync(probe, { force: true });
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }

    // Find the --spacing value the @theme exposes in compiled output.
    const spacingMatch = resolved.match(/--spacing:\s*([^;]+);/);
    const spacingValue = (spacingMatch?.[1] ?? "").trim();

    // CONTRACT: spacing scale base must be 0.25rem (Tailwind default) so that
    // p-4 = 1rem (16px) and the FRD's "base 16px" reads as p-4, not p-1.
    // If the WO needs a 16px elevation token it must use a NON-reserved name
    // (e.g. --elevation-base or --space-base), never the reserved --spacing.
    expect(
      spacingValue,
      `Tailwind v4 reserved --spacing is set to "${spacingValue}". A value other than 0.25rem ` +
        `rescales EVERY spacing utility (p-*, m-*, gap-*) across the whole app. ` +
        `p-8 currently compiles to calc(var(--spacing) * 8) = ${spacingValue === "" ? "?" : `8 * ${spacingValue}`}. ` +
        `Use a non-reserved token name for the 16px elevation base (AC-13-004.1).`,
    ).toBe("0.25rem");
  });
});

// ---------------------------------------------------------------------------
// (B) High-contrast must override the ACCENT, not just surface/text.
// ---------------------------------------------------------------------------

describe("frd-13 AC-13-001.1 [adversarial]: high-contrast overrides the accent (not just surface/text)", () => {
  let hcBlock: string;

  beforeAll(() => {
    const css = readCss();
    // Extract the high-contrast selector block.
    const pos = css.search(/\[data-theme=['"]high-contrast['"]\]|\.high-contrast/);
    hcBlock = blockBodyFrom(css, pos);
  });

  it("frd-13: high-contrast block exists as a selector override (no separate stylesheet)", () => {
    expect(hcBlock.length).toBeGreaterThan(0);
  });

  it("frd-13: high-contrast overrides --color-accent (a warm low-contrast accent must not survive into high-contrast mode)", () => {
    // EARS: high-contrast "without a redesign" means the SAME accent var is re-pointed.
    // If only surface/text flip but the accent keeps its mid-chroma warm value,
    // accent-on-background contrast can fall below 4.5:1 — defeating the mode.
    expect(
      hcBlock,
      "high-contrast block must override --color-accent so the rationed accent meets contrast in HC mode",
    ).toMatch(/--color-accent\s*:/);
  });

  it("frd-13: high-contrast overrides surface AND text (the legibility floor)", () => {
    expect(hcBlock).toMatch(/--color-surface\s*:/);
    expect(hcBlock).toMatch(/--color-text\s*:/);
  });
});

// ---------------------------------------------------------------------------
// (C) Duration values must be real finite numbers in ms (no var() indirection,
//     no non-numeric leakage). Mutation guard for AC-13-005.1.
// ---------------------------------------------------------------------------

describe("frd-13 AC-13-005.1 [adversarial]: duration tokens are concrete finite ms values", () => {
  it("frd-13: every @theme --duration-* value is a concrete <number>ms literal, never var()/calc()/non-numeric", () => {
    const themeBlock = extractBlock(readCss(), "@theme");
    const matches = [...themeBlock.matchAll(/--duration-(\w+)\s*:\s*([^;]+);/g)];
    expect(matches.length, "@theme must declare at least one --duration-* token").toBeGreaterThan(
      0,
    );
    for (const [, name, raw] of matches) {
      const value = (raw ?? "").trim();
      // Must match exactly an integer/decimal followed by ms (no var/calc/percentage).
      expect(
        value,
        `--duration-${name} = "${value}" must be a concrete <n>ms literal (no var()/calc()/NaN/Infinity)`,
      ).toMatch(/^\d+(?:\.\d+)?ms$/);
      const ms = Number.parseFloat(value);
      expect(Number.isFinite(ms), `--duration-${name} must be finite`).toBe(true);
      expect(ms, `--duration-${name} must be < 300ms (AC-13-005.1)`).toBeLessThan(300);
      expect(
        ms,
        `--duration-${name} must be > 0ms (a 0ms default would kill all motion)`,
      ).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// (D) reduced-motion must reset EXACTLY the duration vars the @theme declares.
//     A partial reset leaves JS RAF/WAAPI consumers reading non-zero durations.
// ---------------------------------------------------------------------------

describe("frd-13 AC-13-006.1 [adversarial]: reduced-motion zeroes every declared --duration-* var", () => {
  it("frd-13: each @theme --duration-* token is also reset to 0 inside @media (prefers-reduced-motion: reduce)", () => {
    const css = readCss();
    const themeBlock = extractBlock(css, "@theme");
    const declared = [...themeBlock.matchAll(/--duration-(\w+)\s*:/g)].map((m) => m[1]);
    expect(declared.length, "@theme must declare --duration-* tokens").toBeGreaterThan(0);

    // Extract the reduced-motion block body.
    const pos = css.indexOf("prefers-reduced-motion");
    expect(pos, "globals.css must contain a prefers-reduced-motion media query").toBeGreaterThan(
      -1,
    );
    const rmBlock = blockBodyFrom(css, pos);

    for (const name of declared) {
      const re = new RegExp(`--duration-${name}\\s*:\\s*0(?:ms|s)?`);
      expect(
        rmBlock,
        `reduced-motion block must also zero --duration-${name} so JS RAF/WAAPI consumers (Party engine, WO-06-011) read 0 — a partial reset leaves "${name}" animating (AC-13-006.1: ALL Party animation)`,
      ).toMatch(re);
    }
  });
});
