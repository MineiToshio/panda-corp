/**
 * WO-13-010 — the Órbita token mirror in globals.css (IF-13-tokens, IF-13-registry, CMP-13-globals,
 * CMP-13-fonts). AC-13-010.2, AC-13-010.3, AC-13-010.4: the frozen design-tokens.json round-trips
 * into the stylesheet, fonts are the prototype's, hover is gated, scene tokens are always dark.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "../../..");
const css = fs.readFileSync(path.join(ROOT, "src/app/globals.css"), "utf8");
const tokens = JSON.parse(
  fs.readFileSync(path.join(ROOT, "docs/design/design-tokens.json"), "utf8"),
);
const baseCss = fs.readFileSync(path.join(ROOT, "docs/design/prototype/base.css"), "utf8");

const norm = (s: string) =>
  s
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/'/g, '"')
    .replace(/(^|[^\d])\.(\d)/g, "$10.$2")
    .replace(/\s+/g, " ")
    .replace(/ ?([{}:;,()>]) ?/g, "$1")
    .replace(/;}/g, "}")
    .trim();

const stripped = css.replace(/\/\*[\s\S]*?\*\//g, "");

/** Bodies of every top-level-or-nested block whose header equals `header` (whitespace-insensitive). */
function bodies(source: string, header: string): string[] {
  const out: string[] = [];
  const want = norm(header);
  const re = /([^{};]+)\{/g;
  for (let m = re.exec(source); m; m = re.exec(source)) {
    if (norm(m[1] ?? "") !== want) continue;
    let depth = 1;
    let i = re.lastIndex;
    for (; i < source.length && depth > 0; i++)
      depth += source[i] === "{" ? 1 : source[i] === "}" ? -1 : 0;
    out.push(source.slice(re.lastIndex, i - 1));
  }
  return out;
}

function declares(block: string, name: string, value: string): boolean {
  return norm(block).includes(norm(`${name}:${value};`));
}

describe("AC-13-010.4: token round trip and always-dark scene tokens", () => {
  const light = tokens.light as Record<string, Record<string, string>>;
  const dark = tokens.dark as Record<string, Record<string, string>>;

  it("AC-13-010.4: every light token is declared on :root with its frozen value", () => {
    const rootBlocks = [...bodies(stripped, ":root"), ...bodies(stripped, "@theme")].join("\n");
    const missing: string[] = [];
    for (const group of Object.values(light))
      for (const [name, value] of Object.entries(group))
        if (!declares(rootBlocks, name, value)) missing.push(name);
    expect(missing).toEqual([]);
  });

  it("AC-13-010.4: every dark token is declared on :root[data-theme=dark] and in the no-JS fallback", () => {
    const darkBlock = bodies(stripped, ':root[data-theme="dark"]')[0] ?? "";
    const fallback = bodies(stripped, ":root:not([data-theme])")[0] ?? "";
    for (const group of Object.values(dark))
      for (const [name, value] of Object.entries(group)) {
        expect(declares(darkBlock, name, value), name).toBe(true);
        if (name !== "--tint" && name !== "--tint-strong")
          expect(declares(fallback, name, value), name).toBe(true);
      }
  });

  it("AC-13-010.4: scene and map tokens are declared once, never in a theme block", () => {
    for (const name of [...Object.keys(light.scene ?? {}), ...Object.keys(light.map ?? {})]) {
      const count = (stripped.match(new RegExp(`(^|[\\s{;])${name}\\s*:`, "g")) ?? []).length;
      expect(count, name).toBe(1);
    }
    expect(bodies(stripped, ':root[data-theme="dark"]').join("")).not.toMatch(/--(scene|map)-/);
  });

  it("AC-13-010.4: the .fragua scope maps the scene tokens and every overrides rule is present", () => {
    for (const rule of tokens.overrides.rules as {
      selector: string;
      context: string;
      tokens: Record<string, string>;
    }[]) {
      const scope = rule.context ? bodies(stripped, rule.context).join("\n") : stripped;
      const found = bodies(scope, rule.selector).join("\n");
      expect(found, rule.selector).not.toBe("");
      for (const [name, value] of Object.entries(rule.tokens)) {
        if (value === `var(${name})`) continue;
        expect(declares(found, name, value), `${rule.selector} ${name}`).toBe(true);
      }
    }
    expect(norm(bodies(stripped, ".fragua").join(""))).toContain("--surface:var(--scene-surface);");
  });

  it("AC-13-010.4: no high-contrast layer survives", () => {
    expect(css).not.toMatch(/high-contrast/);
  });
});

describe("AC-13-010.1: neutral chrome", () => {
  it("AC-13-010.1: the chrome colour tokens of both themes are near-neutral; hue lives only in the hue group", () => {
    const spread = (hex: string) => {
      const ch = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));
      return Math.max(...ch) - Math.min(...ch);
    };
    for (const theme of [tokens.light, tokens.dark] as Record<string, Record<string, string>>[])
      for (const [name, value] of Object.entries(theme.color ?? {}))
        if (name !== "--focus") expect(spread(value), name).toBeLessThanOrEqual(32);
  });
});

