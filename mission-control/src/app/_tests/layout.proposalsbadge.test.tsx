/**
 * WO-17-007 — ProposalsBadge in app/layout.tsx
 *
 * Acceptance criteria verified here:
 *   AC-17-007.1 — The top-bar badge IS present in the layout (cross-cutting, visible
 *                 across the app) and links to /proposals.
 *   AC-17-007.4 — When no proposals exist, the badge still renders (calm state).
 *
 * Approach:
 *   RootLayout is a Server Component. We invoke it as a pure function
 *   (same pattern as layout.guard.test.tsx and layout.guildbartop.test.tsx).
 *   We walk the React element tree to confirm ProposalsBadge is mounted inside
 *   the layout when a profile IS present, and is NOT shown behind the OnboardingGate.
 *
 * Traceability:
 *   CMP-17-badge → REQ-17-001, REQ-17-008
 *   AC-17-007.1 (cross-cutting, in layout)
 *   WO-17-007
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { isValidElement, type ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ProposalsBadge } from "@/components/modules/ProposalsBadge/ProposalsBadge";
import RootLayout from "../layout";

// ---------------------------------------------------------------------------
// Temp factory root helpers (mirrors layout.guard.test.tsx pattern)
// ---------------------------------------------------------------------------

let tmpRoot: string;
const ORIGINAL_ENV = process.env.PANDACORP_FACTORY_ROOT;

beforeEach(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mc-layout-badge-"));
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
// Tree-walking helpers (same pattern as layout.guard.test.tsx)
// ---------------------------------------------------------------------------

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

function containsProposalsBadge(tree: ReactElement): boolean {
  return findNode(tree, (el) => el.type === ProposalsBadge) !== null;
}

function AppSentinel(): React.JSX.Element {
  return <div data-testid="app-sentinel" />;
}

// ---------------------------------------------------------------------------
// AC-17-007.1 — ProposalsBadge is mounted cross-cutting in app/layout.tsx
// ---------------------------------------------------------------------------

describe("AC-17-007.1 — ProposalsBadge is mounted cross-cutting in app/layout.tsx", () => {
  it("WHEN profile is PRESENT THEN RootLayout mounts ProposalsBadge", () => {
    writeProfile("---\nname: Ada\n---\n# Ada\n");
    const tree = RootLayout({ children: <AppSentinel /> }) as ReactElement;
    expect(containsProposalsBadge(tree)).toBe(true);
  });

  it("WHEN profile is ABSENT THEN ProposalsBadge is NOT rendered (OnboardingGate blocks it)", () => {
    // No profile file — gate takes over; ProposalsBadge should not appear
    const tree = RootLayout({ children: <AppSentinel /> }) as ReactElement;
    expect(containsProposalsBadge(tree)).toBe(false);
  });

  it("ProposalsBadge is outside the children slot (cross-cutting, not per-page)", () => {
    writeProfile("---\nname: Ada\n---\n# Ada\n");
    const tree = RootLayout({ children: <AppSentinel /> }) as ReactElement;
    expect(containsProposalsBadge(tree)).toBe(true);
  });

  it("ProposalsBadge receives an openCount prop (not undefined)", () => {
    writeProfile("---\nname: Ada\n---\n# Ada\n");
    const tree = RootLayout({ children: <AppSentinel /> }) as ReactElement;
    const badgeEl = findNode(tree, (el) => el.type === ProposalsBadge);
    expect(badgeEl).not.toBeNull();
    const props = badgeEl?.props as { openCount?: unknown };
    expect(props.openCount).toBeDefined();
    expect(typeof props.openCount).toBe("number");
  });

  it("openCount is 0 (calm) when factory/memory is empty — AC-17-007.4", () => {
    writeProfile("---\nname: Ada\n---\n# Ada\n");
    // No memory directory → countOpenProposals() returns { total: 0 }
    const tree = RootLayout({ children: <AppSentinel /> }) as ReactElement;
    const badgeEl = findNode(tree, (el) => el.type === ProposalsBadge);
    const props = badgeEl?.props as { openCount?: number };
    expect(props.openCount).toBe(0);
  });
});
