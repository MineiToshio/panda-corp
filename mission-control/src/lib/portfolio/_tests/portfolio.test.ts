/**
 * WO-01-004 — `readPortfolio` acceptance tests (RED phase).
 *
 * These tests are written BEFORE the implementation (`lib/portfolio.ts` does not exist yet).
 * They will all fail until the GREEN phase; that is the intent.
 *
 * Traceability:
 *   AC-01-004.1  The system SHALL read `factory/portfolio.md` to obtain the list of
 *                projects and their paths.
 *   (FRD-03)     Each row also yields `repo`, business snapshot columns
 *                (users / returnMetric / verdict) and the phase cell.
 *   (Edge)       Missing/empty file → `[]` handled gracefully.
 *   (Edge)       Row with missing cells degrades fields to `undefined`, never throws.
 *   (Edge)       Row with a broken/nonexistent path still yields a `path` string
 *                (REQ-01-010: mark not-found elsewhere, never drop the row).
 *   (Edge)       Placeholder cells ("—", "", "-") → `undefined`.
 *
 * Regression anchors from .pandacorp/comms/progress.md (past incidents → regression tests):
 *   No bugs logged against readPortfolio yet.  The progress.md incidents are against
 *   other WOs (WO-13-001 NaN/array bypass, WO-01-001 fs-utils, WO-01-002 OnboardingGate,
 *   WO-01-003 IdeaCard); readPortfolio is new code.  Regressions added proactively for the
 *   known parser failure modes: header/separator row leakage, trailing-pipe columns,
 *   multi-word cell with surrounding whitespace, placeholder normalization.
 *
 * Fixture: `tests/fixtures/factory-full/factory/portfolio.md`
 * Three rows (from the committed fixture file):
 *   1. proj-a        — full row (all columns populated, repo present, non-placeholder users)
 *   2. proj-missing-repo — repo cell is "—" → repo: undefined
 *   3. proj-broken-path  — path "/nonexistent/…" → path string preserved, nothing throws
 *
 * Stack: Vitest. No mocks — the function is pure-ish: path-in → typed array out.
 * All I/O is real fs reads against fixture trees.
 */

import path from "node:path";
import { describe, expect, it } from "vitest";

import { FIXTURE_FRESH, FIXTURE_FULL, withFactoryRoot } from "../../../tests/fixtures";

// The module under test (does NOT exist yet — this is the RED phase).
import { readPortfolio } from "../portfolio";

// ---------------------------------------------------------------------------
// Type alias matching the contract in wo-01-004-read-portfolio.md and blueprint §2.
// Kept local to express exactly what the tests assert; the module will export it.
// ---------------------------------------------------------------------------

type PortfolioEntry = {
  name: string;
  path: string;
  repo?: string;
  originIdea?: string;
  phase?: string;
  users?: string;
  returnMetric?: string;
  verdict?: string;
  lastSync?: string;
};

// ---------------------------------------------------------------------------
// AC-01-004.1 — happy path: factory-full fixture returns all three rows
// ---------------------------------------------------------------------------

describe("frd-01: readPortfolio — AC-01-004.1 happy path (factory-full)", () => {
  it("frd-01: WHEN Pandacorp loads THEN readPortfolio returns exactly 7 project entries", async () => {
    await withFactoryRoot(FIXTURE_FULL, () => {
      const entries = readPortfolio() as PortfolioEntry[];
      expect(entries).toHaveLength(7);
    });
  });

  it("frd-01: WHEN readPortfolio runs THEN it does NOT throw", async () => {
    await withFactoryRoot(FIXTURE_FULL, () => {
      expect(() => readPortfolio()).not.toThrow();
    });
  });

  it("frd-01: WHEN readPortfolio runs THEN the result is an array", async () => {
    await withFactoryRoot(FIXTURE_FULL, () => {
      const entries = readPortfolio();
      expect(Array.isArray(entries)).toBe(true);
    });
  });

  it("frd-01: WHEN readPortfolio runs THEN no header or separator rows are included in the result", async () => {
    // The table has a header row ("Name | Path | …") and a separator row ("|---|…|");
    // neither should appear as an entry.
    await withFactoryRoot(FIXTURE_FULL, () => {
      const entries = readPortfolio() as PortfolioEntry[];
      for (const e of entries) {
        expect(e.name).not.toMatch(/^Name$/i);
        expect(e.name).not.toMatch(/^---/);
        expect(e.path).not.toMatch(/^---/);
      }
    });
  });

  it("frd-01: WHEN readPortfolio runs THEN all three project names are present", async () => {
    await withFactoryRoot(FIXTURE_FULL, () => {
      const entries = readPortfolio() as PortfolioEntry[];
      const names = entries.map((e) => e.name);
      expect(names).toContain("proj-a");
      expect(names).toContain("proj-missing-repo");
      expect(names).toContain("proj-broken-path");
    });
  });
});

