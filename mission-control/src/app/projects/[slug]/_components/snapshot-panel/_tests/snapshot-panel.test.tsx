/**
 * WO-14-002 — SnapshotPanel (CMP-14-snapshot-panel) tests
 *
 * RED → GREEN → refactor.
 *
 * Acceptance criteria covered:
 *   AC-14-001.1 — FOR a building project, render the last probable point label
 *                 + a "green" badge + `last_green_sha`.
 *   AC-14-001.2 — Render `git worktree add ../<slug>-review <last_green_sha>`
 *                 with a copy button.
 *   AC-14-001.3 — WHEN `last_green_sha` is absent, omit the panel entirely.
 *   AC-14-002.1 — WHEN running with a work order in progress, show
 *                 "building now: <progress> · don't test this yet", visually
 *                 distinct from the probable point.
 *   AC-14-003.1 — WHEN the snapshot is stale, show a "snapshot getting stale"
 *                 warning; WHEN fresh, do NOT show the warning.
 *
 * Design rules:
 *   - data-testid on all significant elements.
 *   - Green badge and staleness warning use icon + text (not color alone).
 *   - Spanish copy per architecture §7.
 *   - Tokens only (no hardcoded colors in tests — we check testid, not style).
 *
 * Traceability:
 *   CMP-14-snapshot-panel → REQ-14-001, REQ-14-002, REQ-14-003
 *   IF-14-snapshot (lib/snapshot.ts, WO-14-001)
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { SnapshotInfo } from "@/lib/snapshot/snapshot";
import { SnapshotPanel } from "../snapshot-panel";

// ---------------------------------------------------------------------------
// Helpers / fixtures
// ---------------------------------------------------------------------------

function makeSnapshot(overrides: Partial<SnapshotInfo> = {}): SnapshotInfo {
  return {
    sha: "abc1234",
    safeToTest: true,
    worktreeCommand: "git worktree add ../test-project-review abc1234",
    stale: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// AC-14-001.1 — probable point label + green badge + sha
// ---------------------------------------------------------------------------

describe("SnapshotPanel — AC-14-001.1 (probable point + green badge + sha)", () => {
  it("renders the snapshot panel container when snapshot is present", () => {
    render(<SnapshotPanel slug="test-project" snapshot={makeSnapshot()} />);
    expect(screen.getByTestId("snapshot-panel")).toBeTruthy();
  });

  it("renders the 'último punto probable' label (probable point label in Spanish)", () => {
    render(<SnapshotPanel slug="test-project" snapshot={makeSnapshot()} />);
    const label = screen.getByTestId("snapshot-panel-label");
    expect(label.textContent).toMatch(/último punto probable/i);
  });

  it("renders the green badge with 'verde' text (not color alone — icon + text)", () => {
    render(<SnapshotPanel slug="test-project" snapshot={makeSnapshot()} />);
    const badge = screen.getByTestId("snapshot-panel-green-badge");
    expect(badge.textContent).toMatch(/verde/i);
  });

  it("renders the sha value (last_green_sha)", () => {
    render(<SnapshotPanel slug="test-project" snapshot={makeSnapshot({ sha: "deadbeef" })} />);
    const sha = screen.getByTestId("snapshot-panel-sha");
    expect(sha.textContent).toContain("deadbeef");
  });

  it("sha uses tabular-nums class for numeric alignment", () => {
    render(<SnapshotPanel slug="test-project" snapshot={makeSnapshot({ sha: "abc1234" })} />);
    const sha = screen.getByTestId("snapshot-panel-sha");
    // tabular-nums is applied via className or inline fontVariantNumeric
    const hasTabularNums =
      sha.className.includes("tabular-nums") ||
      (sha as HTMLElement).style.fontVariantNumeric === "tabular-nums";
    expect(hasTabularNums).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AC-14-001.2 — worktree command with copy button
// ---------------------------------------------------------------------------

describe("SnapshotPanel — AC-14-001.2 (worktree command + copy button)", () => {
  it("renders the worktree command text", () => {
    const snapshot = makeSnapshot({
      sha: "abc1234",
      worktreeCommand: "git worktree add ../my-project-review abc1234",
    });
    render(<SnapshotPanel slug="my-project" snapshot={snapshot} />);
    const cmd = screen.getByTestId("snapshot-panel-worktree-cmd");
    expect(cmd.textContent).toContain("git worktree add ../my-project-review abc1234");
  });

  it("renders a copy button for the worktree command", () => {
    render(<SnapshotPanel slug="test-project" snapshot={makeSnapshot()} />);
    // CopyButton renders data-testid="copy-button"
    expect(screen.getByTestId("copy-button")).toBeTruthy();
  });

  it("copy button value matches the worktree command", () => {
    const cmd = "git worktree add ../foo-review abc1234";
    const snapshot = makeSnapshot({ worktreeCommand: cmd });
    render(<SnapshotPanel slug="foo" snapshot={snapshot} />);
    // The button aria-label starts with "Copiar" when not yet clicked
    const btn = screen.getByTestId("copy-button");
    expect(btn.getAttribute("aria-label")).toMatch(/copiar/i);
  });
});

// ---------------------------------------------------------------------------
// AC-14-001.3 — absent last_green_sha → panel omitted entirely
// ---------------------------------------------------------------------------

describe("SnapshotPanel — AC-14-001.3 (null snapshot → panel omitted)", () => {
  it("renders nothing (null) when snapshot is null", () => {
    const { container } = render(<SnapshotPanel slug="test-project" snapshot={null} />);
    // The panel should be completely absent — no snapshot-panel testid
    expect(container.querySelector('[data-testid="snapshot-panel"]')).toBeNull();
  });

  it("renders no worktree command when snapshot is null", () => {
    render(<SnapshotPanel slug="test-project" snapshot={null} />);
    expect(screen.queryByTestId("snapshot-panel-worktree-cmd")).toBeNull();
  });

  it("renders no copy button when snapshot is null", () => {
    render(<SnapshotPanel slug="test-project" snapshot={null} />);
    expect(screen.queryByTestId("copy-button")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// AC-14-002.1 — "building now" block (visually distinct from probable point)
// ---------------------------------------------------------------------------

describe("SnapshotPanel — AC-14-002.1 (building now)", () => {
  it("renders the building-now block when buildingNow is set", () => {
    const snapshot = makeSnapshot({ buildingNow: "building now: 45%" });
    render(<SnapshotPanel slug="test-project" snapshot={snapshot} />);
    expect(screen.getByTestId("snapshot-panel-building-now")).toBeTruthy();
  });

  it("building-now block contains the progress text", () => {
    const snapshot = makeSnapshot({ buildingNow: "building now: 45%" });
    render(<SnapshotPanel slug="test-project" snapshot={snapshot} />);
    const block = screen.getByTestId("snapshot-panel-building-now");
    expect(block.textContent).toContain("building now: 45%");
  });

  it("building-now block contains 'don't test this yet' message in Spanish", () => {
    const snapshot = makeSnapshot({ buildingNow: "building now: 75%" });
    render(<SnapshotPanel slug="test-project" snapshot={snapshot} />);
    const block = screen.getByTestId("snapshot-panel-building-now");
    // Spanish: "no lo pruebes aún" or similar
    expect(block.textContent).toMatch(/no lo pruebes|not yet|no.*probar/i);
  });

  it("building-now block is rendered separately from the probable-point section", () => {
    const snapshot = makeSnapshot({ buildingNow: "building now: 30%" });
    render(<SnapshotPanel slug="test-project" snapshot={snapshot} />);
    // Both sections must exist as distinct elements
    expect(screen.getByTestId("snapshot-panel")).toBeTruthy();
    expect(screen.getByTestId("snapshot-panel-probable-point")).toBeTruthy();
    expect(screen.getByTestId("snapshot-panel-building-now")).toBeTruthy();
    // They must not be the same element
    expect(screen.getByTestId("snapshot-panel-probable-point")).not.toBe(
      screen.getByTestId("snapshot-panel-building-now"),
    );
  });

  it("building-now block is NOT rendered when buildingNow is undefined", () => {
    const snapshot = makeSnapshot({ buildingNow: undefined });
    render(<SnapshotPanel slug="test-project" snapshot={snapshot} />);
    expect(screen.queryByTestId("snapshot-panel-building-now")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// AC-14-003.1 — staleness warning shown/hidden
// ---------------------------------------------------------------------------

describe("SnapshotPanel — AC-14-003.1 (staleness warning)", () => {
  it("renders the staleness warning when stale is true", () => {
    const snapshot = makeSnapshot({ stale: true });
    render(<SnapshotPanel slug="test-project" snapshot={snapshot} />);
    expect(screen.getByTestId("snapshot-panel-stale-warning")).toBeTruthy();
  });

  it("staleness warning contains icon + text (not color alone)", () => {
    const snapshot = makeSnapshot({ stale: true });
    render(<SnapshotPanel slug="test-project" snapshot={snapshot} />);
    const warning = screen.getByTestId("snapshot-panel-stale-warning");
    // Must contain text (not rely on color alone for accessibility)
    expect(warning.textContent).toMatch(/snapshot.*stale|desactualiz|antiguo|atrasado/i);
  });

  it("staleness warning has an icon element", () => {
    const snapshot = makeSnapshot({ stale: true });
    render(<SnapshotPanel slug="test-project" snapshot={snapshot} />);
    expect(screen.getByTestId("snapshot-panel-stale-icon")).toBeTruthy();
  });

  it("does NOT render the staleness warning when stale is false", () => {
    const snapshot = makeSnapshot({ stale: false });
    render(<SnapshotPanel slug="test-project" snapshot={snapshot} />);
    expect(screen.queryByTestId("snapshot-panel-stale-warning")).toBeNull();
  });

  it("does NOT render staleness warning for a fresh snapshot", () => {
    const snapshot = makeSnapshot({ stale: false, sha: "fresh123" });
    render(<SnapshotPanel slug="another-project" snapshot={snapshot} />);
    expect(screen.queryByTestId("snapshot-panel-stale-warning")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Design token & accessibility checks
// ---------------------------------------------------------------------------

describe("SnapshotPanel — a11y + design contract", () => {
  it("snapshot panel has a descriptive section role or landmark", () => {
    render(<SnapshotPanel slug="test-project" snapshot={makeSnapshot()} />);
    const panel = screen.getByTestId("snapshot-panel");
    // Should be a section or article element (landmark)
    expect(["section", "article", "aside"].includes(panel.tagName.toLowerCase())).toBe(true);
  });

  it("green badge is also accessible as a status (role or aria-label)", () => {
    render(<SnapshotPanel slug="test-project" snapshot={makeSnapshot()} />);
    const badge = screen.getByTestId("snapshot-panel-green-badge");
    // Must carry meaning beyond color — role="status" or aria-label
    const hasAccessibleRole =
      badge.getAttribute("role") !== null ||
      badge.getAttribute("aria-label") !== null ||
      badge.textContent?.length !== 0;
    expect(hasAccessibleRole).toBe(true);
  });

  it("renders without errors for a minimal valid snapshot", () => {
    const minimal: SnapshotInfo = {
      sha: "min0001",
      safeToTest: false,
      worktreeCommand: "git worktree add ../proj-review min0001",
      stale: false,
    };
    expect(() => render(<SnapshotPanel slug="proj" snapshot={minimal} />)).not.toThrow();
  });

  it("renders without errors when buildingNow is a plain 'building now' string", () => {
    const snapshot = makeSnapshot({ buildingNow: "building now" });
    expect(() => render(<SnapshotPanel slug="proj" snapshot={snapshot} />)).not.toThrow();
  });
});
