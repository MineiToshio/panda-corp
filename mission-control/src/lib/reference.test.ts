/**
 * WO-07-001 — `lib/reference.ts`: read skills + agents catalogs (RED phase)
 *
 * Tests are written BEFORE the implementation. Every test will fail until the
 * GREEN phase — that is the TDD intent (DR-016).
 *
 * Traceability (FRD-07 EARS + blueprint §3 IF-07-reference → AC → test):
 *
 * Skills catalog:
 *   AC-07-001.1  readSkills() returns one entry per plugin/skills/<slug>/SKILL.md;
 *                slug = directory name (NOT a name: field); description from frontmatter.
 *   AC-07-001.2  A skill with no `description` frontmatter is skipped with a warning;
 *                the catalog still returns the rest (no throw).
 *   AC-07-001.3  Each entry includes raw body markdown and a `runsIn` field
 *                ("factory" | "project" | "unknown") inferred from description/body.
 *   AC-07-001.4  Reader uses resolveFactoryRoot() / PANDACORP_FACTORY_ROOT so tests
 *                can point at a fixture tree.
 *   AC-07-001.5  Catalog reflects added/renamed/removed skills automatically (no static
 *                array) — verified by the fixture having a renamed dir and dynamic count.
 *
 * Agents catalog:
 *   AC-07-002.1  readAgents() returns one entry per plugin/agents/<id>.md;
 *                id = filename without extension; name/description/model from frontmatter; body.
 *   AC-07-002.2  An agent missing name/description/model gets typed null/"unknown" for the
 *                missing field; a totally malformed file is skipped; no throw.
 *   AC-07-002.3  Reader uses resolveFactoryRoot() so tests use the fixture tree.
 *   AC-07-002.4  Catalog reflects added/renamed/removed agents automatically.
 *
 * Stack: Vitest (Node env), real fs reads against fixture trees.
 * No mocks — lib/reference.ts is a pure fs-in / typed-array-out module.
 * PANDACORP_FACTORY_ROOT is set/restored per test via withFactoryRoot().
 */

import path from "node:path";
import { describe, expect, it } from "vitest";
import { withFactoryRoot } from "@/tests/fixtures/index";

// ---------------------------------------------------------------------------
// Module under test — does not exist yet (RED phase).
// ---------------------------------------------------------------------------
import { readAgents, readSkills } from "./reference";

// ---------------------------------------------------------------------------
// Types (mirror blueprint §3 IF-07-reference; kept local for self-containedness).
// The module must export these shapes — tests break if signatures diverge.
// ---------------------------------------------------------------------------

type RunsIn = "factory" | "project" | "unknown";

// biome-ignore lint/correctness/noUnusedVariables: structural doc anchor
type SkillRef = {
  slug: string;
  description: string;
  runsIn: RunsIn;
  body: string;
};

// biome-ignore lint/correctness/noUnusedVariables: structural doc anchor
type AgentRef = {
  id: string;
  name: string | null;
  description: string | null;
  model: string;
  body: string;
};

// ---------------------------------------------------------------------------
// Fixture root — a synthetic plugin tree, fully under our control.
// ---------------------------------------------------------------------------
const FIXTURE_PLUGIN_ROOT = path.resolve(import.meta.dirname, "../tests/fixtures/plugin-reference");

// ---------------------------------------------------------------------------
// Skills catalog — AC-07-001.*
// ---------------------------------------------------------------------------