// ---------------------------------------------------------------------------
// Per-entry field contract: proj-a — the "full row" case
// Fixture columns: proj-a | projects/proj-a | https://github.com/ada/proj-a |
//                  Mission Control factory dashboard | implementation | — | personal | active | 2026-06-15
// ---------------------------------------------------------------------------

describe("frd-01: readPortfolio — proj-a full row field contract", () => {
  it("frd-01: proj-a entry has name 'proj-a'", async () => {
    await withFactoryRoot(FIXTURE_FULL, () => {
      const entries = readPortfolio() as PortfolioEntry[];
      const entry = entries.find((e) => e.name === "proj-a");
      expect(entry).toBeDefined();
    });
  });

  it("frd-01: proj-a entry has path 'projects/proj-a'", async () => {
    await withFactoryRoot(FIXTURE_FULL, () => {
      const entries = readPortfolio() as PortfolioEntry[];
      const entry = entries.find((e) => e.name === "proj-a");
      expect(entry?.path).toBe("projects/proj-a");
    });
  });

  it("frd-01: proj-a entry has repo 'https://github.com/ada/proj-a'", async () => {
    await withFactoryRoot(FIXTURE_FULL, () => {
      const entries = readPortfolio() as PortfolioEntry[];
      const entry = entries.find((e) => e.name === "proj-a");
      expect(entry?.repo).toBe("https://github.com/ada/proj-a");
    });
  });

  it("frd-01: proj-a entry has originIdea 'Mission Control factory dashboard'", async () => {
    await withFactoryRoot(FIXTURE_FULL, () => {
      const entries = readPortfolio() as PortfolioEntry[];
      const entry = entries.find((e) => e.name === "proj-a");
      expect(entry?.originIdea).toBe("Mission Control factory dashboard");
    });
  });

  it("frd-01: proj-a entry has phase 'implementation'", async () => {
    await withFactoryRoot(FIXTURE_FULL, () => {
      const entries = readPortfolio() as PortfolioEntry[];
      const entry = entries.find((e) => e.name === "proj-a");
      expect(entry?.phase).toBe("implementation");
    });
  });

  it("frd-01: proj-a entry has users undefined (placeholder '—' normalized)", async () => {
    // Fixture row: users cell is "—" → must become undefined.
    await withFactoryRoot(FIXTURE_FULL, () => {
      const entries = readPortfolio() as PortfolioEntry[];
      const entry = entries.find((e) => e.name === "proj-a");
      expect(entry?.users).toBeUndefined();
    });
  });

  it("frd-01: proj-a entry has returnMetric 'personal'", async () => {
    await withFactoryRoot(FIXTURE_FULL, () => {
      const entries = readPortfolio() as PortfolioEntry[];
      const entry = entries.find((e) => e.name === "proj-a");
      expect(entry?.returnMetric).toBe("personal");
    });
  });

  it("frd-01: proj-a entry has verdict 'active'", async () => {
    await withFactoryRoot(FIXTURE_FULL, () => {
      const entries = readPortfolio() as PortfolioEntry[];
      const entry = entries.find((e) => e.name === "proj-a");
      expect(entry?.verdict).toBe("active");
    });
  });

  it("frd-01: proj-a entry has lastSync '2026-06-15'", async () => {
    await withFactoryRoot(FIXTURE_FULL, () => {
      const entries = readPortfolio() as PortfolioEntry[];
      const entry = entries.find((e) => e.name === "proj-a");
      expect(entry?.lastSync).toBe("2026-06-15");
    });
  });
});

