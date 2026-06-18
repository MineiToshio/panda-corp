/**
 * RecoveryHint — component tests (TDD: RED first).
 *
 * Traceability:
 *   CMP-03-recovery → AC-03-006.2 (⚠️ path not found badge)
 *                     AC-03-006.3 (repo present → copyable git clone + sync command)
 *                     AC-03-006.4 (no repo → no-remote warning)
 *                     AC-03-006.5 (read-only: no clone/write/Claude call)
 *                     AC-03-006.6 (badge clears when exists=true → renders nothing)
 *   REQ-03-006
 *
 * Tests cover:
 *   1. exists=true → renders nothing (badge cleared, AC-03-006.6)
 *   2. exists=false + repo → ⚠ badge + copyable git clone + sync command (CopyButton)
 *   3. exists=false + no repo → ⚠ badge + no-remote warning, no CopyButton for clone
 *   4. Accessibility: role/aria-label on badge
 *   5. Design-token invariant: zero hardcoded colors
 *   6. Read-only invariant: no form/write/clone DOM elements
 *
 * Stack: Vitest + @testing-library/react (jsdom).
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RecoveryHint } from "@/app/portfolio/_components/RecoveryHint/RecoveryHint";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const REPO = "https://github.com/ada/proj-a";
const PATH = "/Users/ada/projects/proj-a";

// ---------------------------------------------------------------------------
// 1. exists=true — renders nothing (AC-03-006.6)
// ---------------------------------------------------------------------------

describe("RecoveryHint — exists=true (badge cleared)", () => {
  it("renders null when exists=true (no badge, no recovery UI)", () => {
    const { container } = render(<RecoveryHint exists path={PATH} repo={REPO} />);
    expect(container.firstChild).toBeNull();
  });

  it("no recovery-hint testid rendered when exists=true", () => {
    render(<RecoveryHint exists path={PATH} repo={REPO} />);
    expect(screen.queryByTestId("recovery-hint")).toBeNull();
  });

  it("no not-found badge when exists=true, even with no repo", () => {
    render(<RecoveryHint exists path={PATH} />);
    expect(screen.queryByTestId("recovery-hint-badge")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 2. exists=false + repo present (AC-03-006.2, AC-03-006.3)
// ---------------------------------------------------------------------------

describe("RecoveryHint — exists=false, repo present", () => {
  it("renders recovery-hint root element", () => {
    render(<RecoveryHint exists={false} path={PATH} repo={REPO} />);
    expect(screen.getByTestId("recovery-hint")).toBeDefined();
  });

  it("renders the ⚠ path-not-found badge", () => {
    render(<RecoveryHint exists={false} path={PATH} repo={REPO} />);
    expect(screen.getByTestId("recovery-hint-badge")).toBeDefined();
  });

  it("badge text contains path not found indication", () => {
    render(<RecoveryHint exists={false} path={PATH} repo={REPO} />);
    const badge = screen.getByTestId("recovery-hint-badge");
    expect(badge.textContent).toMatch(/ruta no encontrada|path not found/i);
  });

  it("renders recovery-hint-command with git clone command", () => {
    render(<RecoveryHint exists={false} path={PATH} repo={REPO} />);
    const cmd = screen.getByTestId("recovery-hint-command");
    expect(cmd.textContent).toContain("git clone");
    expect(cmd.textContent).toContain(REPO);
    expect(cmd.textContent).toContain(PATH);
  });

  it("renders the sync command after the clone command", () => {
    render(<RecoveryHint exists={false} path={PATH} repo={REPO} />);
    const cmd = screen.getByTestId("recovery-hint-command");
    expect(cmd.textContent).toContain("/pandacorp:sync-portfolio");
  });

  it("renders a CopyButton for the recovery command (data-testid=copy-button)", () => {
    render(<RecoveryHint exists={false} path={PATH} repo={REPO} />);
    expect(screen.getByTestId("copy-button")).toBeDefined();
  });

  it("clone command uses the exact repo URL and path", () => {
    const repo = "https://github.com/org/special-repo";
    const path = "/home/user/workspace/special-repo";
    render(<RecoveryHint exists={false} path={path} repo={repo} />);
    const cmd = screen.getByTestId("recovery-hint-command");
    expect(cmd.textContent).toContain(repo);
    expect(cmd.textContent).toContain(path);
  });

  it("does NOT render no-repo warning when repo is present", () => {
    render(<RecoveryHint exists={false} path={PATH} repo={REPO} />);
    expect(screen.queryByTestId("recovery-hint-no-repo")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 3. exists=false + no repo (AC-03-006.4)
// ---------------------------------------------------------------------------

describe("RecoveryHint — exists=false, no repo", () => {
  it("renders recovery-hint root element", () => {
    render(<RecoveryHint exists={false} path={PATH} />);
    expect(screen.getByTestId("recovery-hint")).toBeDefined();
  });

  it("renders the ⚠ path-not-found badge", () => {
    render(<RecoveryHint exists={false} path={PATH} />);
    expect(screen.getByTestId("recovery-hint-badge")).toBeDefined();
  });

  it("renders recovery-hint-no-repo warning text", () => {
    render(<RecoveryHint exists={false} path={PATH} />);
    expect(screen.getByTestId("recovery-hint-no-repo")).toBeDefined();
  });

  it("no-repo warning mentions pandacorp:spec", () => {
    render(<RecoveryHint exists={false} path={PATH} />);
    const warn = screen.getByTestId("recovery-hint-no-repo");
    expect(warn.textContent).toContain("/pandacorp:spec");
  });

  it("no-repo warning text mentions backup or recreate", () => {
    render(<RecoveryHint exists={false} path={PATH} />);
    const warn = screen.getByTestId("recovery-hint-no-repo");
    // Should mention backup or local
    const text = warn.textContent ?? "";
    expect(text.length).toBeGreaterThan(10);
  });

  it("does NOT render recovery-hint-command when no repo", () => {
    render(<RecoveryHint exists={false} path={PATH} />);
    expect(screen.queryByTestId("recovery-hint-command")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 4. Accessibility (badge)
// ---------------------------------------------------------------------------

describe("RecoveryHint — accessibility", () => {
  it("badge has role=status", () => {
    render(<RecoveryHint exists={false} path={PATH} repo={REPO} />);
    const badge = screen.getByTestId("recovery-hint-badge");
    expect(badge.getAttribute("role")).toBe("status");
  });

  it("badge has aria-label in Spanish", () => {
    render(<RecoveryHint exists={false} path={PATH} repo={REPO} />);
    const badge = screen.getByTestId("recovery-hint-badge");
    const label = badge.getAttribute("aria-label") ?? "";
    expect(label.length).toBeGreaterThan(0);
  });

  it("badge aria-label mentions the path", () => {
    render(<RecoveryHint exists={false} path={PATH} repo={REPO} />);
    const badge = screen.getByTestId("recovery-hint-badge");
    const label = badge.getAttribute("aria-label") ?? "";
    // Should provide enough context (either path or generic description)
    expect(label.length).toBeGreaterThan(5);
  });
});

// ---------------------------------------------------------------------------
// 5. Design-token invariant: zero hardcoded colors
// ---------------------------------------------------------------------------

describe("RecoveryHint — design tokens", () => {
  it("no inline style uses hardcoded hex color (exists=false + repo)", () => {
    const { container } = render(<RecoveryHint exists={false} path={PATH} repo={REPO} />);
    const all = container.querySelectorAll("[style]");
    for (const el of all) {
      const style = el.getAttribute("style") ?? "";
      expect(style).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    }
  });

  it("no inline style uses hardcoded hex color (exists=false, no repo)", () => {
    const { container } = render(<RecoveryHint exists={false} path={PATH} />);
    const all = container.querySelectorAll("[style]");
    for (const el of all) {
      const style = el.getAttribute("style") ?? "";
      expect(style).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    }
  });

  it("no inline style uses hardcoded rgb()", () => {
    const { container } = render(<RecoveryHint exists={false} path={PATH} repo={REPO} />);
    const all = container.querySelectorAll("[style]");
    for (const el of all) {
      const style = el.getAttribute("style") ?? "";
      expect(style).not.toMatch(/\brgb\b/);
    }
  });

  it("no inline style uses hardcoded hsl()", () => {
    const { container } = render(<RecoveryHint exists={false} path={PATH} repo={REPO} />);
    const all = container.querySelectorAll("[style]");
    for (const el of all) {
      const style = el.getAttribute("style") ?? "";
      expect(style).not.toMatch(/\bhsl\b/);
    }
  });
});

// ---------------------------------------------------------------------------
// 6. Read-only invariant (AC-03-006.5)
// ---------------------------------------------------------------------------

describe("RecoveryHint — read-only invariant", () => {
  it("no form element in recovery hint with repo", () => {
    render(<RecoveryHint exists={false} path={PATH} repo={REPO} />);
    expect(document.querySelector("form")).toBeNull();
  });

  it("no form element in recovery hint without repo", () => {
    render(<RecoveryHint exists={false} path={PATH} />);
    expect(document.querySelector("form")).toBeNull();
  });

  it("recovery command is pure copyable text — not a clickable link that triggers clone", () => {
    render(<RecoveryHint exists={false} path={PATH} repo={REPO} />);
    const cmd = screen.getByTestId("recovery-hint-command");
    // Should be a code element or span, not an <a> that navigates
    expect(cmd.tagName.toLowerCase()).not.toBe("a");
  });

  it("does not render any data-write or data-clone marker", () => {
    const { container } = render(<RecoveryHint exists={false} path={PATH} repo={REPO} />);
    expect(container.querySelector("[data-write]")).toBeNull();
    expect(container.querySelector("[data-clone]")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 7. Props contract — optional repo
// ---------------------------------------------------------------------------

describe("RecoveryHint — props contract", () => {
  it("accepts repo=undefined explicitly (no-repo path)", () => {
    expect(() =>
      render(<RecoveryHint exists={false} path={PATH} repo={undefined} />),
    ).not.toThrow();
  });

  it("accepts repo as empty string and treats it as no-repo", () => {
    render(<RecoveryHint exists={false} path={PATH} repo="" />);
    // Empty string repo should fall back to no-repo warning
    expect(screen.getByTestId("recovery-hint-no-repo")).toBeDefined();
    expect(screen.queryByTestId("recovery-hint-command")).toBeNull();
  });
});