describe("readSkills()", () => {
  it("AC-07-001.1 — returns one entry per skill dir; slug = dir name, description from frontmatter", async () => {
    const skills = await withFactoryRoot(FIXTURE_PLUGIN_ROOT, () => readSkills());

    // The fixture has 5 dirs: explore, spec, implement, no-description, malformed-yaml.
    // no-description and malformed-yaml should be skipped → 3 valid entries.
    expect(skills).toHaveLength(3);

    const slugs = skills.map((s) => s.slug);
    expect(slugs).toContain("explore");
    expect(slugs).toContain("spec");
    expect(slugs).toContain("implement");

    // Slugs must come from the directory name, not from any name: field.
    for (const skill of skills) {
      expect(typeof skill.slug).toBe("string");
      expect(skill.slug.length).toBeGreaterThan(0);
    }
  });

  it("AC-07-001.1 — description matches frontmatter `description` field exactly", async () => {
    const skills = await withFactoryRoot(FIXTURE_PLUGIN_ROOT, () => readSkills());
    const explore = skills.find((s) => s.slug === "explore");
    expect(explore).toBeDefined();
    expect(explore?.description).toContain("Explores and clarifies a fuzzy idea");
  });

  it("AC-07-001.2 — skill without `description` frontmatter is skipped (no throw)", async () => {
    // no-description dir has a SKILL.md with `title:` but no `description:`.
    const skills = await withFactoryRoot(FIXTURE_PLUGIN_ROOT, () => readSkills());
    const noDescSlug = skills.find((s) => s.slug === "no-description");
    expect(noDescSlug).toBeUndefined();
    // The rest of the catalog is still present.
    expect(skills.length).toBeGreaterThanOrEqual(3);
  });

  it("AC-07-001.2 — malformed YAML frontmatter causes skill to be skipped, not a throw", async () => {
    const skills = await withFactoryRoot(FIXTURE_PLUGIN_ROOT, () => readSkills());
    const malformed = skills.find((s) => s.slug === "malformed-yaml");
    expect(malformed).toBeUndefined();
  });

  it("AC-07-001.3 — entry includes raw body markdown", async () => {
    const skills = await withFactoryRoot(FIXTURE_PLUGIN_ROOT, () => readSkills());
    const explore = skills.find((s) => s.slug === "explore");
    expect(typeof explore?.body).toBe("string");
    // Body is the content after the frontmatter.
    expect(explore?.body.length).toBeGreaterThan(0);
  });

  it("AC-07-001.3 — runsIn is exactly one of the three valid literals", async () => {
    const skills = await withFactoryRoot(FIXTURE_PLUGIN_ROOT, () => readSkills());
    const validValues: RunsIn[] = ["factory", "project", "unknown"];
    for (const skill of skills) {
      expect(validValues).toContain(skill.runsIn);
    }
  });

  it("AC-07-001.3 — explore has runsIn=factory (description mentions factory context)", async () => {
    const skills = await withFactoryRoot(FIXTURE_PLUGIN_ROOT, () => readSkills());
    const explore = skills.find((s) => s.slug === "explore");
    // explore description: "Runs in the factory context" → inferred "factory"
    expect(explore?.runsIn).toBe("factory");
  });

  it("AC-07-001.3 — implement has runsIn=project (description mentions inside the project)", async () => {
    const skills = await withFactoryRoot(FIXTURE_PLUGIN_ROOT, () => readSkills());
    const impl = skills.find((s) => s.slug === "implement");
    // implement description: "Use inside the project" → inferred "project"
    expect(impl?.runsIn).toBe("project");
  });

  it("AC-07-001.3 — spec: ambiguous description (runs from factory but creates a project) → could be factory or unknown", async () => {
    const skills = await withFactoryRoot(FIXTURE_PLUGIN_ROOT, () => readSkills());
    const spec = skills.find((s) => s.slug === "spec");
    // spec description mentions "runs from the factory" → "factory"
    const validValues: RunsIn[] = ["factory", "project", "unknown"];
    expect(validValues).toContain(spec?.runsIn);
  });

  it("AC-07-001.4 — uses PANDACORP_FACTORY_ROOT env override (fixture root, not real plugin)", async () => {
    // The fixture has only our controlled skills — if the real plugin were read,
    // the count would differ from 3. Passing means the env override is honored.
    const skills = await withFactoryRoot(FIXTURE_PLUGIN_ROOT, () => readSkills());
    expect(skills).toHaveLength(3);
  });

  it("AC-07-001.5 — catalog is dynamic: reflects the fixture's exact contents (no static array)", async () => {
    // If a static array were used, adding/removing from the fixture would not
    // change the output. The fixture has exactly 3 valid skill dirs → count must be 3.
    const skills = await withFactoryRoot(FIXTURE_PLUGIN_ROOT, () => readSkills());
    // We know the fixture tree: explore, spec, implement are valid; 2 are skipped.
    expect(skills).toHaveLength(3);
    const slugs = skills.map((s) => s.slug).sort();
    expect(slugs).toEqual(["explore", "implement", "spec"]);
  });

  it("AC-07-001.5 — missing skills directory returns empty array without throwing", async () => {
    const skills = await withFactoryRoot("/nonexistent/path/nowhere", () => readSkills());
    expect(skills).toEqual([]);
  });

  it("readSkills() never throws on an empty skills directory", async () => {
    // If plugin/skills/ exists but is empty, the reader should return [].
    // We test via the nonexistent root (directory absent = empty result).
    await expect(withFactoryRoot("/nonexistent/path/nowhere", () => readSkills())).resolves.toEqual(
      [],
    );
  });
});

// ---------------------------------------------------------------------------
// Agents catalog — AC-07-002.*
// ---------------------------------------------------------------------------