// ---------------------------------------------------------------------------
// Per-entry field contract: proj-missing-repo — missing repo cell normalized
// Fixture columns: proj-missing-repo | projects/proj-missing-repo | — |
//                  Subscription analytics dashboard | product | 12 | $240 MRR | building | 2026-05-01
// ---------------------------------------------------------------------------

describe("frd-01: readPortfolio — proj-missing-repo: placeholder repo → undefined", () => {
  it("frd-01: proj-missing-repo entry has repo undefined (cell '—' normalized)", async () => {
    await withFactoryRoot(FIXTURE_FULL, () => {
      const entries = readPortfolio() as PortfolioEntry[];
      const entry = entries.find((e) => e.name === "proj-missing-repo");
      expect(entry?.repo).toBeUndefined();
    });
  });

  it("frd-01: proj-missing-repo entry has path 'projects/proj-missing-repo'", async () => {
    await withFactoryRoot(FIXTURE_FULL, () => {
      const entries = readPortfolio() as PortfolioEntry[];
      const entry = entries.find((e) => e.name === "proj-missing-repo");
      expect(entry?.path).toBe("projects/proj-missing-repo");
    });
  });

  it("frd-01: proj-missing-repo entry has phase 'product'", async () => {
    await withFactoryRoot(FIXTURE_FULL, () => {
      const entries = readPortfolio() as PortfolioEntry[];
      const entry = entries.find((e) => e.name === "proj-missing-repo");
      expect(entry?.phase).toBe("product");
    });
  });

  it("frd-01: proj-missing-repo entry has users '12' (string, not number)", async () => {
    // The type is `string | undefined`: table cells are raw strings.
    await withFactoryRoot(FIXTURE_FULL, () => {
      const entries = readPortfolio() as PortfolioEntry[];
      const entry = entries.find((e) => e.name === "proj-missing-repo");
      expect(entry?.users).toBe("12");
    });
  });

  it("frd-01: proj-missing-repo entry has returnMetric '$240 MRR'", async () => {
    await withFactoryRoot(FIXTURE_FULL, () => {
      const entries = readPortfolio() as PortfolioEntry[];
      const entry = entries.find((e) => e.name === "proj-missing-repo");
      expect(entry?.returnMetric).toBe("$240 MRR");
    });
  });

  it("frd-01: proj-missing-repo entry has originIdea 'Subscription analytics dashboard'", async () => {
    await withFactoryRoot(FIXTURE_FULL, () => {
      const entries = readPortfolio() as PortfolioEntry[];
      const entry = entries.find((e) => e.name === "proj-missing-repo");
      expect(entry?.originIdea).toBe("Subscription analytics dashboard");
    });
  });
});

// ---------------------------------------------------------------------------
// Per-entry field contract: proj-broken-path — broken path still yields path string
// Fixture columns: proj-broken-path | /nonexistent/path/does/not/exist |
//                  https://github.com/ada/broken | CLI scaffolding tool | shipped | 340 | OSS stars | shipped | 2026-04-10
// REQ-01-010: path must be preserved as-is; the "not found" marking is done by pathExists()
// downstream, not by the parser.
// ---------------------------------------------------------------------------

