import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readDecisionRuleCatalog } from "@/lib/registry/registry";
import { readStandardCatalog } from "@/lib/standards/standards";
import { loadConfigurationCatalogs } from "../configurationCatalogs";
import { readAgentCatalog, readSkillCatalog, readSkills } from "../reference";

let root: string;
function write(file: string, body: string): void {
  const target = path.join(root, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, body);
}
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "config-catalogs-"));
  vi.stubEnv("PANDACORP_FACTORY_ROOT", root);
  write(
    "plugin/skills/build/SKILL.md",
    "---\ndescription: Builds inside the project\n---\nUses reviewer.",
  );
  write(
    "plugin/agents/reviewer.md",
    "---\nname: Reviewer\nmodel: opus\neffort: HIGH\ntools: [Read, Bash]\n---\nReview.",
  );
  write(
    "factory/decisions/registry.yaml",
    "decisiones:\n  - id: DR-1\n    patron: Deploy\n    default: Ask\n    requiere_humano: true\n",
  );
  write(
    "factory/standards/quality.md",
    "---\ndomain: Quality\nseverity: MUST\nenforcement: CI\n---\n# Quality\nTests.",
  );
});
afterEach(() => {
  vi.unstubAllEnvs();
  fs.rmSync(root, { recursive: true, force: true });
});
describe("configuration catalogs", () => {
  it("AC-07-013.1 derives counts, owner commands, facets and reverse links once", () => {
    const catalogs = loadConfigurationCatalogs();
    expect(catalogs.counts).toMatchObject({
      skills: 1,
      agents: 1,
      rules: 1,
      standards: 1,
      owner: 1,
      human: 1,
      must: 1,
    });
    expect(catalogs.ownerCommands.map((skill) => skill.slug)).toEqual(["build"]);
    expect(catalogs.skillsByAgent.reviewer).toEqual(["build"]);
    expect(catalogs.domains).toEqual([{ domain: "Quality", count: 1 }]);
  });
  it("AC-07-013.3 normalizes effort and tools without inventing a tier", () => {
    const result = readAgentCatalog();
    expect(result).toMatchObject({ ok: true, data: [{ effort: "high", tools: ["Read", "Bash"] }] });
    write("plugin/agents/other.md", "---\nmodel: mystery\neffort: maximum\n---\nOther");
    expect(loadConfigurationCatalogs().counts.tiers.unknown).toBe(1);
  });
  it("DR-078 reports malformed and missing sources while legacy readers remain tolerant", () => {
    write("plugin/skills/bad/SKILL.md", "---\ndescription: [broken\n---\nBad");
    expect(readSkillCatalog()).toMatchObject({
      ok: false,
      source: expect.stringContaining("SKILL.md"),
      reason: expect.any(String),
    });
    expect(readSkills()).toHaveLength(1);
    write("factory/decisions/registry.yaml", "wrong: []");
    expect(readDecisionRuleCatalog()).toMatchObject({ ok: false });
    write("factory/standards/quality.md", "---\nseverity: [broken\n---\n# Broken");
    expect(readStandardCatalog()).toMatchObject({ ok: false });
    expect(loadConfigurationCatalogs().agents.ok).toBe(true);
  });
});
