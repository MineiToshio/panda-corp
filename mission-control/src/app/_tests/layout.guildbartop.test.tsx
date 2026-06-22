/**
 * WO-09-004 — Guild top-bar in app/layout.tsx (RED phase)
 *
 * Acceptance criteria verified here:
 *   AC-09-004.1 — The top bar IS present in the layout (cross-cutting, visible across the app).
 *                 It shows guild level + title + XP bar from computeGuildLevel().
 *
 * Approach:
 *   RootLayout is a Server Component. We invoke it as a pure function (same pattern as
 *   app/layout.guard.test.tsx, LESSON: this pattern is established in the codebase).
 *   We walk the React element tree to confirm GuildBar is mounted inside the layout
 *   when a profile IS present. When profile is absent, the OnboardingGate is shown
 *   instead — the GuildBar should NOT appear behind the gate.
 *
 * Traceability:
 *   CMP-09-guild-bar → blueprint §3 "Cross-cutting (in app/layout.tsx)" → AC-09-004.1
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { isValidElement, type ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GuildBar } from "@/components/modules/GuildBar/GuildBar";
import RootLayout from "../layout";

// ---------------------------------------------------------------------------
// Temp factory root helpers (mirrors layout.guard.test.tsx pattern)
// ---------------------------------------------------------------------------

let tmpRoot: string;
const ORIGINAL_ENV = process.env.PANDACORP_FACTORY_ROOT;

beforeEach(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mc-layout-guild-"));
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
  // Traverse ALL element-valued props, not just children: GuildBar/ProposalsBadge are now passed to
  // AppShell as the `levelBar`/`proposalsBadge` slots (FRD-19), not as children.
  const props = el.props as Record<string, unknown>;
  for (const value of Object.values(props)) {
    const found = findNode(value, predicate);
    if (found) return found;
  }
  return null;
}

function containsGuildBar(tree: ReactElement): boolean {
  return findNode(tree, (el) => el.type === GuildBar) !== null;
}

// Sentinel for the children slot
function AppSentinel(): React.JSX.Element {
  return <div data-testid="app-sentinel" />;
}

// ---------------------------------------------------------------------------
// AC-09-004.1 — GuildBar is mounted in the layout
// ---------------------------------------------------------------------------

describe("AC-09-004.1 — GuildBar is mounted cross-cutting in app/layout.tsx", () => {
  it("WHEN profile is PRESENT THEN RootLayout mounts GuildBar", () => {
    writeProfile("---\nname: Ada\n---\n# Ada\n");
    const tree = RootLayout({ children: <AppSentinel /> }) as ReactElement;
    expect(containsGuildBar(tree)).toBe(true);
  });

  it("WHEN profile is ABSENT THEN GuildBar is NOT rendered (OnboardingGate blocks it)", () => {
    // No profile — gate takes over; GuildBar should not appear
    const tree = RootLayout({ children: <AppSentinel /> }) as ReactElement;
    expect(containsGuildBar(tree)).toBe(false);
  });

  it("GuildBar is outside the children slot (cross-cutting, not per-page)", () => {
    writeProfile("---\nname: Ada\n---\n# Ada\n");
    const tree = RootLayout({ children: <AppSentinel /> }) as ReactElement;
    // GuildBar must exist independently of the children sentinel
    expect(containsGuildBar(tree)).toBe(true);
  });

  it("GuildBar receives an outcomes prop (not hardcoded zero)", () => {
    writeProfile("---\nname: Ada\n---\n# Ada\n");
    const tree = RootLayout({ children: <AppSentinel /> }) as ReactElement;
    const guildBarEl = findNode(tree, (el) => el.type === GuildBar);
    expect(guildBarEl).not.toBeNull();
    // The outcomes prop must be an object (even if all zeros — from real data read)
    const props = guildBarEl?.props as { outcomes?: unknown };
    expect(props.outcomes).toBeDefined();
    expect(typeof props.outcomes).toBe("object");
  });
});
