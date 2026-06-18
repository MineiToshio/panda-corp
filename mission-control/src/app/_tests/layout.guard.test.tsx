/**
 * WO-01-008 — REAL layout guard tests (reviewer / DR-015 adversarial, DR-016 mutation-killing).
 *
 * Why this file exists:
 *   The implementer's OnboardingGate.test.tsx and OnboardingGate.gaps.test.tsx
 *   "test the guard" by RE-IMPLEMENTING a `shouldShowGate(result)` / `shouldRenderGate(result)`
 *   helper INSIDE the test file. That helper does not exist in app/layout.tsx and is never
 *   imported from it. As a result the single load-bearing decision of this work order
 *   (profile absent → gate; profile present → children) is NOT covered: inverting the
 *   condition in app/layout.tsx leaves the entire suite green (verified by the reviewer).
 *
 * This file exercises the ACTUAL `RootLayout` from app/layout.tsx, driving the real
 * `readProfile()` against a real temp filesystem via PANDACORP_FACTORY_ROOT, and asserts
 * which branch RootLayout actually selected. Inverting the guard line MUST turn these red.
 *
 * Traceability:
 *   CMP-01-onboarding-gate (layout guard) → REQ-01-001 → AC-01-001.1
 *   REQ-01-011 (read-only invariant)
 *
 * Approach:
 *   RootLayout is a Server Component returning <html><body>{branch}</body></html>.
 *   jsdom cannot mount a nested <html>, so instead of rendering we invoke RootLayout()
 *   as a pure function and walk the returned React element tree to discover whether the
 *   <OnboardingGate /> element or the `children` sentinel was placed in <body>.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { isValidElement, type ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { OnboardingGate } from "@/app/_components/OnboardingGate/OnboardingGate";
import RootLayout from "../layout";

// ---------------------------------------------------------------------------
// Temp factory root helpers
// ---------------------------------------------------------------------------

let tmpRoot: string;
const ORIGINAL_ENV = process.env.PANDACORP_FACTORY_ROOT;

beforeEach(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mc-layout-guard-"));
  fs.mkdirSync(path.join(tmpRoot, "factory"), { recursive: true });
  process.env.PANDACORP_FACTORY_ROOT = tmpRoot;
});

afterEach(() => {
  if (ORIGINAL_ENV === undefined) {
    delete process.env.PANDACORP_FACTORY_ROOT;
  } else {
    process.env.PANDACORP_FACTORY_ROOT = ORIGINAL_ENV;
  }
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

function writeProfile(contents: string): void {
  fs.writeFileSync(path.join(tmpRoot, "factory", "profile.md"), contents, "utf-8");
}

// ---------------------------------------------------------------------------
// Tree walking — find what RootLayout placed inside <body>
// ---------------------------------------------------------------------------

/** Depth-first search over a React element tree for a node whose `type` matches `predicate`. */
function findNode(node: unknown, predicate: (el: ReactElement) => boolean): ReactElement | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findNode(child, predicate);
      if (found) return found;
    }
    return null;
  }
  if (!isValidElement(node)) return null;
  const el = node as ReactElement;
  if (predicate(el)) return el;
  const props = el.props as { children?: unknown };
  return findNode(props.children, predicate);
}

function renderedGate(tree: ReactElement): boolean {
  return findNode(tree, (el) => el.type === OnboardingGate) !== null;
}

function renderedChildren(tree: ReactElement, sentinelType: unknown): boolean {
  return findNode(tree, (el) => el.type === sentinelType) !== null;
}

// A unique sentinel component standing in for the real app shell (children).
function AppShellSentinel(): React.JSX.Element {
  return <div data-testid="app-shell-sentinel" />;
}

// ---------------------------------------------------------------------------
// The guard contract (these tests must die if app/layout.tsx inverts the branch)
// ---------------------------------------------------------------------------

describe("frd-01 AC-01-001.1: REAL RootLayout guard (kills the inverted-condition mutant)", () => {
  it("WHEN factory/profile.md is ABSENT THEN RootLayout renders the OnboardingGate", () => {
    // No profile written → readProfile() → { present: false }.
    const tree = RootLayout({ children: <AppShellSentinel /> }) as ReactElement;
    expect(renderedGate(tree)).toBe(true);
  });

  it("WHEN factory/profile.md is ABSENT THEN RootLayout does NOT render the app children", () => {
    const tree = RootLayout({ children: <AppShellSentinel /> }) as ReactElement;
    expect(renderedChildren(tree, AppShellSentinel)).toBe(false);
  });

  it("WHEN factory/profile.md is PRESENT THEN RootLayout renders the children (app), not the gate", () => {
    writeProfile("---\nname: Ada\n---\n# Ada\n");
    const tree = RootLayout({ children: <AppShellSentinel /> }) as ReactElement;
    expect(renderedChildren(tree, AppShellSentinel)).toBe(true);
  });

  it("WHEN factory/profile.md is PRESENT THEN RootLayout does NOT render the OnboardingGate", () => {
    writeProfile("---\nname: Ada\n---\n# Ada\n");
    const tree = RootLayout({ children: <AppShellSentinel /> }) as ReactElement;
    expect(renderedGate(tree)).toBe(false);
  });

  it("WHEN profile is PRESENT but EMPTY (zero bytes) THEN gate is NOT shown (present beats empty)", () => {
    writeProfile("");
    const tree = RootLayout({ children: <AppShellSentinel /> }) as ReactElement;
    expect(renderedGate(tree)).toBe(false);
    expect(renderedChildren(tree, AppShellSentinel)).toBe(true);
  });

  it("WHEN profile is PRESENT with malformed frontmatter THEN gate is NOT shown (fail-soft → present)", () => {
    // gray-matter must not flip presence: a malformed profile is still a present profile.
    writeProfile("---\nname: : : broken yaml [\n---\nbody");
    const tree = RootLayout({ children: <AppShellSentinel /> }) as ReactElement;
    expect(renderedGate(tree)).toBe(false);
    expect(renderedChildren(tree, AppShellSentinel)).toBe(true);
  });

  it("sets <html lang='es'> (DR-009 Spanish-default surface)", () => {
    const tree = RootLayout({ children: <AppShellSentinel /> }) as ReactElement;
    expect(tree.type).toBe("html");
    expect((tree.props as { lang?: string }).lang).toBe("es");
  });
});

// ---------------------------------------------------------------------------
// Read-only invariant (REQ-01-011) — the guard must not create the profile it checks for.
// ---------------------------------------------------------------------------

describe("frd-01 REQ-01-011: layout guard is read-only", () => {
  it("invoking RootLayout with an ABSENT profile does NOT create factory/profile.md", () => {
    const profilePath = path.join(tmpRoot, "factory", "profile.md");
    expect(fs.existsSync(profilePath)).toBe(false);
    RootLayout({ children: <AppShellSentinel /> });
    expect(fs.existsSync(profilePath)).toBe(false);
  });
});
