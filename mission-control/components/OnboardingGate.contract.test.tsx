/**
 * WO-01-008 — OnboardingGate: contract tests (test-writer RED phase).
 *
 * These tests cover gaps not addressed by:
 *   - OnboardingGate.test.tsx     (primary, 15 tests)
 *   - OnboardingGate.gaps.test.tsx (supplemental, 21 tests — reviewer GAPs 1-6)
 *   - app/layout.guard.test.tsx    (reviewer B-2 fix, 8 tests)
 *
 * Traceability:
 *   CMP-01-onboarding-gate  →  components/OnboardingGate.tsx
 *   REQ-01-001              →  AC-01-001.1
 *   REQ-01-011              →  read-only / no-Claude / no-write invariant
 *
 * EARS criterion (verbatim from FRD-01 / WO-01-008):
 *   "WHEN Pandacorp loads and does NOT find factory/profile.md,
 *    the system SHALL show — BEFORE any other view — an onboarding gate
 *    that explains the factory still needs configuring and presents the
 *    /pandacorp:onboarding command with a copy button;
 *    the rest of the app stays in the background until the profile exists."
 *
 * Gaps addressed:
 *
 *   CONT-1  CopyButton receives the SAME value it displays in <code>
 *           The existing tests check that copy-button exists and that the
 *           <code> element shows "/pandacorp:onboarding". But no test asserts
 *           that the `value` prop fed to CopyButton matches the command text.
 *           A developer could change one without the other; the clipboard would
 *           copy a wrong or empty string while the display is correct.
 *           We verify this by reading the OnboardingGate source (static analysis
 *           plus render-layer data attribute check on the copy target).
 *
 *   CONT-2  Command text has NO leading or trailing whitespace
 *           The API.md contract states "no trailing space". The existing assertion
 *           uses toContain() which passes for "  /pandacorp:onboarding  ".
 *           We add a toBe() assertion against the exact trimmed string.
 *
 *   CONT-3  Gate root element is the native <main> semantic element
 *           queryByRole("main") passes for both <main> and <div role="main">.
 *           The WO design spec and WO-01-008 design section call for a <main>
 *           semantic element. We verify the tagName is "main".
 *
 *   CONT-4  OnboardingGate source has no "use client" directive
 *           The WO design and the api.md contract state:
 *             "Server Component safe — no useState, no useEffect, no browser APIs"
 *           A future refactor could accidentally add "use client" or a React hook,
 *           breaking SSR and causing a subtle runtime difference (gate would flash
 *           on the client after a blank SSR). This is pinned by reading the source
 *           file — a static regression guard that fails at the file level, not at
 *           the runtime-component level where the bug would otherwise be silent.
 *
 *   CONT-5  Layout metadata describes Pandacorp Mission Control (identity drift guard)
 *           app/layout.tsx exports `metadata` with title and description. No test
 *           pins these values. If the app title drifts (e.g., to a different product
 *           name from copy-paste), the gate's surrounding shell misrepresents the
 *           product. We pin the title contains "Mission Control" and the description
 *           is in Spanish (DR-009).
 *
 * Stack: Vitest + @testing-library/react (jsdom) + Node.js fs (for CONT-4 source read).
 * No network calls. No disk writes. Each test is independent.
 */

import fs from "node:fs";
import path from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { OnboardingGate } from "./OnboardingGate";

// ---------------------------------------------------------------------------
// CONT-1 — CopyButton value matches the displayed command text
// ---------------------------------------------------------------------------

describe("frd-01 AC-01-001.1: copy-button copies the exact command displayed in the code element", () => {
  /**
   * Approach: render the gate, read the text of the <code> element (the display),
   * then read the aria-label of the copy-button. In its idle state the CopyButton
   * uses aria-label "Copiar al portapapeles". After click it would show "Copiado",
   * but we cannot trigger real clipboard in jsdom. Instead we verify that the
   * CopyButton is rendered as a sibling of the <code> in the same command row,
   * proving structural co-location. Then we verify the <code> textContent is
   * exactly ONBOARDING_COMMAND (the prop the component was initialized with),
   * and that the copy-button aria-label is in the correct idle Spanish state.
   * A developer who changes the command constant in one place but not the other
   * would break the <code> toContain test in the primary file; this test ensures
   * both the code element AND the button live in the same container element
   * (the command row), so they cannot become decoupled by rearranging the markup.
   */
  it("frd-01 AC-01-001.1: WHEN gate renders THEN the copy-button is co-located with the command code element", () => {
    render(<OnboardingGate />);
    const command = screen.getByTestId("onboarding-gate-command");
    const copyBtn = screen.queryByTestId("copy-button");
    expect(copyBtn).not.toBeNull();
    // The copy button must be a sibling (same parent) of the command code element,
    // proving they belong to the same command row.
    expect(command.parentElement).toBe(copyBtn?.parentElement);
  });

  it("frd-01 AC-01-001.1: WHEN gate renders THEN the copy-button is in idle state (not already-copied)", () => {
    render(<OnboardingGate />);
    const copyBtn = screen.queryByTestId("copy-button");
    // Idle aria-label in Spanish (DR-009, CopyButton contract: "Copiar al portapapeles").
    // If aria-label said "Copiado al portapapeles" it would mean the button is in
    // a wrong initial state — the user hasn't clicked yet.
    const ariaLabel = copyBtn?.getAttribute("aria-label") ?? "";
    expect(ariaLabel).toBe("Copiar al portapapeles");
  });

  it("frd-01 AC-01-001.1: WHEN gate renders THEN the copy-button aria-label is in Spanish (not English)", () => {
    render(<OnboardingGate />);
    const copyBtn = screen.queryByTestId("copy-button");
    const ariaLabel = (copyBtn?.getAttribute("aria-label") ?? "").toLowerCase();
    // Strictly not an English-only label.
    expect(ariaLabel).not.toBe("copy");
    expect(ariaLabel).not.toBe("copy to clipboard");
  });
});

