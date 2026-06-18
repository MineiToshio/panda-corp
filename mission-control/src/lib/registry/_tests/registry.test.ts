/**
 * lib/registry.test.ts — WO-07-003
 *
 * Tests for `readDecisionRules()` in `lib/registry.ts`.
 *
 * Traceability:
 *   AC-07-003.1 — field mapping: id, patron, default, requiereHumano, nota?
 *   AC-07-003.2 — requiereHumano maps from requiere_humano; absent → false, no throw
 *   AC-07-003.3 — extra/unknown YAML keys tolerated (forward-compatible)
 *   AC-07-003.4 — missing/unparseable file → [] + no throw
 *   AC-07-003.5 — reads from resolveFactoryRoot() (fixture testing via env override)
 *
 * TDD plan (WO): four fixture entries (requiere_humano:true, false, nota, extra keys)
 * + missing-file case.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readDecisionRules } from "../registry";

// ---------------------------------------------------------------------------
// Helpers: build a minimal factory fixture in a temp dir
// ---------------------------------------------------------------------------

function makeTmpFactory(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mc-registry-"));
  fs.mkdirSync(path.join(dir, "factory", "decisions"), { recursive: true });
  return dir;
}

function writeRegistry(factoryRoot: string, content: string): void {
  fs.writeFileSync(
    path.join(factoryRoot, "factory", "decisions", "registry.yaml"),
    content,
    "utf-8",
  );
}

// ---------------------------------------------------------------------------
// Fixture YAML: covers all four TDD plan entries
// ---------------------------------------------------------------------------

const FIXTURE_YAML = `
decisiones:
  - id: DR-001
    patron: "add a dependency"
    default: "auto-approve if no CVEs"
    requiere_humano: false

  - id: DR-002
    patron: "deploy to PRODUCTION"
    default: "BLOCK - requires owner approval"
    requiere_humano: true
    nota: "lightweight approval"

  - id: DR-003
    patron: "spend money"
    default: "BLOCK"
    nota: "spending note"

  - id: DR-004
    patron: "extra keys rule"
    default: "auto-approve"
    requiere_humano: false
    extra_key_unknown: "should be tolerated"
    another_unknown: 42
`;

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

let tmpDir: string;
let origEnv: string | undefined;

beforeEach(() => {
  tmpDir = makeTmpFactory();
  origEnv = process.env.PANDACORP_FACTORY_ROOT;
  process.env.PANDACORP_FACTORY_ROOT = tmpDir;
});

afterEach(() => {
  if (origEnv === undefined) {
    delete process.env.PANDACORP_FACTORY_ROOT;
  } else {
    process.env.PANDACORP_FACTORY_ROOT = origEnv;
  }
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// AC-07-003.5 — reads from resolveFactoryRoot() (fixture testing via env override)
// ---------------------------------------------------------------------------

describe("readDecisionRules — factory root override (AC-07-003.5)", () => {
  it("reads the registry from the PANDACORP_FACTORY_ROOT-controlled path", () => {
    writeRegistry(tmpDir, FIXTURE_YAML);
    const rules = readDecisionRules();
    expect(rules.length).toBeGreaterThan(0);
  });

  it("does not read from the real factory when the env var is set to a fixture", () => {
    // With an empty decisions directory (no file), returns []
    const rules = readDecisionRules();
    expect(rules).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// AC-07-003.1 — field mapping per entry
// ---------------------------------------------------------------------------

describe("readDecisionRules — field mapping (AC-07-003.1)", () => {
  beforeEach(() => {
    writeRegistry(tmpDir, FIXTURE_YAML);
  });

  it("returns one DecisionRule per item in decisiones[]", () => {
    const rules = readDecisionRules();
    expect(rules).toHaveLength(4);
  });

  it("maps id correctly", () => {
    const rules = readDecisionRules();
    expect(rules[0]?.id).toBe("DR-001");
    expect(rules[1]?.id).toBe("DR-002");
    expect(rules[2]?.id).toBe("DR-003");
    expect(rules[3]?.id).toBe("DR-004");
  });

  it("maps patron correctly", () => {
    const rules = readDecisionRules();
    expect(rules[0]?.patron).toBe("add a dependency");
    expect(rules[1]?.patron).toBe("deploy to PRODUCTION");
  });

  it("maps default correctly", () => {
    const rules = readDecisionRules();
    expect(rules[0]?.default).toBe("auto-approve if no CVEs");
    expect(rules[1]?.default).toBe("BLOCK - requires owner approval");
  });

  it("maps nota when present", () => {
    const rules = readDecisionRules();
    expect(rules[1]?.nota).toBe("lightweight approval");
    expect(rules[2]?.nota).toBe("spending note");
  });

  it("nota is undefined when absent", () => {
    const rules = readDecisionRules();
    expect(rules[0]?.nota).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// AC-07-003.2 — requiereHumano mapping
// ---------------------------------------------------------------------------

describe("readDecisionRules — requiereHumano (AC-07-003.2)", () => {
  beforeEach(() => {
    writeRegistry(tmpDir, FIXTURE_YAML);
  });

  it("maps requiere_humano: true to requiereHumano: true", () => {
    const rules = readDecisionRules();
    const dr002 = rules.find((r) => r.id === "DR-002");
    expect(dr002?.requiereHumano).toBe(true);
  });

  it("maps requiere_humano: false to requiereHumano: false", () => {
    const rules = readDecisionRules();
    const dr001 = rules.find((r) => r.id === "DR-001");
    expect(dr001?.requiereHumano).toBe(false);
  });

  it("defaults requiereHumano to false when requiere_humano is absent", () => {
    const rules = readDecisionRules();
    // DR-003 has no requiere_humano field
    const dr003 = rules.find((r) => r.id === "DR-003");
    expect(dr003?.requiereHumano).toBe(false);
  });

  it("does not throw when requiere_humano is absent", () => {
    expect(() => readDecisionRules()).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// AC-07-003.3 — extra/unknown YAML keys tolerated
// ---------------------------------------------------------------------------

describe("readDecisionRules — extra YAML keys tolerated (AC-07-003.3)", () => {
  it("does not throw when unknown keys are present", () => {
    writeRegistry(tmpDir, FIXTURE_YAML);
    expect(() => readDecisionRules()).not.toThrow();
  });

  it("still maps the known fields correctly when extra keys exist", () => {
    writeRegistry(tmpDir, FIXTURE_YAML);
    const rules = readDecisionRules();
    const dr004 = rules.find((r) => r.id === "DR-004");
    expect(dr004).toBeDefined();
    expect(dr004?.patron).toBe("extra keys rule");
    expect(dr004?.default).toBe("auto-approve");
    expect(dr004?.requiereHumano).toBe(false);
  });

  it("does not expose unknown keys on the returned object shape", () => {
    writeRegistry(tmpDir, FIXTURE_YAML);
    const rules = readDecisionRules();
    const dr004 = rules.find((r) => r.id === "DR-004");
    expect(dr004).not.toHaveProperty("extra_key_unknown");
    expect(dr004).not.toHaveProperty("another_unknown");
  });
});

// ---------------------------------------------------------------------------
// AC-07-003.4 — missing/unparseable file → [] + no throw
// ---------------------------------------------------------------------------

describe("readDecisionRules — graceful degradation (AC-07-003.4)", () => {
  it("returns [] when registry.yaml does not exist", () => {
    // tmpDir has no registry.yaml (only the decisions dir)
    const rules = readDecisionRules();
    expect(rules).toEqual([]);
  });

  it("does not throw when registry.yaml is missing", () => {
    expect(() => readDecisionRules()).not.toThrow();
  });

  it("returns [] when registry.yaml is unparseable YAML", () => {
    writeRegistry(tmpDir, "decisiones: [this is: not: valid: yaml {{{{");
    const rules = readDecisionRules();
    expect(rules).toEqual([]);
  });

  it("does not throw when registry.yaml is unparseable", () => {
    writeRegistry(tmpDir, "decisiones: [this is: not: valid: yaml {{{{");
    expect(() => readDecisionRules()).not.toThrow();
  });

  it("returns [] when the factory root directory does not exist", () => {
    // Point env to a path that does not exist
    process.env.PANDACORP_FACTORY_ROOT = "/this/path/does/not/exist/ever";
    const rules = readDecisionRules();
    expect(rules).toEqual([]);
  });

  it("does not throw when the factory root directory does not exist", () => {
    process.env.PANDACORP_FACTORY_ROOT = "/this/path/does/not/exist/ever";
    expect(() => readDecisionRules()).not.toThrow();
  });

  it("returns [] when registry.yaml is empty", () => {
    writeRegistry(tmpDir, "");
    const rules = readDecisionRules();
    expect(rules).toEqual([]);
  });

  it("returns [] when decisiones key is missing (other top-level keys present)", () => {
    writeRegistry(tmpDir, "other_key:\n  - foo: bar\n");
    const rules = readDecisionRules();
    expect(rules).toEqual([]);
  });

  it("returns [] when decisiones is null", () => {
    writeRegistry(tmpDir, "decisiones: null\n");
    const rules = readDecisionRules();
    expect(rules).toEqual([]);
  });

  it("returns [] when decisiones is empty array", () => {
    writeRegistry(tmpDir, "decisiones: []\n");
    const rules = readDecisionRules();
    expect(rules).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Shape invariants (type safety)
// ---------------------------------------------------------------------------

describe("readDecisionRules — shape invariants", () => {
  beforeEach(() => {
    writeRegistry(tmpDir, FIXTURE_YAML);
  });

  it("every returned rule has id (string)", () => {
    const rules = readDecisionRules();
    for (const rule of rules) {
      expect(typeof rule.id).toBe("string");
    }
  });

  it("every returned rule has patron (string)", () => {
    const rules = readDecisionRules();
    for (const rule of rules) {
      expect(typeof rule.patron).toBe("string");
    }
  });

  it("every returned rule has default (string)", () => {
    const rules = readDecisionRules();
    for (const rule of rules) {
      expect(typeof rule.default).toBe("string");
    }
  });

  it("every returned rule has requiereHumano (boolean)", () => {
    const rules = readDecisionRules();
    for (const rule of rules) {
      expect(typeof rule.requiereHumano).toBe("boolean");
    }
  });

  it("nota is either undefined or a string, never another type", () => {
    const rules = readDecisionRules();
    for (const rule of rules) {
      expect(rule.nota === undefined || typeof rule.nota === "string").toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Edge cases: entries missing required fields are skipped gracefully
// ---------------------------------------------------------------------------

describe("readDecisionRules — skips malformed entries", () => {
  it("skips entries missing id and still returns valid entries", () => {
    writeRegistry(
      tmpDir,
      `
decisiones:
  - patron: "no id here"
    default: "auto"
    requiere_humano: false
  - id: DR-GOOD
    patron: "valid entry"
    default: "auto-approve"
    requiere_humano: false
`,
    );
    const rules = readDecisionRules();
    expect(rules).toHaveLength(1);
    expect(rules[0]?.id).toBe("DR-GOOD");
  });

  it("skips entries missing patron and still returns valid entries", () => {
    writeRegistry(
      tmpDir,
      `
decisiones:
  - id: DR-BAD
    default: "auto"
    requiere_humano: false
  - id: DR-GOOD
    patron: "valid"
    default: "auto"
    requiere_humano: false
`,
    );
    const rules = readDecisionRules();
    expect(rules).toHaveLength(1);
    expect(rules[0]?.id).toBe("DR-GOOD");
  });

  it("skips entries missing default and still returns valid entries", () => {
    writeRegistry(
      tmpDir,
      `
decisiones:
  - id: DR-BAD
    patron: "no default"
    requiere_humano: false
  - id: DR-GOOD
    patron: "valid"
    default: "auto"
    requiere_humano: false
`,
    );
    const rules = readDecisionRules();
    expect(rules).toHaveLength(1);
    expect(rules[0]?.id).toBe("DR-GOOD");
  });
});
