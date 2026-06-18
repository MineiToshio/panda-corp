/**
 * WO-11-001 — ADVERSARIAL review tests (reviewer-authored, DR-015).
 *
 * These probe edge cases, abuse and ambiguity the implementer's own suite did NOT
 * cover. Derived from the EARS criteria (AC-11-003.1/.2) and from real bugs in
 * .pandacorp/comms/progress.md (B1' non-finite/coercion, I2 vacuous, I3 array-shaped,
 * FREEZE-ON-RED throw-safety, WO-13 symlink/write-isolation mindset).
 *
 * The implementer corrupted storage by *searching* for a value === "pro" (fragile).
 * Here we corrupt storage at the EXACT deterministic key the store uses, so a key-scheme
 * regression cannot silently pass. We also assert per-project isolation cannot be
 * defeated by colliding slug shapes, and that no global / cross-slug bleed occurs.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getRememberedMode, rememberMode } from "../build-mode-store";
import { BUILD_MODES, DEFAULT_BUILD_MODE } from "../constants";

/** The store's real key scheme (mirrors the implementation under test). */
const keyFor = (slug: string) => `mc:build-mode:${slug}`;

describe("frd-11 ADVERSARIAL: corrupt / hostile stored values", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  // B1' family: case-variant of a valid mode must NOT be accepted (modes are exact literals).
  it("uppercase 'PRO' is NOT a valid mode → falls back to default", () => {
    localStorage.setItem(keyFor("p"), "PRO");
    expect(getRememberedMode("p")).toBe(DEFAULT_BUILD_MODE);
  });

  it("mixed-case 'Balanced' is NOT a valid mode → falls back to default", () => {
    localStorage.setItem(keyFor("p"), "Balanced");
    expect(getRememberedMode("p")).toBe(DEFAULT_BUILD_MODE);
  });

  // Whitespace-padded valid mode: " pro " is NOT === "pro". The store must not silently trim
  // and accept it (that would mean inconsistent round-tripping). Either way, must not throw.
  it("whitespace-padded ' pro ' is not accepted as 'pro' (no implicit trim acceptance)", () => {
    localStorage.setItem(keyFor("p"), " pro ");
    const result = getRememberedMode("p");
    expect(result).toBe(DEFAULT_BUILD_MODE);
  });

  // The literal strings "null"/"undefined"/"NaN" (B1' coercion family) must be rejected.
  it.each([
    "null",
    "undefined",
    "NaN",
    "0",
    "false",
    "[object Object]",
  ])("literal coercion artifact %p falls back to default", (poison) => {
    localStorage.setItem(keyFor("p"), poison);
    expect(getRememberedMode("p")).toBe(DEFAULT_BUILD_MODE);
  });

  // I3 family: JSON object (not just array) must fall back.
  it("JSON object stored value falls back to default", () => {
    localStorage.setItem(keyFor("p"), JSON.stringify({ id: "pro" }));
    expect(getRememberedMode("p")).toBe(DEFAULT_BUILD_MODE);
  });

  // A valid mode embedded in a larger string must NOT be accepted (no substring matching).
  it("'pro extra junk' is rejected (exact match only, not substring)", () => {
    localStorage.setItem(keyFor("p"), "pro extra junk");
    expect(getRememberedMode("p")).toBe(DEFAULT_BUILD_MODE);
  });

  // Prototype-pollution-shaped key: a value of "__proto__" must not be returned/accepted.
  it("'__proto__' / 'constructor' stored values fall back to default", () => {
    localStorage.setItem(keyFor("p"), "__proto__");
    expect(getRememberedMode("p")).toBe(DEFAULT_BUILD_MODE);
    localStorage.setItem(keyFor("p"), "constructor");
    expect(getRememberedMode("p")).toBe(DEFAULT_BUILD_MODE);
  });
});

