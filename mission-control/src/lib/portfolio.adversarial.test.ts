/**
 * WO-01-004 — `readPortfolio` ADVERSARIAL suite (DR-015).
 *
 * Written by the reviewer (Opus 4.8 — a different model from the implementer) to probe
 * edge cases, abuse and parser failure modes that the implementer's own suite
 * (`lib/portfolio.test.ts`) did NOT cover. Every expectation was pre-confirmed against the
 * real parser via a throwaway probe BEFORE being asserted here (so the suite kills mutants
 * rather than merely re-describing whatever the code happens to do).
 *
 * Scope: pure parser behavior over raw markdown content (the `arg.includes("\n")` path),
 * plus the missing-file fail-soft contract. No filesystem writes; read-only invariant.
 *
 * Traceability: AC-01-004.1 (read projects + paths), blueprint §3 (fail-soft tolerance),
 * REQ-01-010 (path preserved verbatim, never validated here), REQ-01-011 (read-only).
 */

import { describe, expect, it } from "vitest";

import { readPortfolio } from "./portfolio";

const H =
  "| Name | Path | Repo | Origin idea | Phase | Users | Return metric | Verdict | Last sync |";
const S = "|---|---|---|---|---|---|---|---|---|";

// ---------------------------------------------------------------------------
// Line-ending robustness: portfolio.md authored on Windows (CRLF).
// `content.split("\n")` leaves a trailing \r on every cell; only trimming saves it.
// Regression: if the trim were ever dropped, repo/lastSync would carry a stray \r.
// ---------------------------------------------------------------------------

describe("frd-01 adversarial: readPortfolio — CRLF line endings", () => {
  it("parses a CRLF-authored table with no stray carriage returns in any cell", () => {
    const content = [
      H,
      S,
      "| crlf | p/c | https://r | idea | product | 1 | $5 | active | 2026-01-01 |",
    ].join("\r\n");
    const result = readPortfolio(content);
    expect(result).toHaveLength(1);
    const e = result[0];
    expect(e?.name).toBe("crlf");
    expect(e?.repo).toBe("https://r"); // no trailing \r
    expect(e?.lastSync).toBe("2026-01-01"); // last cell — most exposed to \r
    // Hard assertion: nothing carries a carriage return.
    for (const v of Object.values(e ?? {})) {
      if (typeof v === "string") expect(v).not.toMatch(/\r/);
    }
  });
});

// ---------------------------------------------------------------------------
// Indented / leading-whitespace table (e.g. table nested under a list, or
// hand-formatted with leading spaces). isTableRow/isSeparatorRow trim first,
// so a space-indented table must still parse.
// ---------------------------------------------------------------------------

describe("frd-01 adversarial: readPortfolio — leading-whitespace (indented) table", () => {
  it("parses a table whose rows are indented with spaces", () => {
    const content = [
      `   ${H}`,
      `   ${S}`,
      "   | ind | p/i | https://r | idea | design | 2 | $9 | hold | 2026-02-02 |",
    ].join("\n");
    const result = readPortfolio(content);
    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe("ind");
    expect(result[0]?.phase).toBe("design");
  });
});

// ---------------------------------------------------------------------------
// Row with MORE cells than the header (trailing extra columns). Must not throw
// and must not invent fields; the extra cells beyond the header are ignored.
// ---------------------------------------------------------------------------

describe("frd-01 adversarial: readPortfolio — row with extra trailing cells", () => {
  it("ignores cells beyond the header width and never throws", () => {
    const content = [
      H,
      S,
      "| ex | p/e | https://r | idea | product | 1 | $5 | active | 2026-01-01 | EXTRA | MORE |",
    ].join("\n");
    let result: ReturnType<typeof readPortfolio> = [];
    expect(() => {
      result = readPortfolio(content);
    }).not.toThrow();
    expect(result).toHaveLength(1);
    const e = result[0];
    expect(e?.lastSync).toBe("2026-01-01");
    // No stray "extra"/"more" value leaked into any known field.
    expect(Object.values(e ?? {})).not.toContain("EXTRA");
    expect(Object.values(e ?? {})).not.toContain("MORE");
  });
});

// ---------------------------------------------------------------------------
// Duplicate header column: HEADER_MAP is name-keyed, so a duplicated "Path"
// header means the SECOND Path overwrites... but the code special-cases
// name/path from cells[0]/cells[1] and SKIPS re-mapping name/path in the loop.
// Confirmed behavior: path stays the first Path cell (cells[1]); the duplicate
// is ignored. Documents that a duplicate key cannot silently clobber path.
// ---------------------------------------------------------------------------

describe("frd-01 adversarial: readPortfolio — duplicate Path header column", () => {
  it("keeps path from the positional cell and does not let a duplicate header clobber it", () => {
    const content = [
      "| Name | Path | Path | Repo |",
      "|---|---|---|---|",
      "| dup | first/p | second/p | https://r |",
    ].join("\n");
    const result = readPortfolio(content);
    expect(result).toHaveLength(1);
    expect(result[0]?.path).toBe("first/p");
    expect(result[0]?.repo).toBe("https://r");
  });
});

// ---------------------------------------------------------------------------
// Missing separator row: a GFM table is malformed without `|---|`, but the
// parser keys off the header's first cell ("name"), not the separator, so it
// still extracts data rows. Tolerance > strict GFM. Documents the behavior.
// ---------------------------------------------------------------------------

