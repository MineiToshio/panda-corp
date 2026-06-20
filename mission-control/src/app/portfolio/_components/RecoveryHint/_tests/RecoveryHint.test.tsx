/**
 * RecoveryHint — component tests (WO-03-002 refactor: reuses shared Banner, DR-057).
 *
 * RecoveryHint was refactored onto the shared `Banner` component (WO-03-002).
 * Tests now verify behavior through the rendered output rather than
 * implementation-specific testids.
 *
 * Traceability:
 *   CMP-03-recovery → AC-03-006.2 (⚠️ path not found heading)
 *                     AC-03-006.3 (repo present → copyable git clone + sync command)
 *                     AC-03-006.4 (no repo → no-remote warning)
 *                     AC-03-006.5 (read-only: no clone/write/Claude call)
 *                     AC-03-006.6 (badge clears when exists=true → renders nothing)
 *   REQ-03-006
 *   DR-057 (reuses shared Banner — no forked banner component)
 *
 * Tests cover:
 *   1. exists=true → renders nothing (badge cleared, AC-03-006.6)
 *   2. exists=false + repo → ⚠ heading + copyable git clone + sync command (CopyButton)
 *   3. exists=false + no repo → ⚠ heading + no-remote warning, no CopyButton for clone
 *   4. Accessibility
 *   5. Design-token invariant: zero hardcoded colors
 *   6. Read-only invariant: no form/write/clone DOM elements
 *   7. DR-057: uses the shared Banner (data-testid="banner")
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

  it("no path-not-found text when exists=true, even with no repo", () => {
    render(<RecoveryHint exists path={PATH} />);
    expect(screen.queryByText(/ruta no encontrada|path not found/i)).toBeNull();
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

  it("renders the shared Banner (DR-057: reuses Banner, not a fork)", () => {
    render(<RecoveryHint exists={false} path={PATH} repo={REPO} />);
    expect(screen.getByTestId("banner")).toBeDefined();
  });

  it("Banner heading contains path-not-found indication (AC-03-006.2)", () => {
    render(<RecoveryHint exists={false} path={PATH} repo={REPO} />);
    expect(screen.getByText(/ruta no encontrada|path not found/i)).toBeDefined();
  });

  it("banner-cmd-row contains git clone command (AC-03-006.3)", () => {
    render(<RecoveryHint exists={false} path={PATH} repo={REPO} />);
    const cmdRow = screen.getByTestId("banner-cmd-row");
    expect(cmdRow.textContent).toContain("git clone");
    expect(cmdRow.textContent).toContain(REPO);
    expect(cmdRow.textContent).toContain(PATH);
  });

  it("command row contains sync-portfolio step", () => {
    render(<RecoveryHint exists={false} path={PATH} repo={REPO} />);
    const cmdRow = screen.getByTestId("banner-cmd-row");
    expect(cmdRow.textContent).toContain("/pandacorp:sync-portfolio");
  });

  it("renders a CopyButton for the recovery command (data-testid=copy-button)", () => {
    render(<RecoveryHint exists={false} path={PATH} repo={REPO} />);
    expect(screen.getByTestId("copy-button")).toBeDefined();
  });

  it("clone command uses the exact repo URL and path", () => {
    const repo = "https://github.com/org/special-repo";
    const path = "/home/user/workspace/special-repo";
    render(<RecoveryHint exists={false} path={path} repo={repo} />);
    const cmdRow = screen.getByTestId("banner-cmd-row");
    expect(cmdRow.textContent).toContain(repo);
    expect(cmdRow.textContent).toContain(path);
  });

  it("does NOT render a no-remote warning when repo is present", () => {
    render(<RecoveryHint exists={false} path={PATH} repo={REPO} />);
    // No-remote warning mentions /pandacorp:spec but in detail, not as a command row
    // The command row must exist (git clone) — that's enough verification
    expect(screen.queryByText(/Sin repositorio registrado/i)).toBeNull();
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

  it("renders the shared Banner (DR-057)", () => {
    render(<RecoveryHint exists={false} path={PATH} />);
    expect(screen.getByTestId("banner")).toBeDefined();
  });

  it("Banner heading contains path-not-found indication (AC-03-006.2)", () => {
    render(<RecoveryHint exists={false} path={PATH} />);
    expect(screen.getByText(/ruta no encontrada|path not found/i)).toBeDefined();
  });

  it("banner detail mentions /pandacorp:spec (no-remote warning, AC-03-006.4)", () => {
    render(<RecoveryHint exists={false} path={PATH} />);
    expect(screen.getByText(/pandacorp:spec/i)).toBeDefined();
  });

  it("no-repo banner detail text has substantive content", () => {
    render(<RecoveryHint exists={false} path={PATH} />);
    const detail = screen.getByTestId("banner-detail");
    expect((detail.textContent ?? "").length).toBeGreaterThan(10);
  });

  it("does NOT render a command row (no git clone) when no repo", () => {
    render(<RecoveryHint exists={false} path={PATH} />);
    expect(screen.queryByTestId("banner-cmd-row")).toBeNull();
    expect(screen.queryByText(/git clone/i)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 4. Accessibility
// ---------------------------------------------------------------------------

describe("RecoveryHint — accessibility", () => {
  it("Banner has role=alert (Banner's own aria invariant)", () => {
    render(<RecoveryHint exists={false} path={PATH} repo={REPO} />);
    expect(screen.getByRole("alert")).toBeDefined();
  });

  it("Banner heading text is non-empty", () => {
    render(<RecoveryHint exists={false} path={PATH} repo={REPO} />);
    const text = screen.getByText(/ruta no encontrada|path not found/i);
    expect((text.textContent ?? "").length).toBeGreaterThan(0);
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
      expect(style).not.toMatch(/\brgb\(/);
    }
  });

  it("no inline style uses hardcoded hsl()", () => {
    const { container } = render(<RecoveryHint exists={false} path={PATH} repo={REPO} />);
    const all = container.querySelectorAll("[style]");
    for (const el of all) {
      const style = el.getAttribute("style") ?? "";
      expect(style).not.toMatch(/\bhsl\(/);
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
// 7. DR-057 — uses the shared Banner (not a fork)
// ---------------------------------------------------------------------------

describe("RecoveryHint — DR-057 Banner reuse", () => {
  it("renders exactly ONE Banner for a missing-path row with repo", () => {
    render(<RecoveryHint exists={false} path={PATH} repo={REPO} />);
    const banners = screen.queryAllByTestId("banner");
    expect(banners.length).toBe(1);
  });

  it("renders exactly ONE Banner for a missing-path row without repo", () => {
    render(<RecoveryHint exists={false} path={PATH} />);
    const banners = screen.queryAllByTestId("banner");
    expect(banners.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 8. Props contract — optional repo
// ---------------------------------------------------------------------------

describe("RecoveryHint — props contract", () => {
  it("accepts repo=undefined explicitly (no-repo path)", () => {
    expect(() =>
      render(<RecoveryHint exists={false} path={PATH} repo={undefined} />),
    ).not.toThrow();
  });

  it("accepts repo as empty string and treats it as no-repo", () => {
    render(<RecoveryHint exists={false} path={PATH} repo="" />);
    // Empty string repo should fall back to no-repo warning (no git clone command)
    expect(screen.queryByText(/git clone/i)).toBeNull();
    expect(screen.queryByText(/pandacorp:spec/i)).not.toBeNull();
  });
});
