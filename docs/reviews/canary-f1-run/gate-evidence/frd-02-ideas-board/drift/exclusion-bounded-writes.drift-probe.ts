/**
 * Drift probe — FRD-02 "Does NOT include": "The app's writes are a small, bounded, human-triggered
 * set — discard/restore status (REQ-02-007) and the visual favourite flag (REQ-02-012) — all
 * isolated to `lib/discard/` + `lib/favorite/` (architecture §7, ADR-0003)."
 *
 * Fails on an assertion while any production module OUTSIDE `lib/discard/` + `lib/favorite/`
 * performs a filesystem write; passes once the stated contract holds. Production sources are
 * loaded only through the `@/` alias (Vite `import.meta.glob` + `?raw`).
 */
import { describe, expect, it } from "vitest";

const SOURCES = import.meta.glob("@/**/*.{ts,tsx}", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const WRITE_CALL =
  /\b(?:writeFileSync|writeFile|appendFileSync|appendFile|renameSync|unlinkSync|rmSync|mkdirSync)\s*\(/;

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}

function isProductionSource(key: string): boolean {
  return !/\/_tests\//.test(key) && !/\.(test|spec)\.tsx?$/.test(key) && !/\/src\/tests?\//.test(key);
}

function isAllowedWriter(key: string): boolean {
  return /\/lib\/discard\//.test(key) || /\/lib\/favorite\//.test(key);
}

describe("FRD-02 exclusion — app writes isolated to lib/discard + lib/favorite", () => {
  it("no production module outside lib/discard/ + lib/favorite/ writes to the filesystem", () => {
    const keys = Object.keys(SOURCES);
    expect(keys.length).toBeGreaterThan(50);

    const offenders = keys
      .filter(isProductionSource)
      .filter((key) => !isAllowedWriter(key))
      .filter((key) => WRITE_CALL.test(stripComments(SOURCES[key] ?? "")))
      .sort();

    expect(offenders).toEqual([]);
  });
});