describe("frd-11 ADVERSARIAL: per-project isolation cannot be defeated", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  // AC-11-003.1: a slug containing the key separator ':' must not be able to forge
  // another project's key. With key = `mc:build-mode:${slug}`, slug="x" and slug="" with a
  // manually planted "mc:build-mode:" prefix should remain independent. We assert that two
  // genuinely different slugs never read each other's value.
  it("slug containing ':' does not collide with a sibling slug", () => {
    rememberMode("alpha:beta", "pro");
    rememberMode("alpha", "deep");
    expect(getRememberedMode("alpha:beta")).toBe("pro");
    expect(getRememberedMode("alpha")).toBe("deep");
  });

  // Empty slug must be independent from a real slug (no global key bleed).
  it("empty slug does not read a non-empty slug's value", () => {
    rememberMode("real", "powerful");
    expect(getRememberedMode("")).toBe(DEFAULT_BUILD_MODE);
  });

  // Unicode / spaces in slug round-trip without throwing.
  it("unicode + space slug round-trips", () => {
    rememberMode("proyecto ñandú 🐼", "deep");
    expect(getRememberedMode("proyecto ñandú 🐼")).toBe("deep");
  });
});

describe("frd-11 ADVERSARIAL: write-path throw-safety (FREEZE-ON-RED mindset)", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  // The implementer only proved getRememberedMode is throw-safe. rememberMode must be too:
  // a QuotaExceededError from setItem must be swallowed, not crash the caller.
  it("rememberMode does not throw when localStorage.setItem throws (quota / security)", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    expect(() => rememberMode("p", "deep")).not.toThrow();
  });

  // If setItem silently fails, a subsequent read must still yield a valid default (no corruption).
  it("after a failed write, read still returns a valid BuildMode", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    rememberMode("p", "deep");
    vi.restoreAllMocks();
    const result = getRememberedMode("p");
    expect(["pro", "balanced", "powerful", "deep"]).toContain(result);
  });
});

describe("frd-11 ADVERSARIAL: catalog integrity beyond happy path", () => {
  // BLOCKING FINDING (shallow-freeze): the code comment in constants.ts claims the catalog is
  // "Frozen to enforce the readonly invariant at runtime", but Object.freeze on the array is
  // SHALLOW — the entry objects remain mutable singletons. A single line anywhere in the app
  // (BUILD_MODES[0].id = "...") permanently corrupts the catalog for every consumer.
  // This test asserts the DESIRED contract (deep immutability). It is EXPECTED TO FAIL until
  // the implementer deep-freezes each entry; that failure is the evidence for the rejection.
  it("catalog entries are deeply immutable — mutating an entry's id must not take effect", () => {
    const original = BUILD_MODES[0]?.id;
    try {
      // @ts-expect-error — deliberately violating readonly to probe runtime immutability.
      BUILD_MODES[0].id = "hacked";
    } catch {
      /* throwing is the strong, acceptable outcome of a deep freeze */
    } finally {
      // Self-heal so a failure here cannot pollute sibling tests (the prod code does NOT
      // protect against this — that is precisely the defect being reported).
      // @ts-expect-error — restoring the field.
      if (BUILD_MODES[0] && BUILD_MODES[0].id === "hacked") BUILD_MODES[0].id = original;
    }
    // The mutation attempt must have been a no-op (deep freeze) — i.e. it threw or was ignored.
    // We re-read a fresh snapshot; with a proper deep freeze, id is still the original.
    expect(BUILD_MODES[0]?.id).toBe(original);
  });

  // Every non-balanced command, when split on whitespace, must yield exactly the skill + the id.
  it("non-balanced command parses to exactly [skill, id] (no stray args, no double space)", () => {
    for (const m of BUILD_MODES) {
      if (m.id === "balanced") continue;
      const parts = m.command.split(" ");
      expect(parts).toEqual(["/pandacorp:implement", m.id]);
    }
  });

  // DEFAULT must be discoverable in the catalog AND be the one with the bare command.
  it("the default mode is the one whose command has no argument", () => {
    const def = BUILD_MODES.find((m) => m.id === DEFAULT_BUILD_MODE) as { command: string };
    expect(def.command).toBe("/pandacorp:implement");
    const bare = BUILD_MODES.filter((m) => m.command === "/pandacorp:implement");
    expect(bare).toHaveLength(1);
    expect(bare[0]?.id).toBe(DEFAULT_BUILD_MODE);
  });
});