describe("AC-13-010.2: fonts and type scale", () => {
  it("AC-13-010.2: the @font-face rules equal the prototype's except the URL", () => {
    const expected = baseCss
      .split("\n")
      .slice(1, 8)
      .map((l) => norm(l.replace("url('assets/", 'url("/fonts/')));
    const actual = bodies(stripped, "@font-face").map((b) => norm(`@font-face{${b}}`));
    expect(actual).toEqual(expected);
    for (const file of ["SpaceGrotesk.ttf", "JetBrainsMono.ttf", "inter-400.ttf", "inter-800.ttf"])
      expect(fs.existsSync(path.join(ROOT, "public/fonts", file)), file).toBe(true);
  });

  it("AC-13-010.2: the size registry is the eleven --fs steps and none is below 12px", () => {
    const sizes = Object.entries(tokens.light.typography as Record<string, string>).filter(([k]) =>
      k.startsWith("--fs-"),
    );
    expect(sizes).toHaveLength(11);
    for (const [, px] of sizes) expect(Number.parseFloat(px)).toBeGreaterThanOrEqual(12);
    const registry = (stripped.match(/--text-[a-z0-9]+:\s*var\(--fs-[a-z0-9]+\)/g) ?? []).length;
    expect(registry).toBe(11);
    expect(stripped).toMatch(/--text-\*:\s*initial/);
  });
});

describe("AC-13-010.3: hover gating, scroll padding, reduced motion", () => {
  it("AC-13-010.3: every :hover rule sits inside @media (hover: hover)", () => {
    const gatedBlocks = bodies(stripped, "@media (hover: hover)");
    const gated = gatedBlocks.join("\n");
    const outside = gatedBlocks.reduce((rest, block) => rest.replace(block, ""), stripped);
    expect(outside.match(/:hover/g) ?? []).toEqual([]);
    expect(gated).toMatch(/:hover/);
  });

  it("AC-13-010.3: scroll-padding keeps focus clear of the sticky bars", () => {
    expect(stripped).toMatch(/scroll-padding-top:\s*88px/);
    expect(stripped).toMatch(/scroll-padding-bottom:\s*80px/);
  });

  it("AC-13-010.3: the tooltip shows on focus always and on hover only for hover-capable pointers", () => {
    expect(stripped).toMatch(/\[data-tip\]:focus-visible::after/);
    expect(norm(bodies(stripped, "@media (hover: hover)").join(""))).toContain(
      "[data-tip]:hover::after",
    );
  });

  it("AC-13-010.3: one reduced-motion block turns animation and transition off", () => {
    const blocks = bodies(stripped, "@media (prefers-reduced-motion: reduce)");
    expect(blocks).toHaveLength(1);
    expect(norm(blocks[0] ?? "")).toContain("animation:none !important");
    expect(norm(blocks[0] ?? "")).toContain("transition:none !important");
  });
});