describe("frd-01 adversarial: readPortfolio — table without a separator row", () => {
  it("still parses data rows when the |---| separator is missing", () => {
    const content = [
      H,
      "| nosep | p/n | https://r | idea | product | 1 | $5 | active | 2026-01-01 |",
    ].join("\n");
    const result = readPortfolio(content);
    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe("nosep");
  });
});

// ---------------------------------------------------------------------------
// Header-collision quirk: a DATA row whose Name cell is literally "name"
// (case-insensitive) is treated as a header and dropped — AND it rebuilds the
// column map. Confirmed: only the genuine non-"name" row survives. This is an
// accepted limitation (a project literally named "name" is implausible); the
// test pins the behavior so a future refactor must consciously change it.
// ---------------------------------------------------------------------------

describe("frd-01 adversarial: readPortfolio — data row named 'name' collides with header detection (known limitation)", () => {
  it("drops a data row whose Name cell is literally 'name' but keeps the real rows", () => {
    const content = [
      H,
      S,
      "| name | p/x | r | i | product | 1 | x | y | z |",
      "| real | p/r | https://r | idea | design | 2 | $9 | hold | 2026-02-02 |",
    ].join("\n");
    const result = readPortfolio(content);
    // Known limitation: the "name" row is swallowed as a header; "real" survives.
    expect(result.map((e) => e.name)).toEqual(["real"]);
  });
});

// ---------------------------------------------------------------------------
// Escaped-pipe GFM cell (`\|`): GFM defines `\|` as a literal pipe inside a
// cell. The naive split("|") does NOT honor the escape, so a repo URL or origin
// idea containing a pipe shifts all subsequent columns. This pins the CURRENT
// (lossy) behavior so the gap is visible and any future fix is a deliberate,
// test-driven change. See review findings (Important, non-blocking).
// ---------------------------------------------------------------------------

describe("frd-01 adversarial: readPortfolio — GFM escaped pipe in a cell is NOT honored (known gap)", () => {
  it("name and path are still correct even when a later cell contains an escaped pipe", () => {
    // The AC that matters (project name + path) survives; only the optional
    // columns after the pipe are corrupted. This documents that the core
    // contract (AC-01-004.1) holds even on this malformed input.
    const content = [
      H,
      S,
      "| pp | p/p | https://x?a=1\\|2 | idea | product | 1 | $5 | active | 2026-01-01 |",
    ].join("\n");
    const result = readPortfolio(content);
    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe("pp");
    expect(result[0]?.path).toBe("p/p");
    // Documented gap: repo is truncated at the unescaped pipe (column shift).
    // If/when escaped pipes are supported, this expectation should flip to the
    // full URL "https://x?a=1|2".
    expect(result[0]?.repo).toBe("https://x?a=1\\");
  });
});

// ---------------------------------------------------------------------------
// Abuse / injection: a cell carrying markup or path-traversal text is returned
// verbatim as data (read-only parser; no eval, no fs stat of the path).
// REQ-01-010: the path is preserved; not-found marking is pathExists()'s job.
// ---------------------------------------------------------------------------

describe("frd-01 adversarial: readPortfolio — untrusted cell content is returned verbatim (no eval, no traversal)", () => {
  it("returns a path-traversal-looking path string untouched and never throws", () => {
    const content = [
      H,
      S,
      "| evil | ../../etc/passwd | https://r | <script>alert(1)</script> | product | 1 | $5 | active | 2026-01-01 |",
    ].join("\n");
    let result: ReturnType<typeof readPortfolio> = [];
    expect(() => {
      result = readPortfolio(content);
    }).not.toThrow();
    expect(result[0]?.path).toBe("../../etc/passwd");
    // The script-looking origin idea is preserved as inert text (escaping is the
    // renderer's job; the data layer must not mangle or execute it).
    expect(result[0]?.originIdea).toBe("<script>alert(1)</script>");
  });
});

// ---------------------------------------------------------------------------
// Whitespace-only / placeholder name or path must drop the row (name+path are
// required). The implementer's suite covers "—"/"-"/""; here: a tab-only and a
// spaces-only cell — both must be treated as blank and the row dropped.
// ---------------------------------------------------------------------------

describe("frd-01 adversarial: readPortfolio — whitespace-only required cells drop the row", () => {
  it("drops a row whose Path cell is only spaces", () => {
    const content = [
      H,
      S,
      "| ws-path |       | https://r | idea | product | 1 | $5 | active | x |",
    ].join("\n");
    const result = readPortfolio(content);
    expect(result).toHaveLength(0);
  });

  it("drops a row whose Name cell is only whitespace", () => {
    const content = [H, S, "|    | p/x | https://r | idea | product | 1 | $5 | active | x |"].join(
      "\n",
    );
    const result = readPortfolio(content);
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Fail-soft on a directory path (readFileSync on a dir throws EISDIR) → [].
// The implementer tests a nonexistent file; a directory is a different errno.
// ---------------------------------------------------------------------------

describe("frd-01 adversarial: readPortfolio — directory path fails soft to []", () => {
  it("returns [] (not a throw) when the path is a directory", () => {
    // A path that exists but is a directory (the project root) — readFileSync → EISDIR.
    let result: ReturnType<typeof readPortfolio> = [{ name: "x", path: "y" }];
    expect(() => {
      result = readPortfolio("/tmp");
    }).not.toThrow();
    expect(result).toEqual([]);
  });
});