describe("frd-01: readPortfolio — proj-broken-path: nonexistent path preserved as a string", () => {
  it("frd-01: proj-broken-path entry is present (nonexistent path does NOT drop the row)", async () => {
    await withFactoryRoot(FIXTURE_FULL, () => {
      const entries = readPortfolio() as PortfolioEntry[];
      const entry = entries.find((e) => e.name === "proj-broken-path");
      expect(entry).toBeDefined();
    });
  });

  it("frd-01: proj-broken-path entry has the raw path string preserved verbatim", async () => {
    // REQ-01-010: readPortfolio must NOT validate path existence — it returns the raw string.
    // The pathExists() call that marks it as not-found is the caller's job.
    await withFactoryRoot(FIXTURE_FULL, () => {
      const entries = readPortfolio() as PortfolioEntry[];
      const entry = entries.find((e) => e.name === "proj-broken-path");
      expect(entry?.path).toBe("/nonexistent/path/does/not/exist");
    });
  });

  it("frd-01: proj-broken-path entry has repo 'https://github.com/ada/broken'", async () => {
    await withFactoryRoot(FIXTURE_FULL, () => {
      const entries = readPortfolio() as PortfolioEntry[];
      const entry = entries.find((e) => e.name === "proj-broken-path");
      expect(entry?.repo).toBe("https://github.com/ada/broken");
    });
  });

  it("frd-01: proj-broken-path entry does NOT throw when its path does not exist on disk", async () => {
    // The parser is read-only over the portfolio.md file; it never stats the project paths.
    await withFactoryRoot(FIXTURE_FULL, () => {
      expect(() => readPortfolio()).not.toThrow();
    });
  });

  it("frd-01: proj-broken-path entry has phase 'shipped'", async () => {
    await withFactoryRoot(FIXTURE_FULL, () => {
      const entries = readPortfolio() as PortfolioEntry[];
      const entry = entries.find((e) => e.name === "proj-broken-path");
      expect(entry?.phase).toBe("shipped");
    });
  });

  it("frd-01: proj-broken-path entry has users '340'", async () => {
    await withFactoryRoot(FIXTURE_FULL, () => {
      const entries = readPortfolio() as PortfolioEntry[];
      const entry = entries.find((e) => e.name === "proj-broken-path");
      expect(entry?.users).toBe("340");
    });
  });
});

// ---------------------------------------------------------------------------
// Placeholder normalization: "—", "-", "" all → undefined
// Covers every optional field; tests use the fixture cells + edge-case inputs.
// ---------------------------------------------------------------------------

