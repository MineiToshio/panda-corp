/**
 * FRD-19 layout acceptance (reviewer-authored, DR-080).
 *
 * Replaces the retired top-bar mount suites: RootLayout mounts the shell exactly once around the
 * page, the onboarding gate replaces the whole view, and the v1 top-bar reads stay gone.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OnboardingGate } from "@/app/_components/OnboardingGate/OnboardingGate";
import RootLayout from "@/app/layout";
import { AppShell } from "@/components/modules/AppShell/AppShell";

vi.mock("@/app/globals.css", () => ({}));

function collect(node: ReactNode, type: unknown, found: ReactElement[] = []): ReactElement[] {
  if (Array.isArray(node)) {
    for (const child of node) collect(child, type, found);
    return found;
  }
  if (!isValidElement(node)) return found;
  if (node.type === type) found.push(node);
  collect((node.props as { children?: ReactNode }).children, type, found);
  return found;
}

describe("FRD-19 RootLayout shell mount", () => {
  let root: string;
  const original = process.env.PANDACORP_FACTORY_ROOT;
  function Page(): React.JSX.Element {
    return <p>page</p>;
  }

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "mc-layout-shell-"));
    fs.mkdirSync(path.join(root, "factory"));
    process.env.PANDACORP_FACTORY_ROOT = root;
  });
  afterEach(() => {
    if (original === undefined) delete process.env.PANDACORP_FACTORY_ROOT;
    else process.env.PANDACORP_FACTORY_ROOT = original;
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("AC-19-004.1: mounts AppShell once around the page when the profile exists", () => {
    fs.writeFileSync(path.join(root, "factory", "profile.md"), "---\nname: Ada\n---\n");
    const tree = RootLayout({ children: <Page /> });
    const shells = collect(tree, AppShell);
    expect(shells).toHaveLength(1);
    expect(collect(shells, Page)).toHaveLength(1);
    expect(collect(tree, OnboardingGate)).toHaveLength(0);
  });

  it("edge case: the onboarding gate is the entire view and the shell is not behind it", () => {
    const tree = RootLayout({ children: <Page /> });
    expect(collect(tree, OnboardingGate)).toHaveLength(1);
    expect(collect(tree, AppShell)).toHaveLength(0);
    expect(collect(tree, Page)).toHaveLength(0);
  });

  it("WO-19-002 removals: the layout has no top-bar import or server read left", () => {
    const source = fs.readFileSync(path.resolve("src/app/layout.tsx"), "utf8");
    for (const retired of [
      "GuildBar",
      "ProposalsBadge",
      "PendingMergeBadge",
      "CelebrationWatcher",
      "countOpenProposals",
      "getPendingMerge",
      "getGuildState",
    ]) {
      expect(source, retired).not.toContain(retired);
    }
  });
});
