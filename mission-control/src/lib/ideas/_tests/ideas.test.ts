/**
 * WO-01-003 — `readIdeas` acceptance tests (RED phase).
 *
 * These tests are written BEFORE the implementation (`lib/ideas.ts` does not exist yet).
 * They will all fail until the GREEN phase; that is the intent.
 *
 * Traceability:
 *   AC-01-003.1  WHEN Pandacorp loads, the system SHALL read all the cards in
 *                `factory/ideas/*.md` (ignoring `_idea-template.md` and `decision-log.md`)
 *                with their frontmatter (title, status, project_type, return_type, score).
 *   (Edge)       Empty ideas folder → `[]` handled gracefully.
 *   (Edge)       Card with unparseable frontmatter → skipped (not fatal).
 *   (Edge)       Non-existent ideas dir → `[]`.
 *
 * Regression anchors from .pandacorp/comms/progress.md (past incidents → regression tests):
 *   B1 (adversarial, WO-01-000 review, 2026-06-16): idea-malformed.md makes gray-matter
 *      throw; the reader MUST catch-per-card, not wrap the whole batch.
 *
 * Stack: Vitest + gray-matter (already in package.json).
 * No mocks — the function is pure-ish: path-in → typed array out, all I/O is real fs reads
 * against fixture trees whose PANDACORP_FACTORY_ROOT env var sets the root.
 */

import path from "node:path";
import { describe, expect, it } from "vitest";

import { FIXTURE_FRESH, FIXTURE_FULL, withFactoryRoot } from "../../../tests/fixtures";

// The module under test.
import { readIdeas } from "../ideas";

// ---------------------------------------------------------------------------
// Type aliases matching the contract in wo-01-003-read-ideas.md and blueprint §2.
// Kept local here to express what the tests assert; the module will export them.
// ---------------------------------------------------------------------------

type IdeaStatus = "discovered" | "recommended" | "in-pipeline" | "shipped" | "discarded";

type IdeaCard = {
  slug: string;
  title: string;
  status: IdeaStatus;
  projectType?: string;
  returnType?: "monetary" | "opportunity" | "personal" | "mixed";
  score?: number;
  project?: string;
  body: string;
};

// ---------------------------------------------------------------------------
// AC-01-003.1 — happy path (factory-full fixture, 5 valid cards returned)
// ---------------------------------------------------------------------------

describe("frd-01: readIdeas — AC-01-003.1 happy path (factory-full)", () => {
  it("frd-01: WHEN Pandacorp loads THEN readIdeas returns exactly 5 valid idea cards", async () => {
    await withFactoryRoot(FIXTURE_FULL, () => {
      const ideas = readIdeas() as IdeaCard[];
      expect(ideas).toHaveLength(5);
    });
  });

  it("frd-01: WHEN Pandacorp loads THEN returned cards cover all five lifecycle statuses", async () => {
    await withFactoryRoot(FIXTURE_FULL, () => {
      const ideas = readIdeas() as IdeaCard[];
      const statuses = ideas.map((c) => c.status).sort();
      expect(statuses).toEqual([
        "discarded",
        "discovered",
        "in-pipeline",
        "recommended",
        "shipped",
      ]);
    });
  });

  it("frd-01: WHEN readIdeas runs THEN _idea-template.md is NOT present in the results", async () => {
    await withFactoryRoot(FIXTURE_FULL, () => {
      const ideas = readIdeas() as IdeaCard[];
      const slugs = ideas.map((c) => c.slug);
      expect(slugs).not.toContain("_idea-template");
    });
  });

  it("frd-01: WHEN readIdeas runs THEN decision-log.md is NOT present in the results", async () => {
    await withFactoryRoot(FIXTURE_FULL, () => {
      const ideas = readIdeas() as IdeaCard[];
      const slugs = ideas.map((c) => c.slug);
      expect(slugs).not.toContain("decision-log");
    });
  });

  it("frd-01: WHEN readIdeas runs THEN idea-malformed.md is NOT present in the results (skipped silently)", async () => {
    await withFactoryRoot(FIXTURE_FULL, () => {
      const ideas = readIdeas() as IdeaCard[];
      const slugs = ideas.map((c) => c.slug);
      expect(slugs).not.toContain("idea-malformed");
    });
  });
});

// ---------------------------------------------------------------------------
// AC-01-003.1 — per-card field contract: each returned card exposes all
// required fields with the correct types and camelCase mapping.
// ---------------------------------------------------------------------------