describe("readAgents()", () => {
  it("AC-07-002.1 — returns one entry per agent file; id = filename without extension", async () => {
    const agents = await withFactoryRoot(FIXTURE_PLUGIN_ROOT, () => readAgents());

    // Fixture: implementer.md, reviewer.md, no-model.md, no-name.md, malformed.md
    // malformed.md → skipped → 4 valid entries.
    expect(agents).toHaveLength(4);

    const ids = agents.map((a) => a.id);
    expect(ids).toContain("implementer");
    expect(ids).toContain("reviewer");
    expect(ids).toContain("no-model");
    expect(ids).toContain("no-name");
  });

  it("AC-07-002.1 — id does not include the .md extension", async () => {
    const agents = await withFactoryRoot(FIXTURE_PLUGIN_ROOT, () => readAgents());
    for (const agent of agents) {
      expect(agent.id).not.toMatch(/\.md$/);
    }
  });

  it("AC-07-002.1 — name, description, model come from frontmatter for a well-formed agent", async () => {
    const agents = await withFactoryRoot(FIXTURE_PLUGIN_ROOT, () => readAgents());
    const impl = agents.find((a) => a.id === "implementer");
    expect(impl).toBeDefined();
    expect(impl?.name).toBe("implementer");
    expect(impl?.description).toContain("Pandacorp's implementer");
    expect(impl?.model).toBe("sonnet");
  });

  it("AC-07-002.1 — body is the raw markdown content after the frontmatter", async () => {
    const agents = await withFactoryRoot(FIXTURE_PLUGIN_ROOT, () => readAgents());
    const impl = agents.find((a) => a.id === "implementer");
    expect(typeof impl?.body).toBe("string");
    expect(impl?.body.length).toBeGreaterThan(0);
    expect(impl?.body).toContain("implementer");
  });

  it("AC-07-002.2 — agent missing `model` field gets model: 'unknown'", async () => {
    const agents = await withFactoryRoot(FIXTURE_PLUGIN_ROOT, () => readAgents());
    const noModel = agents.find((a) => a.id === "no-model");
    expect(noModel).toBeDefined();
    expect(noModel?.model).toBe("unknown");
    // Other fields are still present.
    expect(noModel?.name).toBe("agent-without-model");
  });

  it("AC-07-002.2 — agent missing `name` field gets name: null", async () => {
    const agents = await withFactoryRoot(FIXTURE_PLUGIN_ROOT, () => readAgents());
    const noName = agents.find((a) => a.id === "no-name");
    expect(noName).toBeDefined();
    expect(noName?.name).toBeNull();
    // description and model still present.
    expect(noName?.description).toContain("missing the name field");
    expect(noName?.model).toBe("sonnet");
  });

  it("AC-07-002.2 — totally malformed frontmatter file is skipped (no throw)", async () => {
    const agents = await withFactoryRoot(FIXTURE_PLUGIN_ROOT, () => readAgents());
    const malformed = agents.find((a) => a.id === "malformed");
    expect(malformed).toBeUndefined();
    // The rest are still present.
    expect(agents.length).toBeGreaterThanOrEqual(4);
  });

  it("AC-07-002.3 — uses PANDACORP_FACTORY_ROOT env override (fixture tree, not real agents)", async () => {
    // The fixture has exactly 4 valid agents (excl. malformed).
    // If the real plugin were read, counts would differ.
    const agents = await withFactoryRoot(FIXTURE_PLUGIN_ROOT, () => readAgents());
    expect(agents).toHaveLength(4);
  });

  it("AC-07-002.4 — catalog is dynamic: reflects fixture contents (no static array)", async () => {
    const agents = await withFactoryRoot(FIXTURE_PLUGIN_ROOT, () => readAgents());
    const ids = agents.map((a) => a.id).sort();
    expect(ids).toEqual(["implementer", "no-model", "no-name", "reviewer"]);
  });

  it("AC-07-002.4 — missing agents directory returns empty array without throwing", async () => {
    const agents = await withFactoryRoot("/nonexistent/path/nowhere", () => readAgents());
    expect(agents).toEqual([]);
  });

  it("readAgents() never throws on absent agents directory", async () => {
    await expect(withFactoryRoot("/nonexistent/path/nowhere", () => readAgents())).resolves.toEqual(
      [],
    );
  });
});

// ---------------------------------------------------------------------------
// Integration — both readers share the same resolveFactoryRoot path resolution.
// ---------------------------------------------------------------------------

describe("readSkills() + readAgents() integration", () => {
  it("both readers work from the same fixture root without interfering", async () => {
    const [skills, agents] = await withFactoryRoot(FIXTURE_PLUGIN_ROOT, () =>
      Promise.all([readSkills(), readAgents()]),
    );
    expect(skills.length).toBeGreaterThan(0);
    expect(agents.length).toBeGreaterThan(0);
  });

  it("both return empty arrays (not exceptions) when the root has no plugin/ subdir", async () => {
    // A factory root with no plugin/ directory at all.
    const [skills, agents] = await withFactoryRoot("/nonexistent/path/nowhere", () =>
      Promise.all([readSkills(), readAgents()]),
    );
    expect(skills).toEqual([]);
    expect(agents).toEqual([]);
  });
});
