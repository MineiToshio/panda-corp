/**
 * WO-13-002 — globals.css ADVERSARIAL review tests, round 2 (reviewer-authored, DR-015).
 *
 * These pin edges that NEITHER the implementer's textual suite NOR the first
 * reviewer round (axes A–D) covered. Derived from the EARS criteria, not from
 * the existing tests:
 *
 *   (E) Easing tokens must be VALID cubic-bezier curves: each is `cubic-bezier(x1,y1,x2,y2)`
 *       with the X control points x1,x2 in [0,1]. An out-of-range X is silently invalid
 *       CSS — the transition falls back to the UA default, defeating "named curves"
 *       (AC-13-005.1). A purely textual `cubic-bezier(` presence check cannot catch this.
 *
 *   (F) AC-13-005.1: "Animation SHALL use only transform and opacity." globals.css must
 *       not author a `transition`/`transition-property` on a non-compositable property
 *       (width/height/top/left/margin/padding/color/background) — those trigger
 *       layout/paint and stutter. (The reduced-motion `transition-duration:0` reset is
 *       exempt: it zeroes, it does not animate.)
 *
 *   (G) AC-13-006.1 compiled-cascade proof: after Tailwind compiles globals.css, the
 *       `--duration-*` vars declared in @theme land on :root, and the reduced-motion
 *       wildcard reset must be able to win. We assert the reset is present in the
 *       COMPILED output (not just the source) so a Tailwind transform that drops the
 *       custom-property reset is caught.
 *
 *   (H) AC-13-001.1: high-contrast surface/text must be a real inversion pair
 *       (pure black canvas + pure white text, or vice-versa) — a near-black on
 *       near-white "high contrast" that is actually the default dark theme would
 *       silently pass the presence checks. Pins the extreme-luminance contract.
 *       Re-anchored 2026-06-18 (DR-054): the prototype's high-contrast is authored in
 *       HEX (#000000 / #ffffff), so this proves the extreme inversion via hex luminance,
 *       not OKLCH lightness. The contract (an extreme inversion, not a re-skinned dark
 *       theme) is unchanged — only the color space it is expressed in.
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

function extractBlock(css: string, atRule: string): string {
  const start = css.indexOf(atRule);
  if (start === -1) return "";
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

/** Extract the body of a selector block by its literal selector text. */
function extractSelectorBlock(css: string, marker: string): string {
  const pos = css.indexOf(marker);
  if (pos === -1) return "";
  let depth = 0;
  let open = -1;
  for (let i = pos; i < css.length; i++) {
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

// ---------------------------------------------------------------------------
// (E) cubic-bezier control-point validity
// ---------------------------------------------------------------------------

describe("frd-13 AC-13-005.1 [adversarial-2]: easing tokens are valid cubic-bezier curves", () => {
  it("frd-13: every --easing-* cubic-bezier has X control points x1,x2 within [0,1] (out-of-range X = invalid CSS, UA fallback)", () => {
    const themeBlock = extractBlock(readCss(), "@theme");
    const matches = [...themeBlock.matchAll(/--easing-(\w+)\s*:\s*([^;]+);/g)];
    expect(matches.length, "@theme must declare at least 2 easing tokens").toBeGreaterThanOrEqual(
      2,
    );

    for (const [, name, raw] of matches) {
      const value = (raw ?? "").trim();
      const bez = value.match(
        /^cubic-bezier\(\s*(-?\d*\.?\d+)\s*,\s*(-?\d*\.?\d+)\s*,\s*(-?\d*\.?\d+)\s*,\s*(-?\d*\.?\d+)\s*\)$/,
      );
      expect(
        bez,
        `--easing-${name} = "${value}" must be a well-formed cubic-bezier(x1,y1,x2,y2)`,
      ).not.toBeNull();
      if (!bez) continue;
      const x1 = Number.parseFloat(bez[1] ?? "NaN");
      const x2 = Number.parseFloat(bez[3] ?? "NaN");
      // Per CSS spec, X control points (abscissa) MUST be in [0,1]; out-of-range
      // makes the whole declaration invalid → the transition uses the UA default,
      // silently breaking the "2–3 named curves" contract.
      expect(
        x1,
        `--easing-${name} x1=${x1} must be within [0,1] (CSS cubic-bezier spec)`,
      ).toBeGreaterThanOrEqual(0);
      expect(x1, `--easing-${name} x1=${x1} must be within [0,1]`).toBeLessThanOrEqual(1);
      expect(x2, `--easing-${name} x2=${x2} must be within [0,1]`).toBeGreaterThanOrEqual(0);
      expect(x2, `--easing-${name} x2=${x2} must be within [0,1]`).toBeLessThanOrEqual(1);
    }
  });
});

// ---------------------------------------------------------------------------
// (F) only transform/opacity may be animated by globals.css
// ---------------------------------------------------------------------------

describe("frd-13 AC-13-005.1 [adversarial-2]: globals.css authors no non-compositable transitions", () => {
  it("frd-13: no `transition`/`transition-property` in globals.css names a layout/paint property (only transform/opacity allowed)", () => {
    const css = readCss();
    // Strip comments to avoid false hits on prose.
    const noComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
    // Collect every transition-property / shorthand transition declaration.
    const decls = [...noComments.matchAll(/\btransition(?:-property)?\s*:\s*([^;]+);/g)].map((m) =>
      (m[1] ?? "").toLowerCase(),
    );
    const forbidden = [
      "width",
      "height",
      "top",
      "left",
      "right",
      "bottom",
      "margin",
      "padding",
      "color",
      "background",
      "box-shadow",
      "border",
      "all",
    ];
    for (const decl of decls) {
      for (const prop of forbidden) {
        expect(
          decl.includes(prop),
          `globals.css transitions a non-compositable property "${prop}" ("${decl}"). AC-13-005.1 allows only transform/opacity.`,
        ).toBe(false);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// (G) compiled cascade — reduced-motion var reset survives Tailwind compilation
// ---------------------------------------------------------------------------

describe("frd-13 AC-13-006.1 [adversarial-2]: reduced-motion var reset survives Tailwind compilation", () => {
  it("frd-13: compiled CSS still contains the prefers-reduced-motion --duration-* zero reset (not dropped by the build)", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "wo13002b-"));
    const probe = path.join(PROJECT_ROOT, `__adv2_probe_${Date.now()}.tsx`);
    const outCss = path.join(tmpDir, "out.css");
    fs.writeFileSync(probe, 'export const Y = () => <div className="p-2" />;\n');

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

    // The media query must survive.
    expect(resolved, "compiled CSS dropped the prefers-reduced-motion media query").toMatch(
      /prefers-reduced-motion\s*:\s*reduce/,
    );
    // And inside it, at least one --duration-* must be reset to 0 — defense-in-depth
    // for the Party RAF loop (WO-06-011) must reach the browser, not just the source.
    const rmPos = resolved.indexOf("prefers-reduced-motion");
    const rmTail = resolved.slice(rmPos, rmPos + 2000);
    expect(
      rmTail,
      "compiled reduced-motion block lost the --duration-* zero reset (JS RAF consumers would still animate)",
    ).toMatch(/--duration-\w+\s*:\s*0(?:ms|s)?/);
  });
});

// ---------------------------------------------------------------------------
// (H) high-contrast is a true extreme-luminance inversion
// ---------------------------------------------------------------------------

describe("frd-13 AC-13-001.1 [adversarial-2]: high-contrast surface/text are extreme-luminance", () => {
  let hc: string;
  beforeAll(() => {
    hc = extractSelectorBlock(readCss(), '[data-theme="high-contrast"]');
    if (!hc) hc = extractSelectorBlock(readCss(), ".high-contrast");
  });

  it("frd-13: high-contrast surface AND text use HEX luminance at the extremes (≈0 and ≈1), a real inversion not a re-skinned dark theme (DR-054)", () => {
    expect(hc.length, "high-contrast selector block must exist").toBeGreaterThan(0);
    // DR-054: the prototype's high-contrast is authored in HEX (#000000 / #ffffff). Parse the
    // hex and compute relative luminance; the contract is unchanged — one pole near 0, the
    // other near 1 — only the color space is hex instead of OKLCH.
    const surface = hc.match(/--color-surface\s*:\s*(#[0-9a-fA-F]{3,6})\b/);
    const text = hc.match(/--color-text\s*:\s*(#[0-9a-fA-F]{3,6})\b/);
    expect(surface, "high-contrast must set --color-surface in hex").not.toBeNull();
    expect(text, "high-contrast must set --color-text in hex").not.toBeNull();

    /** Perceptual relative luminance (0=black, 1=white) from a #rgb/#rrggbb literal. */
    function hexLuminance(hex: string): number {
      let h = hex.replace("#", "");
      if (h.length === 3) {
        h = h
          .split("")
          .map((c) => c + c)
          .join("");
      }
      const toLinear = (channel: number): number => {
        const c = channel / 255;
        return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      };
      const r = toLinear(Number.parseInt(h.slice(0, 2), 16));
      const g = toLinear(Number.parseInt(h.slice(2, 4), 16));
      const b = toLinear(Number.parseInt(h.slice(4, 6), 16));
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }

    const ls = hexLuminance(surface?.[1] ?? "#888888");
    const lt = hexLuminance(text?.[1] ?? "#888888");
    // One pole near 0, the other near 1 (either orientation). |L_text - L_surface| must
    // be large enough to clear 4.5:1 by construction (pure black/white = 1.0).
    expect(
      Math.abs(lt - ls),
      `high-contrast luminance gap |${lt.toFixed(2)} - ${ls.toFixed(2)}| = ${Math.abs(lt - ls).toFixed(2)} is too small; HC must be an extreme inversion (AC-13-001.1, contrast ≥4.5:1)`,
    ).toBeGreaterThanOrEqual(0.9);
  });
});
