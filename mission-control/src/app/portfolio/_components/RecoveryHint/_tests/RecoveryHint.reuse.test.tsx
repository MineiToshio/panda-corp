/**
 * WO-03-002 — RecoveryHint structural reuse tests (DR-057).
 *
 * Gate-anchoring RED tests: verify RecoveryHint delegates to the shared
 * Banner primitive rather than reimplementing a bespoke banner box style.
 *
 * These tests are deliberately structural (not behavioral) — they verify the
 * DR-057 mandate: "refactor onto the shared Banner". The behavioral contract
 * (path-not-found signal, recovery command, no-repo warning) lives in
 * RecoveryHint.test.tsx.
 *
 * Traceability:
 *   WO-03-002 scope — RecoveryHint refactored onto Banner (path-not-found variant)
 *   DR-057: reuse before creating; one Banner in the app
 *   components.md: RecoveryHint = "consumer of Banner (path-not-found)"
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RecoveryHint } from "@/app/portfolio/_components/RecoveryHint/RecoveryHint";

const PATH = "/Users/ada/projects/proj-a";
const REPO = "https://github.com/ada/proj-a";

// ---------------------------------------------------------------------------
// Structural reuse: RecoveryHint renders the shared Banner
// ---------------------------------------------------------------------------

describe("RecoveryHint — DR-057 reuse: delegates to shared Banner", () => {
  it("renders a Banner (data-testid='banner') when exists=false with repo", () => {
    render(<RecoveryHint exists={false} path={PATH} repo={REPO} />);
    // Must use the shared Banner, not a bespoke box
    expect(screen.getByTestId("banner")).toBeDefined();
  });

  it("renders a Banner (data-testid='banner') when exists=false without repo", () => {
    render(<RecoveryHint exists={false} path={PATH} />);
    expect(screen.getByTestId("banner")).toBeDefined();
  });

  it("Banner has tone='danger' for path-not-found (data-tone attribute)", () => {
    render(<RecoveryHint exists={false} path={PATH} repo={REPO} />);
    const banner = screen.getByTestId("banner");
    // Banner sets data-tone to its tone prop
    expect(banner.getAttribute("data-tone")).toBe("danger");
  });

  it("does NOT render Banner when exists=true (path cleared)", () => {
    render(<RecoveryHint exists path={PATH} repo={REPO} />);
    expect(screen.queryByTestId("banner")).toBeNull();
  });

  it("uses CmdRow (data-testid='cmd-row') for the recovery command (not a bespoke code box)", () => {
    render(<RecoveryHint exists={false} path={PATH} repo={REPO} />);
    // CmdRow is the THE command-chip primitive (CMP-13-cmdrow)
    expect(screen.getByTestId("cmd-row")).toBeDefined();
  });

  it("cmd-row contains the git clone command text", () => {
    render(<RecoveryHint exists={false} path={PATH} repo={REPO} />);
    const cmdRow = screen.getByTestId("cmd-row");
    expect(cmdRow.textContent).toContain("git clone");
    expect(cmdRow.textContent).toContain(REPO);
    expect(cmdRow.textContent).toContain(PATH);
  });

  it("no bespoke HINT_BOX_STYLE inline box (no box with inline border + border-radius on root)", () => {
    // The old bespoke implementation had a div with inline style including border + borderRadius.
    // The refactored version uses Banner which manages its own styling.
    render(<RecoveryHint exists={false} path={PATH} repo={REPO} />);
    // Banner root has data-testid="banner"; the recovery-hint root wraps it.
    // No ADDITIONAL box with inline border styles should exist besides the Banner.
    const hint = screen.getByTestId("recovery-hint");
    // Root wrapper must NOT itself carry the bespoke box style (border, padding, borderRadius).
    const hintStyle = hint.getAttribute("style") ?? "";
    expect(hintStyle).not.toContain("border:");
    expect(hintStyle).not.toContain("borderRadius");
  });
});

// ---------------------------------------------------------------------------
// Behavioral contract preserved (key signals still present after refactor)
// ---------------------------------------------------------------------------

describe("RecoveryHint — behavioral contract preserved post-refactor", () => {
  it("path-not-found signal visible: Banner heading or alert role present", () => {
    render(<RecoveryHint exists={false} path={PATH} repo={REPO} />);
    // Banner renders role="alert" on root
    const alert = screen.getByRole("alert");
    expect(alert).toBeDefined();
    expect(alert.textContent).toMatch(/ruta no encontrada/i);
  });

  it("no-repo path: warning text present inside recovery-hint", () => {
    render(<RecoveryHint exists={false} path={PATH} />);
    const hint = screen.getByTestId("recovery-hint");
    expect(hint.textContent).toMatch(/sin repositorio|no remote/i);
    expect(hint.textContent).toMatch(/pandacorp:spec/i);
  });

  it("recovery command includes sync-portfolio", () => {
    render(<RecoveryHint exists={false} path={PATH} repo={REPO} />);
    const cmdRow = screen.getByTestId("cmd-row");
    expect(cmdRow.textContent).toContain("/pandacorp:sync-portfolio");
  });

  it("renders nothing (null) when exists=true", () => {
    const { container } = render(<RecoveryHint exists path={PATH} repo={REPO} />);
    expect(container.firstChild).toBeNull();
  });
});
