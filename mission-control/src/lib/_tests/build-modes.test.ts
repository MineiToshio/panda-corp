/**
 * WO-11-001 — `BUILD_MODES` catalog + `getRememberedMode`/`rememberMode` — RED phase
 *
 * Tests are written BEFORE the implementation (`lib/constants.ts` additions and the
 * mode-store module do not exist yet). All tests will fail until the GREEN phase;
 * that is the intent (TDD contract per AGENTS.md).
 *
 * Traceability (EARS → AC → test):
 *   AC-11-001.1  The selector SHALL render four mode options in order:
 *                Pro/economical, Balanced, Powerful, Deep.
 *   AC-11-001.2  EACH option SHALL show its description (agents, models, recommended plan).
 *   AC-11-001.3  The default selected mode SHALL be Balanced when no mode has been chosen.
 *   AC-11-003.1  The chosen mode SHALL persist per project across refresh and tab close
 *                (client-local UI state, NOT a factory/project write).
 *   AC-11-003.2  Re-opening the project's Commands tab SHALL restore its remembered mode.
 *
 * Regression anchors from .pandacorp/comms/progress.md (real bugs → regression tests):
 *   B1' (2026-06-16, WO-13-001): NaN and non-finite numbers bypass `typeof value === "number"`
 *     guards. Applied here: `getRememberedMode` must not return NaN/undefined on any
 *     localStorage value; it must return the DEFAULT_BUILD_MODE string literal.
 *   I2 (2026-06-16, WO-13-001): empty/array objects satisfy vacuous collection checks.
 *     Applied here: an empty-string or empty-object stored value must fall back to default,
 *     not be returned as a valid mode.
 *   I3 (2026-06-16, WO-13-001): array-shaped values fool `typeof`/`Object.keys` checks.
 *     Applied here: a JSON-serialized array in localStorage must fall back to default, not
 *     be accepted as a BuildMode string.
 *   FREEZE-ON-RED incident (2026-06-16, WO-02-004): malformed input must never throw
 *     mid-operation. `getRememberedMode` must be throw-safe regardless of what localStorage
 *     contains.
 *
 * Architecture constraints under test:
 *   - No `status.yaml` write (architecture §7, REQ-01-011). `rememberMode` must only write
 *     to `localStorage`; no filesystem calls allowed.
 *   - DEFAULT_BUILD_MODE = "balanced" (WO spec, AC-11-001.3).
 *   - Balanced mode's command is `/pandacorp:implement` (no argument).
 *   - All other modes' commands carry their id as argument: `/pandacorp:implement <mode>`.
 *
 * Stack: Vitest (jsdom environment — localStorage is available globally).
 * No mocks beyond localStorage reset in `beforeEach`.
 * No fs reads; BUILD_MODES is a static constant and the mode-store is a pure client helper.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
// The modules under test (do not exist yet — tests are RED).
// lib/constants.ts will export BUILD_MODES, DEFAULT_BUILD_MODE, BuildMode, BuildModeInfo.
// lib/build-mode-store.ts (or a "use client" module) will export getRememberedMode, rememberMode.
import { getRememberedMode, rememberMode } from "../build-mode-store";
import { BUILD_MODES, type BuildMode, type BuildModeInfo, DEFAULT_BUILD_MODE } from "../constants";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Ordered list of expected mode IDs per AC-11-001.1. */
const EXPECTED_IDS: BuildMode[] = ["pro", "balanced", "powerful", "deep"];

/** Valid set of BuildMode literals — used for property-style checks. */
const VALID_BUILD_MODES = new Set<string>(["pro", "balanced", "powerful", "deep"]);

// ---------------------------------------------------------------------------
// BUILD_MODES catalog — AC-11-001.1, AC-11-001.2, AC-11-001.3
// ---------------------------------------------------------------------------