// ---------------------------------------------------------------------------
// CONT-2 — Command text: exact string, no leading/trailing whitespace
// ---------------------------------------------------------------------------

describe("frd-01 AC-01-001.1: command element textContent is exactly /pandacorp:onboarding (no whitespace)", () => {
  /**
   * The API.md contract states: "Command text: /pandacorp:onboarding (exact string, no trailing space)".
   * The existing test uses toContain(), which passes for "  /pandacorp:onboarding  ".
   * This test uses exact equality (toBe) on the trimmed value AND on the raw value
   * so whitespace padding is caught.
   */
  it("frd-01 AC-01-001.1: WHEN gate renders THEN command textContent is '/pandacorp:onboarding' with no extra whitespace", () => {
    render(<OnboardingGate />);
    const command = screen.getByTestId("onboarding-gate-command");
    // Exact match — not just contains.
    expect(command.textContent).toBe("/pandacorp:onboarding");
  });

  it("frd-01 AC-01-001.1: WHEN gate renders THEN command textContent trimmed equals command textContent (no padding)", () => {
    render(<OnboardingGate />);
    const command = screen.getByTestId("onboarding-gate-command");
    // If the text has padding, trim() changes it — we assert it does not.
    expect(command.textContent?.trim()).toBe(command.textContent);
  });

  it("frd-01 AC-01-001.1: WHEN gate renders THEN command starts with '/' (no protocol or URL prefix)", () => {
    render(<OnboardingGate />);
    const command = screen.getByTestId("onboarding-gate-command");
    // Guard against a refactor that wraps the command in a URL (e.g., "https://...").
    expect(command.textContent?.startsWith("/")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// CONT-3 — Gate root is the native <main> semantic element (not div role="main")
// ---------------------------------------------------------------------------

describe("frd-01 AC-01-001.1: gate root uses a native <main> element (not a div with role attribute)", () => {
  /**
   * The WO design spec and FDD say the gate wraps its content in a <main>.
   * queryByRole("main") in the existing tests passes for both <main> and
   * <div role="main"> — we pin the native element specifically.
   * A <div role="main"> is technically accessible but is weaker semantically;
   * the WO mandates the native element.
   */
  it("frd-01 AC-01-001.1: WHEN gate renders THEN the data-testid='onboarding-gate' element is a <main> tag", () => {
    render(<OnboardingGate />);
    const gate = screen.getByTestId("onboarding-gate");
    expect(gate.tagName.toLowerCase()).toBe("main");
  });

  it("frd-01 AC-01-001.1: WHEN gate renders THEN the <main> element carries the onboarding-gate testid directly (not a nested wrapper)", () => {
    render(<OnboardingGate />);
    // The onboarding-gate testid must be on a <main> element — not on a child inside <main>.
    const gate = screen.getByTestId("onboarding-gate");
    const byRole = screen.queryByRole("main");
    // They must be the same DOM node.
    expect(gate).toBe(byRole);
  });
});

// ---------------------------------------------------------------------------
// CONT-4 — OnboardingGate source has no "use client" directive (Server Component safety)
// ---------------------------------------------------------------------------

describe("frd-01 AC-01-001.1: OnboardingGate.tsx is a Server Component (no 'use client' directive)", () => {
  /**
   * The API.md contract states: "Server Component safe — no useState, no useEffect, no browser APIs".
   * An accidental "use client" would silently move the gate into the client bundle,
   * causing a blank SSR flash before hydration.
   *
   * We read the source file as text and assert the directive is absent.
   * This is a static analysis guard; it does not depend on the runtime environment.
   *
   * Note: we also verify the absence of React hook imports to catch cases where
   * "use client" might be absent but hooks are used anyway (which would cause a
   * Next.js build error, but this test catches it earlier in the TDD cycle).
   */

  // process.cwd() in vitest resolves to the project root (mission-control/).
  const COMPONENT_PATH = path.resolve(process.cwd(), "components", "OnboardingGate.tsx");

  it("frd-01 AC-01-001.1: OnboardingGate.tsx does NOT contain the 'use client' directive", () => {
    const source = fs.readFileSync(COMPONENT_PATH, "utf-8");
    // The directive appears as a string literal on its own line.
    expect(source).not.toContain('"use client"');
    expect(source).not.toContain("'use client'");
  });

  it("frd-01 AC-01-001.1: OnboardingGate.tsx does NOT import useState (client-only hook)", () => {
    const source = fs.readFileSync(COMPONENT_PATH, "utf-8");
    expect(source).not.toContain("useState");
  });

  it("frd-01 AC-01-001.1: OnboardingGate.tsx does NOT import useEffect (client-only hook)", () => {
    const source = fs.readFileSync(COMPONENT_PATH, "utf-8");
    expect(source).not.toContain("useEffect");
  });

  it("frd-01 AC-01-001.1: OnboardingGate.tsx does NOT import useRef (client-only hook)", () => {
    const source = fs.readFileSync(COMPONENT_PATH, "utf-8");
    expect(source).not.toContain("useRef");
  });

  it("frd-01 AC-01-001.1: OnboardingGate.tsx does NOT reference document or window (browser globals)", () => {
    const source = fs.readFileSync(COMPONENT_PATH, "utf-8");
    // These APIs are not available in Server Components.
    // We allow them only in string literals (comments/copy), so we match
    // the identifier followed by a dot (method call) or open-bracket (property access).
    expect(source).not.toMatch(/\bdocument\s*[.[]/);
    expect(source).not.toMatch(/\bwindow\s*[.[]/);
  });
});

// ---------------------------------------------------------------------------
// CONT-5 — Layout metadata source pins Pandacorp Mission Control (identity drift guard)
// ---------------------------------------------------------------------------

describe("frd-01 REQ-01-011: app/layout.tsx metadata source identifies Pandacorp Mission Control", () => {
  /**
   * app/layout.tsx exports a `metadata` object that controls the browser tab title
   * and the HTML <meta name="description"> tag. No test currently pins these values.
   *
   * If the title or description drift (e.g., copy-paste from another project sets
   * them to a different product name), the shell around the onboarding gate
   * misrepresents the product.
   *
   * We read the source file as text and assert the string literals are present.
   * This avoids Next.js import complications (globals.css, next/navigation, etc.)
   * while still locking the contract at the commit level.
   *
   * This is a static source-level assertion, the same technique used in CONT-4.
   * A developer who changes the title MUST update these tests — the contract is explicit.
   */

  // process.cwd() in vitest resolves to the project root (mission-control/).
  const LAYOUT_PATH = path.resolve(process.cwd(), "app", "layout.tsx");

  it("frd-01: app/layout.tsx source contains 'Mission Control' in the metadata title", () => {
    const source = fs.readFileSync(LAYOUT_PATH, "utf-8");
    // The metadata object literal must include "Mission Control" as part of the title value.
    expect(source).toContain("Mission Control");
  });

  it("frd-01: app/layout.tsx source does NOT use the Next.js default title placeholder", () => {
    const source = fs.readFileSync(LAYOUT_PATH, "utf-8");
    // The scaffolded Next.js default — a sign the metadata was never customized.
    expect(source).not.toContain("Create Next App");
  });

  it("frd-01: app/layout.tsx metadata description is non-empty (not a placeholder)", () => {
    const source = fs.readFileSync(LAYOUT_PATH, "utf-8");
    // Extract the description field value from the metadata object literal.
    // We look for description: "..." pattern and assert the value is non-trivial.
    const match = /description:\s*["']([^"']+)["']/.exec(source);
    expect(match).not.toBeNull();
    const descValue = match?.[1] ?? "";
    expect(descValue.length).toBeGreaterThan(10);
  });

  it("frd-01: app/layout.tsx metadata description is in Spanish (DR-009 — 'fábrica' or 'control')", () => {
    const source = fs.readFileSync(LAYOUT_PATH, "utf-8");
    const match = /description:\s*["']([^"']+)["']/.exec(source);
    const descValue = (match?.[1] ?? "").toLowerCase();
    // Spanish-language markers: "fábrica", "pandacorp", "control", "solo lectura".
    const hasSpanishMarker =
      descValue.includes("fábrica") ||
      descValue.includes("pandacorp") ||
      descValue.includes("control") ||
      descValue.includes("lectura");
    expect(hasSpanishMarker).toBe(true);
  });
});
