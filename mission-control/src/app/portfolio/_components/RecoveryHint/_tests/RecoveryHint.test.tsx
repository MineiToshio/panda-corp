/**
 * RecoveryHint — component tests (refactored for Banner-based implementation).
 *
 * After the DR-057 refactor (WO-03-002), RecoveryHint delegates to the shared
 * Banner + CmdRow primitives. Tests use accessible role queries (getByRole,
 * queryByRole) as the primary contract; getByTestId is kept only for the
 * recovery-hint root wrapper (structural compat) and the no-repo warning.
 *
 * Traceability:
 *   CMP-03-recovery → AC-03-006.2 (⚠️ path not found signal)
 *                     AC-03-006.3 (repo present → copyable git clone + sync command)
 *                     AC-03-006.4 (no repo → no-remote warning)
 *                     AC-03-006.5 (read-only: no clone/write/Claude call)
 *                     AC-03-006.6 (badge clears when exists=true → renders nothing)
 *   REQ-03-006
 *
 * Tests cover:
 *   1. exists=true → renders nothing (AC-03-006.6)
 *   2. exists=false + repo → alert with path-not-found text + CmdRow with clone command
 *   3. exists=false + no repo → alert with path-not-found text + no-repo warning
 *   4. Accessibility: role/aria-label
 *   5. Design-token invariant: zero hardcoded colors
 *   6. Read-only invariant: no form/write/clone DOM elements
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

  it("no alert rendered when exists=true, even with no repo", () => {
    render(<RecoveryHint exists path={PATH} />);
    expect(screen.queryByRole("alert")).toBeNull();
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

  it("renders a Banner (role='alert') for the path-not-found signal", () => {
    render(<RecoveryHint exists={false} path={PATH} repo={REPO} />);
    expect(screen.getByRole("alert")).toBeDefined();
  });

  it("alert text contains path not found indication", () => {
    render(<RecoveryHint exists={false} path={PATH} repo={REPO} />);
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toMatch(/ruta no encontrada|path not found/i);
  });

  it("renders CmdRow (data-testid='cmd-row') with git clone command", () => {
    render(<RecoveryHint exists={false} path={PATH} repo={REPO} />);
    const cmd = screen.getByTestId("cmd-row");
    expect(cmd.textContent).toContain("git clone");
    expect(cmd.textContent).toContain(REPO);
    expect(cmd.textContent).toContain(PATH);
  });

  it("cmd-row contains the sync command", () => {
    render(<RecoveryHint exists={false} path={PATH} repo={REPO} />);
    const cmd = screen.getByTestId("cmd-row");
    expect(cmd.textContent).toContain("/pandacorp:sync-portfolio");
  });

  it("renders a CopyButton inside cmd-row (copy affordance)", () => {
    render(<RecoveryHint exists={false} path={PATH} repo={REPO} />);
    expect(screen.getByTestId("copy-button")).toBeDefined();
  });

  it("clone command uses the exact repo URL and path", () => {
    const repo = "https://github.com/org/special-repo";
    const path = "/home/user/workspace/special-repo";
    render(<RecoveryHint exists={false} path={path} repo={repo} />);
    const cmd = screen.getByTestId("cmd-row");
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

  it("renders a Banner (role='alert') for the path-not-found signal", () => {
    render(<RecoveryHint exists={false} path={PATH} />);
    expect(screen.getByRole("alert")).toBeDefined();
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
    const text = warn.textContent ?? "";
    expect(text.length).toBeGreaterThan(10);
  });

  it("does NOT render a CmdRow when no repo (no clone command)", () => {
    render(<RecoveryHint exists={false} path={PATH} />);
    expect(screen.queryByTestId("cmd-row")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 4. Accessibility (Banner role + aria semantics)
// ---------------------------------------------------------------------------

describe("RecoveryHint — accessibility", () => {
  it("Banner has role='alert' (announces the path-not-found signal)", () => {
    render(<RecoveryHint exists={false} path={PATH} repo={REPO} />);
    const alert = screen.getByRole("alert");
    expect(alert).toBeDefined();
  });

  it("Banner aria-label in Spanish mentions 'Aviso'", () => {
    render(<RecoveryHint exists={false} path={PATH} repo={REPO} />);
    const alert = screen.getByRole("alert");
    const label = alert.getAttribute("aria-label") ?? "";
    expect(label.length).toBeGreaterThan(0);
  });

  it("CmdRow copy-button is accessible (has aria-label)", () => {
    render(<RecoveryHint exists={false} path={PATH} repo={REPO} />);
    const copyBtn = screen.getByTestId("copy-button");
    const label = copyBtn.getAttribute("aria-label") ?? "";
    expect(label.length).toBeGreaterThan(0);
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
    expect(screen.queryByTestId("cmd-row")).toBeNull();
  });
});