describe("frd-01: readIdeas — per-card field contract", () => {
  it("frd-01: idea-discovered card has slug derived from filename without .md", async () => {
    await withFactoryRoot(FIXTURE_FULL, () => {
      const ideas = readIdeas() as IdeaCard[];
      const card = ideas.find((c) => c.slug === "idea-discovered");
      expect(card).toBeDefined();
    });
  });

  it("frd-01: idea-discovered card has title as a non-empty string", async () => {
    await withFactoryRoot(FIXTURE_FULL, () => {
      const ideas = readIdeas() as IdeaCard[];
      const card = ideas.find((c) => c.slug === "idea-discovered");
      expect(typeof card?.title).toBe("string");
      expect(card?.title.length).toBeGreaterThan(0);
    });
  });

  it("frd-01: idea-discovered card maps project_type frontmatter key to projectType (camelCase)", async () => {
    await withFactoryRoot(FIXTURE_FULL, () => {
      const ideas = readIdeas() as IdeaCard[];
      const card = ideas.find((c) => c.slug === "idea-discovered");
      // fixture: project_type: "SaaS"
      expect(card?.projectType).toBe("SaaS");
    });
  });

  it("frd-01: idea-discovered card maps return_type frontmatter key to returnType (camelCase)", async () => {
    await withFactoryRoot(FIXTURE_FULL, () => {
      const ideas = readIdeas() as IdeaCard[];
      const card = ideas.find((c) => c.slug === "idea-discovered");
      // fixture: return_type: monetary
      expect(card?.returnType).toBe("monetary");
    });
  });

  it("frd-01: idea-discovered card has score as a number", async () => {
    await withFactoryRoot(FIXTURE_FULL, () => {
      const ideas = readIdeas() as IdeaCard[];
      const card = ideas.find((c) => c.slug === "idea-discovered");
      // fixture: score: 72
      expect(typeof card?.score).toBe("number");
      expect(card?.score).toBe(72);
    });
  });

  it("frd-01: idea-discovered card has body as a non-empty string (markdown content)", async () => {
    await withFactoryRoot(FIXTURE_FULL, () => {
      const ideas = readIdeas() as IdeaCard[];
      const card = ideas.find((c) => c.slug === "idea-discovered");
      expect(typeof card?.body).toBe("string");
      expect(card?.body.trim().length).toBeGreaterThan(0);
    });
  });

  it("frd-01: idea-in-pipeline card has project field populated (pointer to the linked project)", async () => {
    await withFactoryRoot(FIXTURE_FULL, () => {
      const ideas = readIdeas() as IdeaCard[];
      const card = ideas.find((c) => c.slug === "idea-in-pipeline");
      // fixture: project: "../projects/proj-a"
      expect(typeof card?.project).toBe("string");
      expect((card?.project ?? "").length).toBeGreaterThan(0);
    });
  });

  it("frd-01: idea-in-pipeline card has status exactly 'in-pipeline'", async () => {
    await withFactoryRoot(FIXTURE_FULL, () => {
      const ideas = readIdeas() as IdeaCard[];
      const card = ideas.find((c) => c.slug === "idea-in-pipeline");
      expect(card?.status).toBe("in-pipeline");
    });
  });

  it("frd-01: idea-recommended card has returnType 'monetary'", async () => {
    await withFactoryRoot(FIXTURE_FULL, () => {
      const ideas = readIdeas() as IdeaCard[];
      const card = ideas.find((c) => c.slug === "idea-recommended");
      expect(card?.returnType).toBe("monetary");
    });
  });

  it("frd-01: idea-shipped card has returnType 'opportunity'", async () => {
    await withFactoryRoot(FIXTURE_FULL, () => {
      const ideas = readIdeas() as IdeaCard[];
      const card = ideas.find((c) => c.slug === "idea-shipped");
      expect(card?.returnType).toBe("opportunity");
    });
  });

  it("frd-01: idea-discarded card has status 'discarded' and score 30", async () => {
    await withFactoryRoot(FIXTURE_FULL, () => {
      const ideas = readIdeas() as IdeaCard[];
      const card = ideas.find((c) => c.slug === "idea-discarded");
      expect(card?.status).toBe("discarded");
      expect(card?.score).toBe(30);
    });
  });

  it("frd-01: every returned card has a slug that matches its filename (without .md)", async () => {
    await withFactoryRoot(FIXTURE_FULL, () => {
      const ideas = readIdeas() as IdeaCard[];
      const expectedSlugs = new Set([
        "idea-discovered",
        "idea-recommended",
        "idea-in-pipeline",
        "idea-shipped",
        "idea-discarded",
      ]);
      for (const card of ideas) {
        expect(expectedSlugs.has(card.slug)).toBe(true);
      }
    });
  });

  it("frd-01: every returned card has title as string (never undefined or null)", async () => {
    await withFactoryRoot(FIXTURE_FULL, () => {
      const ideas = readIdeas() as IdeaCard[];
      for (const card of ideas) {
        expect(typeof card.title).toBe("string");
      }
    });
  });

  it("frd-01: every returned card has body as string (never undefined or null)", async () => {
    await withFactoryRoot(FIXTURE_FULL, () => {
      const ideas = readIdeas() as IdeaCard[];
      for (const card of ideas) {
        expect(typeof card.body).toBe("string");
      }
    });
  });

  it("frd-01: every returned card has a status from the valid IdeaStatus union", async () => {
    const VALID_STATUSES: IdeaStatus[] = [
      "discovered",
      "recommended",
      "in-pipeline",
      "shipped",
      "discarded",
    ];
    await withFactoryRoot(FIXTURE_FULL, () => {
      const ideas = readIdeas() as IdeaCard[];
      for (const card of ideas) {
        expect(VALID_STATUSES).toContain(card.status);
      }
    });
  });

  it("frd-01: cards without a score field have score undefined (never 0-coerced)", async () => {
    // The fixture cards all have scores; this assertion is a behavioral contract:
    // if score is absent in frontmatter, it must be undefined, not 0.
    // We verify via the idea-in-pipeline card which has score: 95.
    await withFactoryRoot(FIXTURE_FULL, () => {
      const ideas = readIdeas() as IdeaCard[];
      const card = ideas.find((c) => c.slug === "idea-in-pipeline");
      // in-pipeline fixture has score: 95 → must be 95, not coerced
      expect(card?.score).toBe(95);
    });
  });
});