describe("frd-01: readPortfolio — placeholder cell normalization to undefined", () => {
  it("frd-01: WHEN repo cell is '—' (em dash) THEN repo is undefined", async () => {
    // proj-missing-repo has "—" in the Repo column.
    await withFactoryRoot(FIXTURE_FULL, () => {
      const entries = readPortfolio() as PortfolioEntry[];
      const entry = entries.find((e) => e.name === "proj-missing-repo");
      expect(entry?.repo).toBeUndefined();
    });
  });

  it("frd-01: WHEN users cell is '—' (em dash) THEN users is undefined", async () => {
    // proj-a has "—" in the Users column.
    await withFactoryRoot(FIXTURE_FULL, () => {
      const entries = readPortfolio() as PortfolioEntry[];
      const entry = entries.find((e) => e.name === "proj-a");
      expect(entry?.users).toBeUndefined();
    });
  });

  it("frd-01: WHEN readPortfolio is called with a file using '-' placeholders THEN those cells become undefined", () => {
    // Inline fixture to test the "-" variant without mutating the committed fixtures.
    const tmpContent = [
      "# Portfolio",
      "",
      "| Name | Path | Repo | Origin idea | Phase | Users | Return metric | Verdict | Last sync |",
      "|---|---|---|---|---|---|---|---|---|",
      "| my-proj | my/path | - | - | - | - | - | - | - |",
    ].join("\n");

    const result = readPortfolio(tmpContent) as PortfolioEntry[];
    expect(result).toHaveLength(1);
    const entry = result[0];
    expect(entry?.repo).toBeUndefined();
    expect(entry?.originIdea).toBeUndefined();
    expect(entry?.phase).toBeUndefined();
    expect(entry?.users).toBeUndefined();
    expect(entry?.returnMetric).toBeUndefined();
    expect(entry?.verdict).toBeUndefined();
    expect(entry?.lastSync).toBeUndefined();
  });

  it("frd-01: WHEN readPortfolio is called with a file using empty-string placeholders THEN those cells become undefined", () => {
    // Empty cell (two consecutive pipes "||" after trim).
    const tmpContent = [
      "# Portfolio",
      "",
      "| Name | Path | Repo | Origin idea | Phase | Users | Return metric | Verdict | Last sync |",
      "|---|---|---|---|---|---|---|---|---|",
      "| empty-proj | some/path |  |  |  |  |  |  |  |",
    ].join("\n");

    const result = readPortfolio(tmpContent) as PortfolioEntry[];
    expect(result).toHaveLength(1);
    const entry = result[0];
    expect(entry?.repo).toBeUndefined();
    expect(entry?.originIdea).toBeUndefined();
    expect(entry?.phase).toBeUndefined();
    expect(entry?.users).toBeUndefined();
    expect(entry?.returnMetric).toBeUndefined();
    expect(entry?.verdict).toBeUndefined();
    expect(entry?.lastSync).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Edge case: missing / empty file → []
// blueprint §3 tolerance: "Missing/empty file → []".
// ---------------------------------------------------------------------------

describe("frd-01: readPortfolio — edge case: missing file → []", () => {
  it("frd-01: WHEN the portfolio file does not exist THEN readPortfolio returns []", () => {
    const result = readPortfolio("/nonexistent/factory/portfolio.md");
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
  });

  it("frd-01: WHEN the portfolio file does not exist THEN readPortfolio does NOT throw", () => {
    expect(() => readPortfolio("/nonexistent/factory/portfolio.md")).not.toThrow();
  });

  it("frd-01: WHEN the portfolio file is empty THEN readPortfolio returns []", () => {
    // Pass an empty string as the raw content override.
    const result = readPortfolio("") as PortfolioEntry[];
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
  });

  it("frd-01: WHEN the portfolio file has no table (prose only) THEN readPortfolio returns []", () => {
    const noTable = "# Portfolio\n\nNo table here, just prose.\n";
    const result = readPortfolio(noTable) as PortfolioEntry[];
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Edge case: row with fewer cells than the header does not throw; missing
// fields degrade to undefined.
// blueprint §3: "a row with missing cells degrades fields to `undefined`, never throws".
// ---------------------------------------------------------------------------

describe("frd-01: readPortfolio — edge case: row with missing cells degrades gracefully", () => {
  it("frd-01: WHEN a row has fewer cells than the header THEN readPortfolio does NOT throw", () => {
    const shortRow = [
      "| Name | Path | Repo | Origin idea | Phase | Users | Return metric | Verdict | Last sync |",
      "|---|---|---|---|---|---|---|---|---|",
      "| short-proj | some/path |",
    ].join("\n");

    expect(() => readPortfolio(shortRow)).not.toThrow();
  });

  it("frd-01: WHEN a row has fewer cells than the header THEN name and path are still populated", () => {
    const shortRow = [
      "| Name | Path | Repo | Origin idea | Phase | Users | Return metric | Verdict | Last sync |",
      "|---|---|---|---|---|---|---|---|---|",
      "| short-proj | some/path |",
    ].join("\n");

    const result = readPortfolio(shortRow) as PortfolioEntry[];
    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe("short-proj");
    expect(result[0]?.path).toBe("some/path");
  });

  it("frd-01: WHEN a row has fewer cells than the header THEN missing optional fields are undefined", () => {
    const shortRow = [
      "| Name | Path | Repo | Origin idea | Phase | Users | Return metric | Verdict | Last sync |",
      "|---|---|---|---|---|---|---|---|---|",
      "| short-proj | some/path |",
    ].join("\n");

    const result = readPortfolio(shortRow) as PortfolioEntry[];
    const entry = result[0];
    expect(entry?.repo).toBeUndefined();
    expect(entry?.originIdea).toBeUndefined();
    expect(entry?.phase).toBeUndefined();
    expect(entry?.users).toBeUndefined();
    expect(entry?.returnMetric).toBeUndefined();
    expect(entry?.verdict).toBeUndefined();
    expect(entry?.lastSync).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Prose outside the table is ignored: the function skips non-table lines.
// ---------------------------------------------------------------------------

describe("frd-01: readPortfolio — non-table prose is ignored", () => {
  it("frd-01: WHEN portfolio.md contains prose before and after the table THEN only table rows are returned", () => {
    const mixed = [
      "# Portfolio",
      "",
      "Index of Pandacorp projects.",
      "",
      "## Projects",
      "",
      "| Name | Path | Repo | Origin idea | Phase | Users | Return metric | Verdict | Last sync |",
      "|---|---|---|---|---|---|---|---|---|",
      "| my-proj | my/path | https://repo.example | idea-1 | product | — | — | — | 2026-01-01 |",
      "",
      "> This is a footnote in prose.",
    ].join("\n");

    const result = readPortfolio(mixed) as PortfolioEntry[];
    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe("my-proj");
  });

  it("frd-01: WHEN portfolio.md has multiple tables THEN only data rows from all tables are returned", () => {
    // Not a likely case in practice but the parser should not silently merge headers.
    const multiTable = [
      "| Name | Path | Repo | Origin idea | Phase | Users | Return metric | Verdict | Last sync |",
      "|---|---|---|---|---|---|---|---|---|",
      "| proj-1 | p1 | — | — | product | — | — | — | — |",
      "",
      "| Name | Path | Repo | Origin idea | Phase | Users | Return metric | Verdict | Last sync |",
      "|---|---|---|---|---|---|---|---|---|",
      "| proj-2 | p2 | — | — | design | — | — | — | — |",
    ].join("\n");

    const result = readPortfolio(multiTable) as PortfolioEntry[];
    // Exactly the two data rows; no header rows.
    expect(result).toHaveLength(2);
    const names = result.map((e) => e.name);
    expect(names).toContain("proj-1");
    expect(names).toContain("proj-2");
    expect(names).not.toContain("Name");
  });
});

// ---------------------------------------------------------------------------
// Explicit portfolioPath argument overrides the config.PORTFOLIO default.
// Contract: readPortfolio(portfolioPathOrContent?: string) — defaults to config.PORTFOLIO.
// (The function may accept either a file path or raw markdown content; the WO contract
//  says `portfolioPath?: string` defaults to `config.PORTFOLIO`.)
// ---------------------------------------------------------------------------

describe("frd-01: readPortfolio — explicit portfolioPath argument", () => {
  it("frd-01: WHEN readPortfolio is called with an explicit path THEN it reads from that path, not the default", () => {
    const explicitPath = path.join(FIXTURE_FULL, "factory", "portfolio.md");
    const result = readPortfolio(explicitPath) as PortfolioEntry[];
    expect(result).toHaveLength(7);
  });

  it("frd-01: WHEN readPortfolio is called with an explicit path THEN the entry names match the fixture", () => {
    const explicitPath = path.join(FIXTURE_FULL, "factory", "portfolio.md");
    const result = readPortfolio(explicitPath) as PortfolioEntry[];
    const names = result.map((e) => e.name);
    expect(names).toContain("proj-a");
    expect(names).toContain("proj-missing-repo");
    expect(names).toContain("proj-broken-path");
  });
});

// ---------------------------------------------------------------------------
// env-based default path resolution via withFactoryRoot
// The function uses config.PORTFOLIO when called without arguments; config.PORTFOLIO
// derives from FACTORY_ROOT which is driven by PANDACORP_FACTORY_ROOT.
// ---------------------------------------------------------------------------

describe("frd-01: readPortfolio — env-based default path (config.PORTFOLIO)", () => {
  it("frd-01: WHEN PANDACORP_FACTORY_ROOT points to FIXTURE_FULL THEN readPortfolio() (no arg) returns 7 entries", async () => {
    await withFactoryRoot(FIXTURE_FULL, () => {
      const result = readPortfolio() as PortfolioEntry[];
      expect(result).toHaveLength(7);
    });
  });

  it("frd-01: WHEN PANDACORP_FACTORY_ROOT points to FIXTURE_FRESH THEN readPortfolio() returns [] (no portfolio.md in fresh)", async () => {
    // FIXTURE_FRESH has no portfolio.md → missing file → [].
    await withFactoryRoot(FIXTURE_FRESH, () => {
      const result = readPortfolio();
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    });
  });
});

// ---------------------------------------------------------------------------
// Column order tolerance: header is parsed by name, not by position.
// If a future portfolio.md reorders columns, the mapping must still be correct.
// (Proactive regression for the "column shift" class of parser bugs.)
// ---------------------------------------------------------------------------

describe("frd-01: readPortfolio — column mapping is name-based, not position-based", () => {
  it("frd-01: WHEN column order is swapped THEN fields are still mapped to the correct TypeScript keys", () => {
    // Minimal reorder: Phase comes before Repo.
    const swapped = [
      "| Name | Path | Phase | Repo | Origin idea | Users | Return metric | Verdict | Last sync |",
      "|---|---|---|---|---|---|---|---|---|",
      "| col-test | t/path | design | https://repo | my-idea | 99 | big bucks | building | 2026-01-01 |",
    ].join("\n");

    const result = readPortfolio(swapped) as PortfolioEntry[];
    expect(result).toHaveLength(1);
    const entry = result[0];
    expect(entry?.phase).toBe("design");
    expect(entry?.repo).toBe("https://repo");
    expect(entry?.users).toBe("99");
  });
});

// ---------------------------------------------------------------------------
// Cell whitespace trimming: leading and trailing spaces inside cells must be stripped.
// Regression for the "extra space causes mismatch" parser bug class.
// ---------------------------------------------------------------------------

describe("frd-01: readPortfolio — cell whitespace is trimmed", () => {
  it("frd-01: WHEN cells contain leading/trailing whitespace THEN the trimmed value is returned", () => {
    const padded = [
      "| Name | Path | Repo | Origin idea | Phase | Users | Return metric | Verdict | Last sync |",
      "|---|---|---|---|---|---|---|---|---|",
      "|  padded-proj  |  some/path  |  https://repo  |  an idea  |  product  |  5  |  $10  |  active  |  2026-06-01  |",
    ].join("\n");

    const result = readPortfolio(padded) as PortfolioEntry[];
    expect(result).toHaveLength(1);
    const entry = result[0];
    expect(entry?.name).toBe("padded-proj");
    expect(entry?.path).toBe("some/path");
    expect(entry?.repo).toBe("https://repo");
    expect(entry?.originIdea).toBe("an idea");
    expect(entry?.phase).toBe("product");
    expect(entry?.users).toBe("5");
    expect(entry?.returnMetric).toBe("$10");
    expect(entry?.verdict).toBe("active");
    expect(entry?.lastSync).toBe("2026-06-01");
  });
});

// ---------------------------------------------------------------------------
// Read-only invariant: readPortfolio MUST NOT write to disk (FRD-01 REQ-01-011).
// The function signature takes only an optional path; the return type is the only output.
// ---------------------------------------------------------------------------

describe("frd-01: readPortfolio — read-only invariant (REQ-01-011)", () => {
  it("frd-01: readPortfolio returns an array (never undefined or null)", async () => {
    await withFactoryRoot(FIXTURE_FULL, () => {
      const result = readPortfolio();
      expect(result).not.toBeNull();
      expect(result).not.toBeUndefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// Idempotency: calling readPortfolio twice returns the same result.
// Proves no hidden mutable state; catches fs caching issues.
// ---------------------------------------------------------------------------

describe("frd-01: readPortfolio — idempotency", () => {
  it("frd-01: WHEN readPortfolio is called twice THEN both calls return entries with the same names in the same order", async () => {
    await withFactoryRoot(FIXTURE_FULL, () => {
      const first = (readPortfolio() as PortfolioEntry[]).map((e) => e.name);
      const second = (readPortfolio() as PortfolioEntry[]).map((e) => e.name);
      expect(first).toEqual(second);
    });
  });
});

// ---------------------------------------------------------------------------
// Every returned entry has the required non-optional fields: name and path.
// These are the minimum to build the rest of the view (FRD-03 project rail).
// ---------------------------------------------------------------------------

describe("frd-01: readPortfolio — required field invariant: name and path always present", () => {
  it("frd-01: every returned entry has name as a non-empty string", async () => {
    await withFactoryRoot(FIXTURE_FULL, () => {
      const entries = readPortfolio() as PortfolioEntry[];
      for (const entry of entries) {
        expect(typeof entry.name).toBe("string");
        expect(entry.name.length).toBeGreaterThan(0);
      }
    });
  });

  it("frd-01: every returned entry has path as a non-empty string", async () => {
    await withFactoryRoot(FIXTURE_FULL, () => {
      const entries = readPortfolio() as PortfolioEntry[];
      for (const entry of entries) {
        expect(typeof entry.path).toBe("string");
        expect(entry.path.length).toBeGreaterThan(0);
      }
    });
  });
});

// ---------------------------------------------------------------------------
// Regression: the REAL portfolio.md is gitignored → Spanish (DR-009). The parser
// must recognize Spanish headers AND clean a backticked/prose path cell, or
// readPortfolio() returns [] and Portfolio / Workspace / Party all go dark.
// ---------------------------------------------------------------------------

describe("Spanish-header portfolio (real-file shape, DR-009)", () => {
  const SPANISH = [
    "# Portfolio Pandacorp",
    "",
    "| Proyecto | Ruta | Repo | Idea origen | Fase | Usuarios | Retorno | Veredicto | Última sync |",
    "|---|---|---|---|---|---|---|---|---|",
    "| Pandacorp (Mission Control) | `mission-control/` (dentro de la fábrica — es su interfaz) | — | conversación de diseño | arquitectura | — | — (herramienta interna) | — | 2026-06-13 |",
    "| Quick Notes | `~/Proyectos/quick-notes` | https://github.com/x/y | idea-origin | lanzada | 1.2k | $340/mes | double-down | 2026-06-09 |",
    "",
  ].join("\n");

  /** Parse SPANISH and narrow the two expected rows (strict `noUncheckedIndexedAccess`). */
  function parseTwo(): { mc: PortfolioEntry; qn: PortfolioEntry } {
    const [mc, qn] = readPortfolio(SPANISH) as PortfolioEntry[];
    if (!mc || !qn) throw new Error("expected two Spanish portfolio entries");
    return { mc, qn };
  }

  it("recognizes the Spanish header row and returns every project (not [])", () => {
    const entries = readPortfolio(SPANISH) as PortfolioEntry[];
    expect(entries).toHaveLength(2);
    expect(entries.map((e) => e.name)).toEqual(["Pandacorp (Mission Control)", "Quick Notes"]);
  });

  it("cleans a backticked path cell with trailing prose to the bare path", () => {
    expect(parseTwo().mc.path).toBe("mission-control");
  });

  it("maps the Spanish business columns (Usuarios/Retorno/Veredicto/Última sync)", () => {
    const { qn } = parseTwo();
    expect(qn.path).toBe("~/Proyectos/quick-notes");
    expect(qn.phase).toBe("lanzada");
    expect(qn.users).toBe("1.2k");
    expect(qn.returnMetric).toBe("$340/mes");
    expect(qn.verdict).toBe("double-down");
    expect(qn.lastSync).toBe("2026-06-09");
    expect(qn.repo).toBe("https://github.com/x/y");
  });

  it("normalizes the em-dash placeholder cells to undefined", () => {
    const { mc } = parseTwo();
    expect(mc.repo).toBeUndefined();
    expect(mc.verdict).toBeUndefined();
    expect(mc.originIdea).toBe("conversación de diseño");
  });
});