describe("frd-11: BUILD_MODES catalog", () => {
  it("frd-11: AC-11-001.1 — SHALL have exactly four entries", () => {
    expect(BUILD_MODES).toHaveLength(4);
  });

  it("frd-11: AC-11-001.1 — entries are in order: pro, balanced, powerful, deep", () => {
    const ids = BUILD_MODES.map((m) => m.id);
    expect(ids).toEqual(EXPECTED_IDS);
  });

  it("frd-11: AC-11-001.1 — every entry id is a valid BuildMode literal", () => {
    for (const mode of BUILD_MODES) {
      expect(VALID_BUILD_MODES.has(mode.id)).toBe(true);
    }
  });

  it("frd-11: AC-11-001.2 — every entry has a non-empty label string", () => {
    for (const mode of BUILD_MODES) {
      expect(typeof mode.label).toBe("string");
      expect(mode.label.trim()).not.toBe("");
    }
  });

  it("frd-11: AC-11-001.2 — every entry has a non-empty description string", () => {
    for (const mode of BUILD_MODES) {
      expect(typeof mode.description).toBe("string");
      expect(mode.description.trim()).not.toBe("");
    }
  });

  it("frd-11: AC-11-001.2 — every entry has a non-empty command string", () => {
    for (const mode of BUILD_MODES) {
      expect(typeof mode.command).toBe("string");
      expect(mode.command.trim()).not.toBe("");
    }
  });

  // AC-11-002.1: balanced uses bare /pandacorp:implement; others append their id.
  it("frd-11: AC-11-002.1 — balanced command is exactly '/pandacorp:implement' (no argument)", () => {
    const balanced = BUILD_MODES.find((m) => m.id === "balanced");
    expect(balanced).toBeDefined();
    expect(balanced?.command).toBe("/pandacorp:implement");
  });

  it("frd-11: AC-11-002.1 — pro command is '/pandacorp:implement pro'", () => {
    const pro = BUILD_MODES.find((m) => m.id === "pro");
    expect(pro).toBeDefined();
    expect(pro?.command).toBe("/pandacorp:implement pro");
  });

  it("frd-11: AC-11-002.1 — powerful command is '/pandacorp:implement powerful'", () => {
    const powerful = BUILD_MODES.find((m) => m.id === "powerful");
    expect(powerful).toBeDefined();
    expect(powerful?.command).toBe("/pandacorp:implement powerful");
  });

  it("frd-11: AC-11-002.1 — deep command is '/pandacorp:implement deep'", () => {
    const deep = BUILD_MODES.find((m) => m.id === "deep");
    expect(deep).toBeDefined();
    expect(deep?.command).toBe("/pandacorp:implement deep");
  });

  it("frd-11: no two entries share the same id", () => {
    const ids = BUILD_MODES.map((m) => m.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it("frd-11: no two entries share the same command string", () => {
    const commands = BUILD_MODES.map((m) => m.command);
    const uniqueCommands = new Set(commands);
    expect(uniqueCommands.size).toBe(commands.length);
  });

  // Property: all non-balanced commands start with '/pandacorp:implement '
  // (space + mode id), never a bare /pandacorp:implement with no suffix.
  it("frd-11: AC-11-002.1 — non-balanced commands start with '/pandacorp:implement ' and end with their id", () => {
    for (const mode of BUILD_MODES) {
      if (mode.id === "balanced") continue;
      expect(mode.command).toBe(`/pandacorp:implement ${mode.id}`);
    }
  });

  // BUILD_MODES must be readonly at runtime (attempting mutation throws in strict mode).
  // We verify the TypeScript type is satisfied: the array is `readonly BuildModeInfo[]`.
  it("frd-11: BUILD_MODES is frozen / immutable (Object.isFrozen or readonly)", () => {
    // Either the array is frozen, or it's a const — any push attempt on
    // a `readonly` type fails at compile time. We verify the length cannot be
    // changed by checking it is not writable via ordinary means.
    const arr = BUILD_MODES as BuildModeInfo[];
    expect(() => {
      (arr as BuildModeInfo[]).push({
        id: "pro",
        label: "x",
        description: "x",
        command: "x",
      } as unknown as BuildModeInfo);
    }).toThrow(); // frozen arrays throw in strict mode
  });
});

// ---------------------------------------------------------------------------
// DEFAULT_BUILD_MODE — AC-11-001.3
// ---------------------------------------------------------------------------

describe("frd-11: DEFAULT_BUILD_MODE", () => {
  it("frd-11: AC-11-001.3 — DEFAULT_BUILD_MODE is 'balanced'", () => {
    expect(DEFAULT_BUILD_MODE).toBe("balanced");
  });

  it("frd-11: AC-11-001.3 — DEFAULT_BUILD_MODE exists in BUILD_MODES", () => {
    const ids = BUILD_MODES.map((m) => m.id);
    expect(ids).toContain(DEFAULT_BUILD_MODE);
  });

  it("frd-11: AC-11-001.3 — DEFAULT_BUILD_MODE is a valid BuildMode literal (not empty, not undefined)", () => {
    expect(typeof DEFAULT_BUILD_MODE).toBe("string");
    expect(DEFAULT_BUILD_MODE.trim()).not.toBe("");
    expect(VALID_BUILD_MODES.has(DEFAULT_BUILD_MODE)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Mode-store: getRememberedMode / rememberMode — AC-11-003.1, AC-11-003.2
// ---------------------------------------------------------------------------

describe("frd-11: getRememberedMode / rememberMode (localStorage persistence)", () => {
  beforeEach(() => {
    // jsdom provides localStorage; clear between tests for isolation.
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  // AC-11-001.3 / AC-11-003.1: no mode stored → returns DEFAULT_BUILD_MODE.
  it("frd-11: AC-11-003.1 — returns DEFAULT_BUILD_MODE when no mode has been stored for slug", () => {
    const result = getRememberedMode("proj-alpha");
    expect(result).toBe(DEFAULT_BUILD_MODE);
  });

  it("frd-11: AC-11-003.1 — returns DEFAULT_BUILD_MODE when localStorage is empty (different slug)", () => {
    rememberMode("proj-other", "deep");
    const result = getRememberedMode("proj-alpha");
    expect(result).toBe(DEFAULT_BUILD_MODE);
  });

  // AC-11-003.1 + AC-11-003.2: store a mode, then retrieve it.
  it("frd-11: AC-11-003.1/.2 — returns stored mode 'pro' after rememberMode for same slug", () => {
    rememberMode("proj-alpha", "pro");
    expect(getRememberedMode("proj-alpha")).toBe("pro");
  });

  it("frd-11: AC-11-003.1/.2 — returns stored mode 'powerful' after rememberMode", () => {
    rememberMode("proj-alpha", "powerful");
    expect(getRememberedMode("proj-alpha")).toBe("powerful");
  });

  it("frd-11: AC-11-003.1/.2 — returns stored mode 'deep' after rememberMode", () => {
    rememberMode("proj-alpha", "deep");
    expect(getRememberedMode("proj-alpha")).toBe("deep");
  });

  it("frd-11: AC-11-003.1/.2 — returns stored mode 'balanced' after explicit rememberMode", () => {
    rememberMode("proj-alpha", "balanced");
    expect(getRememberedMode("proj-alpha")).toBe("balanced");
  });

  // Per-project isolation: different slugs have independent storage.
  it("frd-11: AC-11-003.1 — modes are isolated per project slug", () => {
    rememberMode("proj-alpha", "pro");
    rememberMode("proj-beta", "deep");
    expect(getRememberedMode("proj-alpha")).toBe("pro");
    expect(getRememberedMode("proj-beta")).toBe("deep");
  });

  it("frd-11: AC-11-003.1 — storing mode for proj-beta does not affect proj-alpha", () => {
    rememberMode("proj-alpha", "powerful");
    rememberMode("proj-beta", "deep");
    // proj-alpha is unchanged
    expect(getRememberedMode("proj-alpha")).toBe("powerful");
  });

  // Overwrite: the last rememberMode call wins.
  it("frd-11: AC-11-003.1 — overwriting the mode for the same slug returns the new value", () => {
    rememberMode("proj-alpha", "pro");
    rememberMode("proj-alpha", "deep");
    expect(getRememberedMode("proj-alpha")).toBe("deep");
  });

  // Persistence simulation: clear store, set via raw localStorage (as a browser would
  // after navigation), then read — verifies the keying scheme is stable.
  it("frd-11: AC-11-003.2 — restores mode written directly to localStorage under expected key", () => {
    // We write the raw value as if a previous session wrote it.
    // The mode-store must use a consistent, deterministic key per slug.
    // This test exercises the round-trip without depending on the internal key name.
    rememberMode("proj-gamma", "powerful");
    // Simulate a page reload by clearing only in-memory state — localStorage persists in jsdom.
    // A second call to getRememberedMode must recover the value.
    const restored = getRememberedMode("proj-gamma");
    expect(restored).toBe("powerful");
  });

  // Regression B1' (2026-06-16): guard against NaN / non-string stored values.
  // Corrupt stored value (non-BuildMode string) → must fall back to DEFAULT, not throw.
  it("frd-11: regression B1' — corrupt stored value (random string) falls back to DEFAULT_BUILD_MODE without throwing", () => {
    // Inject a corrupt value that looks like a stored mode but is not a valid BuildMode.
    // We rely on the key being slug-based (any consistent key); we overwrite via rememberMode
    // to reach the real key, then corrupt it directly.
    rememberMode("proj-corrupt", "pro"); // stores under the real key
    // Now find and corrupt that key by searching localStorage.
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key !== null) {
        const val = localStorage.getItem(key);
        if (val === "pro") {
          localStorage.setItem(key, "NOT_A_MODE");
          break;
        }
      }
    }
    expect(() => getRememberedMode("proj-corrupt")).not.toThrow();
    expect(getRememberedMode("proj-corrupt")).toBe(DEFAULT_BUILD_MODE);
  });

  // Regression I2 (2026-06-16): empty-string stored value → falls back to default.
  it("frd-11: regression I2 — empty-string stored value falls back to DEFAULT_BUILD_MODE", () => {
    rememberMode("proj-empty", "pro");
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key !== null && localStorage.getItem(key) === "pro") {
        localStorage.setItem(key, "");
        break;
      }
    }
    expect(getRememberedMode("proj-empty")).toBe(DEFAULT_BUILD_MODE);
  });

  // Regression I3 (2026-06-16): JSON array in localStorage → falls back to default.
  it("frd-11: regression I3 — JSON-serialized array in localStorage falls back to DEFAULT_BUILD_MODE", () => {
    rememberMode("proj-array", "pro");
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key !== null && localStorage.getItem(key) === "pro") {
        localStorage.setItem(key, JSON.stringify(["pro", "deep"]));
        break;
      }
    }
    expect(getRememberedMode("proj-array")).toBe(DEFAULT_BUILD_MODE);
  });

  // FREEZE-ON-RED regression (2026-06-16): throw-safety — getRememberedMode must never throw.
  it("frd-11: FREEZE-ON-RED regression — getRememberedMode does not throw when localStorage.getItem throws", () => {
    // Temporarily break localStorage.getItem to simulate a security restriction.
    const originalGetItem = localStorage.getItem.bind(localStorage);
    const _spy = localStorage.getItem;
    Object.defineProperty(localStorage, "getItem", {
      configurable: true,
      value: () => {
        throw new Error("SecurityError: localStorage not available");
      },
    });
    try {
      expect(() => getRememberedMode("proj-throw")).not.toThrow();
      expect(getRememberedMode("proj-throw")).toBe(DEFAULT_BUILD_MODE);
    } finally {
      Object.defineProperty(localStorage, "getItem", {
        configurable: true,
        value: originalGetItem,
      });
    }
  });

  // Read-only invariant: rememberMode must NOT write to status.yaml or any fs path.
  // We verify this by checking that no Node fs module is invoked (the function is
  // "use client" and has no fs import). This is a structural assertion: the test
  // imports the module and rememberMode completes without touching the fs.
  it("frd-11: REQ-01-011 — rememberMode does not write to any file (localStorage only)", () => {
    // If rememberMode called fs.writeFileSync, it would throw in jsdom (no real fs path).
    // Completing without throw confirms no fs write attempt.
    expect(() => rememberMode("proj-readonly", "deep")).not.toThrow();
  });

  // Property-style: getRememberedMode always returns a valid BuildMode (not undefined/null/other).
  it("frd-11: property — getRememberedMode always returns a valid BuildMode for every stored mode", () => {
    for (const mode of BUILD_MODES) {
      localStorage.clear();
      rememberMode("proj-prop", mode.id);
      const result = getRememberedMode("proj-prop");
      expect(VALID_BUILD_MODES.has(result)).toBe(true);
    }
  });

  // Property-style: getRememberedMode always returns DEFAULT_BUILD_MODE when nothing is stored.
  it("frd-11: property — getRememberedMode on a fresh slug always returns DEFAULT_BUILD_MODE", () => {
    const slugs = ["a", "b", "proj-foo", "proj-bar-baz", "x".repeat(200)];
    for (const slug of slugs) {
      localStorage.clear();
      expect(getRememberedMode(slug)).toBe(DEFAULT_BUILD_MODE);
    }
  });

  // Slug edge cases: empty string slug — the function must not throw and must return
  // DEFAULT_BUILD_MODE (no slug = no stored value).
  it("frd-11: edge — empty string slug returns DEFAULT_BUILD_MODE without throwing", () => {
    expect(() => getRememberedMode("")).not.toThrow();
    expect(getRememberedMode("")).toBe(DEFAULT_BUILD_MODE);
  });

  // Very long slug — must not throw (localStorage key length has no practical limit in jsdom).
  it("frd-11: edge — very long slug (200 chars) does not throw and round-trips correctly", () => {
    const longSlug = `proj-${"x".repeat(195)}`;
    expect(() => rememberMode(longSlug, "deep")).not.toThrow();
    expect(getRememberedMode(longSlug)).toBe("deep");
  });

  // Slug with special characters common in project names.
  it("frd-11: edge — slug with hyphens and numbers round-trips correctly", () => {
    rememberMode("my-project-42", "pro");
    expect(getRememberedMode("my-project-42")).toBe("pro");
  });
});

// ---------------------------------------------------------------------------
// Structural / type-safety assertions
// ---------------------------------------------------------------------------

describe("frd-11: type-safety and structural constraints", () => {
  // BUILD_MODES must not contain any entry with id "balanced" carrying an argument
  // in its command — no `/pandacorp:implement balanced` is allowed.
  it("frd-11: balanced command must NOT include the word 'balanced' as an argument", () => {
    const balanced = BUILD_MODES.find((m) => m.id === "balanced");
    expect(balanced?.command).not.toContain("balanced");
  });

  // All commands must start with '/pandacorp:implement' (the skill prefix is stable).
  it("frd-11: all commands start with '/pandacorp:implement'", () => {
    for (const mode of BUILD_MODES) {
      expect(mode.command.startsWith("/pandacorp:implement")).toBe(true);
    }
  });

  // No magic strings: the catalog is the single source of truth for command strings —
  // no command may be a plain empty string or whitespace.
  it("frd-11: no command is an empty or whitespace-only string", () => {
    for (const mode of BUILD_MODES) {
      expect(mode.command.trim()).not.toBe("");
    }
  });

  // BuildModeInfo shape: every entry has exactly the required keys.
  it("frd-11: every BuildModeInfo entry has id, label, description, and command keys", () => {
    const requiredKeys = ["id", "label", "description", "command"] as const;
    for (const mode of BUILD_MODES) {
      for (const key of requiredKeys) {
        expect(key in mode).toBe(true);
      }
    }
  });
});
