import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Reviewer-authored (DR-080), FRD-13 close: the rules no Biome, knip or tsc run reads. Each scan names
// the file it rejects, because a custom property nobody declares fails silently in the browser.
const ROOT = path.resolve(__dirname, "../..");

function files(dir: string, pattern: RegExp): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return entry === "_tests" ? [] : files(full, pattern);
    return pattern.test(entry) ? [full] : [];
  });
}

const SOURCES = files(ROOT, /\.(css|ts|tsx)$/).map((file) => ({
  name: path.relative(ROOT, file),
  text: readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, ""),
}));
const CSS = SOURCES.filter(({ name }) => name.endsWith(".css"));
const FRAMEWORK_VARIABLES = new Set(["--spacing"]);
/** One corner of the REQ-13-004 scale; zero, a circle and the Tailwind alias of a step also pass. */
const RADIUS_STEP =
  "(0|50%|inherit|var\\(--r(-[a-z0-9]+)?\\)|var\\(--radius-[a-z]+(, [^)]+)?\\)|var\\(--[a-z-]+, var\\(--r\\)\\))";
const RADIUS_VALUE = new RegExp(`^${RADIUS_STEP}( ${RADIUS_STEP})*( !important)?$`);
const SHADOW_VALUE =
  /^(none|inset 0 0 0 var\(--(hairline|rule)\).*|0 0 0 var\(--(hairline|rule)\).*|var\(--shadow[a-z-]*(, none)?\)( !important)?(,\s*0 0 0 var\(--(hairline|rule)\).*)?)$/s;

function hits(pattern: RegExp, allowed: RegExp): string[] {
  return SOURCES.flatMap(({ name, text }) =>
    [...text.matchAll(pattern)]
      .map((match) => match[1]?.trim().replace(/["`]/g, "") ?? "")
      .filter((value) => !allowed.test(value))
      .map((value) => `${name}: ${value}`),
  );
}

describe("FRD-13 source contracts", () => {
  it("scans the real tree", () => {
    expect(SOURCES.length).toBeGreaterThan(300);
    expect(CSS.length).toBeGreaterThan(50);
  });

  it("every custom property a rule reads is declared somewhere", () => {
    const declared = new Set(
      SOURCES.flatMap(({ text }) =>
        [...text.matchAll(/["'\s{;]?(--[a-zA-Z][\w-]*)["']?\s*:/g)].map((match) => match[1]),
      ),
    );
    const dangling = SOURCES.flatMap(({ name, text }) =>
      [...text.matchAll(/var\(\s*(--[a-zA-Z][\w-]*)\s*\)/g)]
        .map((match) => match[1] as string)
        .filter((token) => !declared.has(token) && !FRAMEWORK_VARIABLES.has(token))
        .map((token) => `${name}: ${token}`),
    );
    expect([...new Set(dangling)]).toEqual([]);
  });

  it("no v1 compatibility layer, pixel font, CDN or high-contrast theme survives", () => {
    const retired = /v1 compatibility|manual-live|--font-pixel|Pixelify|tabler-icons|data-contrast/;
    expect(SOURCES.filter(({ text }) => retired.test(text)).map(({ name }) => name)).toEqual([]);
    expect(CSS.filter(({ text }) => /:global\(\.ti\)/.test(text)).map(({ name }) => name)).toEqual(
      [],
    );
  });

  it("a stylesheet never fetches a font or image from another host", () => {
    const remote = CSS.filter(({ text }) =>
      /url\(\s*["']?https?:|@import\s+["']?https?:/.test(text),
    );
    expect(remote.map(({ name }) => name)).toEqual([]);
  });

  it("REQ-13-004: no component declares its own radius", () => {
    const offenders = [
      ...hits(/border-radius:\s*([^;]+);/g, RADIUS_VALUE),
      ...hits(/borderRadius:\s*("[^"]*"|`[^`]*`|\d+)/g, RADIUS_VALUE),
    ];
    expect(offenders).toEqual([]);
  });

  it("REQ-13-004: no component declares its own shadow", () => {
    const offenders = [
      ...hits(/box-shadow:\s*([^;]+);/g, SHADOW_VALUE),
      ...hits(/boxShadow:\s*("[^"]*"|`[^`]*`)/g, SHADOW_VALUE),
    ];
    expect(offenders).toEqual([]);
  });

  it("REQ-13-005: a transition only moves transform or opacity, under 300 ms", () => {
    const offenders = SOURCES.flatMap(({ name, text }) =>
      [...text.matchAll(/transition:\s*("[^"]*"|[^;]+;)/g)].flatMap((match) =>
        (match[1] ?? "")
          .replace(/[";]/g, "")
          .split(",")
          .map((part) => part.trim())
          .filter((part) => /var\(--dur|\d+m?s\b/.test(part) && !part.startsWith("none"))
          .filter((part) => {
            const ms = /(\d+)ms/.exec(part);
            const allowed = /^(transform|opacity|visibility)\b/.test(part);
            return !allowed || (ms !== null && Number(ms[1]) >= 300);
          })
          .map((part) => `${name}: ${part}`),
      ),
    );
    expect(offenders).toEqual([]);
  });

  it("REQ-13-005: a keyframe only moves transform or opacity", () => {
    const offenders = SOURCES.flatMap(({ name, text }) =>
      [...text.matchAll(/@keyframes\s+([\w-]+)\s*\{([\s\S]*?)\n\s*\}\n/g)].flatMap((match) =>
        [...(match[2] ?? "").matchAll(/^\s*([a-z-]+):/gm)]
          .map((property) => property[1])
          .filter((property) => property !== "transform" && property !== "opacity")
          .map((property) => `${name}: @keyframes ${match[1]} moves ${property}`),
      ),
    );
    expect(offenders).toEqual([]);
  });

  it("AC-13-010.1: hue is never an edge stripe", () => {
    const HUE = "(blue|teal|violet|pink|slate|gold|green|amber|coral|tone)";
    const stripe = new RegExp(
      `(?:border-left|border-right|borderLeft|borderRight):\\s*[^;,\\n]*(?:solid[^;,\\n]*var\\(--${HUE}\\)|solid \\$\\{)`,
      "g",
    );
    const offenders = SOURCES.flatMap(({ name, text }) =>
      [...text.matchAll(stripe)].map((match) => `${name}: ${match[0]}`),
    );
    expect(offenders).toEqual([]);
  });

  it("REQ-13-003: the body's font shorthand does not reset the tabular figures html sets", () => {
    const css = CSS.find(({ name }) => name === "app/globals.css")?.text ?? "";
    const body = /^body \{([\s\S]*?)^\}/m.exec(css)?.[1] ?? "";
    expect(body).toMatch(/font-variant-numeric:\s*tabular-nums/);
  });

  it("AC-13-010.2: no inline font-size can fall below the 12 px floor", () => {
    const offenders = SOURCES.filter(({ text }) =>
      /fontSize:\s*`\$\{Math\.max\((\d|1[01])\b/.test(text),
    ).map(({ name }) => name);
    expect(offenders).toEqual([]);
  });

  it("AC-13-010.4: every surface token a chip reads is overridden inside the scene", () => {
    const scene = CSS.find(({ name }) => name.endsWith("Fragua/Fragua.module.css"))?.text ?? "";
    const block = /^\.scene \{([\s\S]*?)^\}/m.exec(scene)?.[1] ?? "";
    for (const token of ["--surface", "--surface-2", "--surface-3", "--text-2"]) {
      expect(block, token).toMatch(new RegExp(`${token}:`));
    }
  });
});