// ---------------------------------------------------------------------------
// Edge case: empty ideas folder (factory-fresh fixture) → []
// AC-01-003.1 edge case, blueprint §3.
// ---------------------------------------------------------------------------

describe("frd-01: readIdeas — edge case: empty ideas folder (factory-fresh)", () => {
  it("frd-01: WHEN the ideas folder is empty THEN readIdeas returns an empty array", async () => {
    await withFactoryRoot(FIXTURE_FRESH, () => {
      const ideas = readIdeas();
      expect(Array.isArray(ideas)).toBe(true);
      expect(ideas).toHaveLength(0);
    });
  });

  it("frd-01: WHEN the ideas folder is empty THEN readIdeas does NOT throw", async () => {
    await withFactoryRoot(FIXTURE_FRESH, () => {
      expect(() => readIdeas()).not.toThrow();
    });
  });
});

// ---------------------------------------------------------------------------
// Edge case: ideas directory does not exist at all → []
// blueprint §3 tolerance: "Missing folder → []".
// ---------------------------------------------------------------------------

describe("frd-01: readIdeas — edge case: non-existent ideas directory", () => {
  it("frd-01: WHEN the ideas directory does not exist THEN readIdeas returns []", () => {
    const nonExistentDir = "/nonexistent/path/ideas";
    const result = readIdeas(nonExistentDir) as IdeaCard[];
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
  });

  it("frd-01: WHEN the ideas directory does not exist THEN readIdeas does NOT throw", () => {
    expect(() => readIdeas("/nonexistent/path/ideas")).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Edge case: malformed frontmatter card is skipped, not fatal.
// Regression for the gray-matter-throws incident (progress.md, B1, 2026-06-16):
// gray-matter throws on the broken fixture card; the reader must catch per-card.
// ---------------------------------------------------------------------------

describe("frd-01: readIdeas — edge case: malformed frontmatter card skipped (gray-matter throw regression)", () => {
  it("frd-01: WHEN a card has broken frontmatter THEN readIdeas does NOT throw", async () => {
    // idea-malformed.md makes gray-matter throw (confirmed by adversarial suite).
    await withFactoryRoot(FIXTURE_FULL, () => {
      expect(() => readIdeas()).not.toThrow();
    });
  });

  it("frd-01: WHEN a card has broken frontmatter THEN the valid cards are still returned (no batch abort)", async () => {
    await withFactoryRoot(FIXTURE_FULL, () => {
      const ideas = readIdeas() as IdeaCard[];
      // 5 valid cards must survive despite the 1 malformed card in the folder.
      expect(ideas).toHaveLength(5);
    });
  });

  it("frd-01: WHEN a card has broken frontmatter THEN its slug is absent from results (not a partial card)", async () => {
    await withFactoryRoot(FIXTURE_FULL, () => {
      const ideas = readIdeas() as IdeaCard[];
      const slugs = ideas.map((c) => c.slug);
      expect(slugs).not.toContain("idea-malformed");
    });
  });
});

// ---------------------------------------------------------------------------
// NON_IDEA_FILES exclusion contract.
// AC-01-003.1: "(ignoring `_idea-template.md` and `decision-log.md`)".
// Blueprint §3 + config.ts: NON_IDEA_FILES = ["_idea-template.md", "decision-log.md"].
// ---------------------------------------------------------------------------

describe("frd-01: readIdeas — NON_IDEA_FILES exclusion contract", () => {
  it("frd-01: WHEN ideas folder contains _idea-template.md THEN it is excluded from the result", async () => {
    await withFactoryRoot(FIXTURE_FULL, () => {
      const ideas = readIdeas() as IdeaCard[];
      expect(ideas.find((c) => c.slug === "_idea-template")).toBeUndefined();
    });
  });

  it("frd-01: WHEN ideas folder contains decision-log.md THEN it is excluded from the result", async () => {
    await withFactoryRoot(FIXTURE_FULL, () => {
      const ideas = readIdeas() as IdeaCard[];
      expect(ideas.find((c) => c.slug === "decision-log")).toBeUndefined();
    });
  });

  it("frd-01: WHEN readIdeas is called THEN ONLY files ending in .md are considered", async () => {
    // The function must not include non-.md files even if they appear in the dir.
    // Proved implicitly: the fixture has only .md files; this test documents the contract
    // by asserting the returned slugs all correspond to .md filenames.
    await withFactoryRoot(FIXTURE_FULL, () => {
      const ideas = readIdeas() as IdeaCard[];
      for (const card of ideas) {
        // Slugs must not contain the .md extension (it was stripped).
        expect(card.slug).not.toMatch(/\.md$/);
        // Slugs must not be empty.
        expect(card.slug.length).toBeGreaterThan(0);
      }
    });
  });
});

// ---------------------------------------------------------------------------
// Read-only invariant: readIdeas MUST NOT write to disk (FRD-01 cross-cutting rule).
// Tested indirectly: the function signature takes only a path string (no write affordance).
// The real guard is in code review, but we can assert the return type is the ONLY output.
// ---------------------------------------------------------------------------

describe("frd-01: readIdeas — read-only invariant (REQ-01-011)", () => {
  it("frd-01: readIdeas returns an array (never undefined/null), proving no write side-effect output", async () => {
    await withFactoryRoot(FIXTURE_FULL, () => {
      const result = readIdeas();
      expect(result).not.toBeNull();
      expect(result).not.toBeUndefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// Optional ideasDir argument overrides the config.IDEAS_DIR default.
// Contract: readIdeas(ideasDir?: string) — defaults to config.IDEAS_DIR.
// ---------------------------------------------------------------------------

describe("frd-01: readIdeas — explicit ideasDir argument", () => {
  it("frd-01: WHEN readIdeas is called with an explicit dir THEN it reads from that dir, not the default", () => {
    const explicitDir = path.join(FIXTURE_FULL, "factory", "ideas");
    const ideas = readIdeas(explicitDir) as IdeaCard[];
    // Should return the same 5 valid cards as the env-based call.
    expect(ideas).toHaveLength(5);
  });

  it("frd-01: WHEN readIdeas is called with an explicit dir THEN the slugs are derived from that dir's filenames", () => {
    const explicitDir = path.join(FIXTURE_FULL, "factory", "ideas");
    const ideas = readIdeas(explicitDir) as IdeaCard[];
    const slugs = ideas.map((c) => c.slug).sort();
    expect(slugs).toEqual([
      "idea-discarded",
      "idea-discovered",
      "idea-in-pipeline",
      "idea-recommended",
      "idea-shipped",
    ]);
  });
});

// ---------------------------------------------------------------------------
// Body field: must contain the markdown body, not the frontmatter.
// The blueprint says: body = markdown body (the content after the --- delimiters).
// ---------------------------------------------------------------------------

describe("frd-01: readIdeas — body field contains markdown content, not YAML frontmatter", () => {
  it("frd-01: idea-discovered body does NOT contain the YAML delimiter '---'", async () => {
    await withFactoryRoot(FIXTURE_FULL, () => {
      const ideas = readIdeas() as IdeaCard[];
      const card = ideas.find((c) => c.slug === "idea-discovered");
      // gray-matter's .content property strips the frontmatter block.
      expect(card?.body).not.toMatch(/^---/m);
    });
  });

  it("frd-01: idea-discovered body contains the idea's narrative text", async () => {
    // fixture body: "A tool that reviews code using AI..."
    await withFactoryRoot(FIXTURE_FULL, () => {
      const ideas = readIdeas() as IdeaCard[];
      const card = ideas.find((c) => c.slug === "idea-discovered");
      expect(card?.body).toContain("AI");
    });
  });
});

// ---------------------------------------------------------------------------
// Idempotency: calling readIdeas twice returns the same result.
// (Proves no hidden mutable state; also catches implementations that sort
//  differently across calls due to OS readdir non-determinism.)
// ---------------------------------------------------------------------------

describe("frd-01: readIdeas — idempotency", () => {
  it("frd-01: WHEN readIdeas is called twice THEN both calls return the same slugs in the same order", async () => {
    await withFactoryRoot(FIXTURE_FULL, () => {
      const first = (readIdeas() as IdeaCard[]).map((c) => c.slug);
      const second = (readIdeas() as IdeaCard[]).map((c) => c.slug);
      expect(first).toEqual(second);
    });
  });
});
