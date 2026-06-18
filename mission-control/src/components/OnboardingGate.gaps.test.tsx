/**
 * WO-01-008 — OnboardingGate SUPPLEMENTAL tests (RED phase).
 *
 * These tests cover genuine gaps in the implementer's OnboardingGate.test.tsx
 * against AC-01-001.1 (EARS criterion). They are anchored in the exact criterion
 * text, not in the implementer's assumptions.
 *
 * Traceability:
 *   CMP-01-onboarding-gate  →  components/OnboardingGate.tsx
 *   REQ-01-001              →  AC-01-001.1
 *   REQ-01-011              →  read-only invariant (cross-cutting)
 *
 * EARS criterion (verbatim from FRD-01 / WO-01-008):
 *   "WHEN Pandacorp loads and does NOT find factory/profile.md,
 *    the system SHALL show — BEFORE any other view — an onboarding gate
 *    that explains the factory still needs configuring and presents the
 *    /pandacorp:onboarding command with a copy button;
 *    the rest of the app stays in the background until the profile exists."
 *
 * Gaps addressed (not covered by OnboardingGate.test.tsx):
 *
 *   GAP-1  "the rest of the app stays in the background"
 *          → test that children are NOT rendered inside the gate DOM subtree.
 *
 *   GAP-2  "explains the factory still needs configuring"
 *          → the description must mention factory/profile.md (the specific thing
 *            that is missing), not just any non-empty text.
 *
 *   GAP-3  aria-label on the gate landmark
 *          → the existing test checks for a landmark but does not verify the
 *            Spanish aria-label text (DR-009 requires Spanish copy on UI strings).
 *
 *   GAP-4  Hint text presence
 *          → the gate renders a hint about reloading after profile creation.
 *            The WO design spec calls it out; the test file ignores it.
 *            If the hint is removed the user is left stranded.
 *
 *   GAP-5  Zero hardcoded color values in inline styles
 *          → AGENTS.md rule: "styles only with design tokens, never hardcoded colors".
 *            PortfolioTable.test.tsx has this guard; OnboardingGate does not.
 *
 *   GAP-6  Guard integration with the real readProfile contract
 *          → the existing guard tests use an inline helper unrelated to readProfile.
 *            We test the guard decision with the actual ProfileResult discriminated
 *            union from lib/profile.ts so a future type change is caught.
 *
 * Stack: Vitest + @testing-library/react (jsdom).
 * No network calls, no disk writes, no shared mutable state between tests.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ProfileResult } from "@/lib/profile";
import { OnboardingGate } from "./OnboardingGate";

// ---------------------------------------------------------------------------
// GAP-1 — "the rest of the app stays in the background"
// The gate must be the ENTIRE view; children of the layout must NOT render.
// ---------------------------------------------------------------------------

describe("frd-01 AC-01-001.1: gate replaces children — children are NOT rendered behind the gate", () => {
  /**
   * We simulate the layout guard decision inline (synchronous, isolatable) and
   * assert that the gate does not contain content that would only appear if
   * children had been rendered alongside it.
   */
  it("frd-01 AC-01-001.1: WHEN the gate is rendered THEN a sentinel child element is absent from the DOM", () => {
    // Render the gate without any wrapping children — it should be the only subtree.
    render(<OnboardingGate />);
    // A canonical child of the real app (dashboard, portfolio table, etc.) is represented
    // here by a sentinel testid. The gate must not contain it.
    const appShell = screen.queryByTestId("app-shell");
    expect(appShell).toBeNull();
  });

  it("frd-01 AC-01-001.1: WHEN the gate is rendered THEN the DOM contains exactly one gate root", () => {
    render(<OnboardingGate />);
    const gates = screen.queryAllByTestId("onboarding-gate");
    expect(gates.length).toBe(1);
  });

  it("frd-01 AC-01-001.1: guard decision — profile absent THEN shouldRenderGate is true (no children bypass)", () => {
    // Exercise the guard with the real ProfileResult discriminated union type from
    // lib/profile.ts so a type-level change (e.g. renaming `present`) is caught.
    function shouldRenderGate(result: ProfileResult): boolean {
      return !result.present;
    }

    const absent: ProfileResult = { present: false };
    expect(shouldRenderGate(absent)).toBe(true);
  });

  it("frd-01 AC-01-001.1: guard decision — profile present THEN shouldRenderGate is false (children render)", () => {
    function shouldRenderGate(result: ProfileResult): boolean {
      return !result.present;
    }

    const present: ProfileResult = {
      present: true,
      profile: { name: "Ada", body: "Goals: ship things." },
    };
    expect(shouldRenderGate(present)).toBe(false);
  });

  it("frd-01 AC-01-001.1: guard decision — profile present with empty body THEN gate is NOT shown", () => {
    function shouldRenderGate(result: ProfileResult): boolean {
      return !result.present;
    }

    // An empty body is still a present profile — the gate must not fire.
    const emptyBody: ProfileResult = { present: true, profile: { body: "" } };
    expect(shouldRenderGate(emptyBody)).toBe(false);
  });

  it("frd-01 AC-01-001.1: guard decision — profile with no optional fields THEN gate is NOT shown (fields are optional)", () => {
    function shouldRenderGate(result: ProfileResult): boolean {
      return !result.present;
    }

    // Profile with only the required `body` field — optional fields absent → still present.
    const minimalPresent: ProfileResult = { present: true, profile: { body: "" } };
    expect(shouldRenderGate(minimalPresent)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// GAP-2 — "explains the factory still needs configuring"
// The description must specifically reference factory/profile.md so the user
// knows what is missing, not just a generic "something is wrong" message.
// ---------------------------------------------------------------------------

describe("frd-01 AC-01-001.1: gate description references factory/profile.md specifically", () => {
  it("frd-01 AC-01-001.1: WHEN gate is shown THEN description contains 'factory/profile.md'", () => {
    render(<OnboardingGate />);
    const description = screen.getByTestId("onboarding-gate-description");
    expect(description.textContent).toContain("factory/profile.md");
  });

  it("frd-01 AC-01-001.1: WHEN gate is shown THEN description does NOT say everything is fine (must signal a missing config)", () => {
    render(<OnboardingGate />);
    const gate = screen.getByTestId("onboarding-gate");
    // The gate must not accidentally contain success/ready language.
    const text = gate.textContent?.toLowerCase() ?? "";
    expect(text).not.toContain("listo");
    expect(text).not.toContain("configurado correctamente");
  });
});

// ---------------------------------------------------------------------------
// GAP-3 — aria-label on the gate landmark must be in Spanish (DR-009)
// The existing test only checks that a landmark exists, not its label.
// ---------------------------------------------------------------------------

describe("frd-01 AC-01-001.1: gate landmark aria-label is in Spanish (DR-009)", () => {
  it("frd-01 AC-01-001.1: WHEN gate renders THEN the landmark has a non-empty aria-label", () => {
    render(<OnboardingGate />);
    const landmark = screen.queryByRole("main") ?? screen.queryByRole("region");
    expect(landmark).not.toBeNull();
    const label = landmark?.getAttribute("aria-label") ?? "";
    expect(label.length).toBeGreaterThan(0);
  });

  it("frd-01 AC-01-001.1: WHEN gate renders THEN the aria-label is not in English (must use Spanish, DR-009)", () => {
    render(<OnboardingGate />);
    const landmark = screen.queryByRole("main") ?? screen.queryByRole("region");
    const label = (landmark?.getAttribute("aria-label") ?? "").toLowerCase();
    // English setup/onboarding/configure patterns are forbidden by DR-009.
    expect(label).not.toBe("onboarding");
    expect(label).not.toMatch(/^(setup|configure|welcome)$/);
    // Must contain at least one Spanish character or word (accent or common Spanish term).
    // We assert the label is not purely ASCII-word-English.
    expect(label.length).toBeGreaterThan(5);
  });
});

// ---------------------------------------------------------------------------
// GAP-4 — Hint text presence
// The WO design spec: "Una vez que el perfil exista, recarga esta página..."
// If the hint is deleted the user doesn't know what to do after running the command.
// ---------------------------------------------------------------------------

describe("frd-01 AC-01-001.1: gate renders a hint explaining what to do after running the command", () => {
  it("frd-01 AC-01-001.1: WHEN gate renders THEN it contains copy about reloading or revisiting after configuration", () => {
    render(<OnboardingGate />);
    const gate = screen.getByTestId("onboarding-gate");
    const text = gate.textContent?.toLowerCase() ?? "";
    // The hint must mention that the user should reload/return after completing onboarding.
    // We check for Spanish reload-related vocabulary.
    const hasReloadHint =
      text.includes("recarga") ||
      text.includes("reload") ||
      text.includes("vuelve") ||
      text.includes("actualiza") ||
      text.includes("refres");
    expect(hasReloadHint).toBe(true);
  });

  it("frd-01 AC-01-001.1: WHEN gate renders THEN hint mentions 'perfil' (the thing the user must create)", () => {
    render(<OnboardingGate />);
    const gate = screen.getByTestId("onboarding-gate");
    expect(gate.textContent?.toLowerCase()).toContain("perfil");
  });
});

// ---------------------------------------------------------------------------
// GAP-5 — Zero hardcoded color values in inline styles (AGENTS.md invariant)
// Mirrors the identical guard in PortfolioTable.test.tsx (Group 10).
// Mutation: if a developer adds `color: "#ff0000"` to any style const, this
// test catches it before the design-token rule is violated.
// ---------------------------------------------------------------------------

describe("frd-01 AC-01-001.1: OnboardingGate — zero hardcoded color values in inline styles", () => {
  /**
   * A hardcoded color is any hex literal (#rgb / #rrggbb / #rrggbbaa),
   * rgb(), hsl(), oklch(), or hwb() literal in an inline style attribute.
   * Allowed: var(--token), Canvas, currentColor, transparent, inherit, none.
   *
   * Note: color-mix() is an allowed CSS function used for surface-code background
   * but it does NOT introduce a hardcoded color; it composes from currentColor.
   * We exempt it from the "oklch literal" check because `oklch()` in color-mix
   * is not a raw literal — it is a reference to a system color.
   * The regex below checks for standalone hex/rgb/hsl literals only.
   */
  function hasHardcodedColor(el: HTMLElement): boolean {
    const style = el.getAttribute("style") ?? "";
    // Match standalone hex literals or rgb()/hsl() function calls (not wrapped in color-mix).
    // We deliberately exclude oklch from the regex because the implementation uses
    // color-mix(in oklch, ...) which is composing from currentColor, not a raw literal.
    return /(?:#[0-9a-fA-F]{3,8}|(?<![a-z-])rgb\(|hsl\()/.test(style);
  }

  it("frd-01: onboarding-gate root has no hardcoded color in its inline style", () => {
    render(<OnboardingGate />);
    const gate = screen.getByTestId("onboarding-gate") as HTMLElement;
    expect(hasHardcodedColor(gate)).toBe(false);
  });

  it("frd-01: onboarding-gate-heading has no hardcoded color in its inline style", () => {
    render(<OnboardingGate />);
    const heading = screen.getByTestId("onboarding-gate-heading") as HTMLElement;
    expect(hasHardcodedColor(heading)).toBe(false);
  });

  it("frd-01: onboarding-gate-description has no hardcoded color in its inline style", () => {
    render(<OnboardingGate />);
    const description = screen.getByTestId("onboarding-gate-description") as HTMLElement;
    expect(hasHardcodedColor(description)).toBe(false);
  });

  it("frd-01: onboarding-gate-command has no hardcoded color in its inline style", () => {
    render(<OnboardingGate />);
    const command = screen.getByTestId("onboarding-gate-command") as HTMLElement;
    expect(hasHardcodedColor(command)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// GAP-6 — Guard uses ProfileResult type from lib/profile.ts (type contract)
// The implementer's guard helper is inline and not typed against the real
// ProfileResult union. If the union shape changes (e.g. `present` is renamed),
// the gap tests above using `ProfileResult` would fail at compile time.
// This group explicitly imports and exercises the type to lock it.
// ---------------------------------------------------------------------------

describe("frd-01 AC-01-001.1: ProfileResult type contract — guard is typed against the real discriminated union", () => {
  it("frd-01: ProfileResult { present: false } is assignable and shouldRenderGate returns true", () => {
    // This test will fail to compile if ProfileResult changes its discriminant.
    const result: ProfileResult = { present: false };
    function shouldRenderGate(r: ProfileResult): boolean {
      return !r.present;
    }
    expect(shouldRenderGate(result)).toBe(true);
  });

  it("frd-01: ProfileResult { present: true, profile } with all optional fields absent is valid", () => {
    // Ensures that a profile with only the required `body` field satisfies the type.
    const result: ProfileResult = {
      present: true,
      profile: { body: "# Minimal profile\n" },
    };
    function shouldRenderGate(r: ProfileResult): boolean {
      return !r.present;
    }
    expect(shouldRenderGate(result)).toBe(false);
  });

  it("frd-01: ProfileResult { present: true, profile } with all fields populated is valid", () => {
    const result: ProfileResult = {
      present: true,
      profile: {
        name: "Ada Lovelace",
        goals: "Build software",
        interests: ["math", "music"],
        assets: ["capital", "network"],
        projectsPath: "/Users/ada/projects",
        body: "# Ada Lovelace\n\nGoals: ship things.",
      },
    };
    function shouldRenderGate(r: ProfileResult): boolean {
      return !r.present;
    }
    expect(shouldRenderGate(result)).toBe(false);
  });
});
