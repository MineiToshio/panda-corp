/**
 * WO-14-002 — SnapshotPanel (CMP-14-snapshot-panel) tests
 *
 * RED → GREEN → refactor.
 *
 * Acceptance criteria covered:
 *   AC-14-001.1 — FOR a building project, render:
 *                 - "Último commit en verde · seguro para probar" heading
 *                 - A green Chip (shared primitive, data-testid="chip", tone="ok")
 *                 - The last_green_sha in a <code> element
 *                 - Muted line "commit <sha> — pasó todos los gates. Pruébalo..."
 *   AC-14-001.2 — Render `git worktree add ../<slug>-review <last_green_sha>`
 *                 in the shared CmdRow primitive (data-testid="cmd-row").
 *   AC-14-001.3 — WHEN `last_green_sha` is absent, omit the panel entirely.
 *   AC-14-002.1 — WHEN running, show "El build sigue avanzando: <progress> ·
 *                 eso aún no está en verde, no lo pruebes" — distinct from the
 *                 last-green commit. Uses ti-hammer icon.
 *   AC-14-003.1 — WHEN stale, show the staleness warning on the shared Banner
 *                 (data-testid="banner", tone="warn"); icon + text (not color alone).
 *                 WHEN fresh, do NOT show the warning.
 *
 * Primitive reuse assertions (DR-057):
 *   - Panel wrapper   → data-testid="panel"
 *   - Chip (green)    → data-testid="chip" + data-tone="ok"
 *   - CmdRow          → data-testid="cmd-row"
 *   - Banner (stale)  → data-testid="banner" + data-tone="warn"
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
// AC-14-001.1 — "Último commit en verde · seguro para probar" heading + green Chip + sha
// ---------------------------------------------------------------------------

describe("SnapshotPanel — AC-14-001.1 (heading + green Chip + sha)", () => {
  it("renders the snapshot panel container when snapshot is present", () => {
    render(<SnapshotPanel slug="test-project" snapshot={makeSnapshot()} />);
    expect(screen.getByTestId("snapshot-panel")).toBeTruthy();
  });

  it("renders the 'Último commit en verde · seguro para probar' heading (re-anchored copy)", () => {
    render(<SnapshotPanel slug="test-project" snapshot={makeSnapshot()} />);
    const panel = screen.getByTestId("snapshot-panel");
    expect(panel.textContent).toMatch(/último commit en verde.*seguro para probar/i);
  });

  it("uses the shared Panel primitive as the outer container (DR-057)", () => {
    render(<SnapshotPanel slug="test-project" snapshot={makeSnapshot()} />);
    // Panel renders data-testid="panel"
    expect(screen.getByTestId("panel")).toBeTruthy();
  });

  it("renders a green Chip (shared primitive, tone=ok) for the status signal (DR-057)", () => {
    render(<SnapshotPanel slug="test-project" snapshot={makeSnapshot()} />);
    // Chip renders data-testid="chip" with data-tone attribute
    const chip = screen.getByTestId("chip");
    expect(chip).toBeTruthy();
    expect(chip.getAttribute("data-tone")).toBe("ok");
  });

  it("renders the sha value in a <code> element with 'commit <sha>' context", () => {
    render(<SnapshotPanel slug="test-project" snapshot={makeSnapshot({ sha: "deadbeef" })} />);
    const shaEl = screen.getByTestId("snapshot-panel-sha");
    expect(shaEl.textContent).toContain("deadbeef");
    expect(shaEl.tagName.toLowerCase()).toBe("code");
  });

  it("sha uses tabular-nums for numeric alignment (a11y)", () => {
    render(<SnapshotPanel slug="test-project" snapshot={makeSnapshot({ sha: "abc1234" })} />);
    const sha = screen.getByTestId("snapshot-panel-sha");
    const hasTabularNums =
      sha.className.includes("tabular-nums") ||
      (sha as HTMLElement).style.fontVariantNumeric === "tabular-nums";
    expect(hasTabularNums).toBe(true);
  });

  it("renders muted line with 'pasó todos los gates' (canonical copy)", () => {
    render(<SnapshotPanel slug="test-project" snapshot={makeSnapshot()} />);
    const panel = screen.getByTestId("snapshot-panel");
    expect(panel.textContent).toMatch(/pasó todos los gates/i);
  });

  it("renders muted line with 'Pruébalo en un worktree aparte' (canonical copy)", () => {
    render(<SnapshotPanel slug="test-project" snapshot={makeSnapshot()} />);
    const panel = screen.getByTestId("snapshot-panel");
    expect(panel.textContent).toMatch(/pruébalo en un worktree aparte/i);
  });
});

// ---------------------------------------------------------------------------
// AC-14-001.2 — worktree command in shared CmdRow (DR-057)
// ---------------------------------------------------------------------------

describe("SnapshotPanel — AC-14-001.2 (CmdRow + copy button)", () => {
  it("renders the worktree command in the shared CmdRow primitive (DR-057)", () => {
    const snapshot = makeSnapshot({
      sha: "abc1234",
      worktreeCommand: "git worktree add ../my-project-review abc1234",
    });
    render(<SnapshotPanel slug="my-project" snapshot={snapshot} />);
    // CmdRow renders data-testid="cmd-row"
    const cmdRow = screen.getByTestId("cmd-row");
    expect(cmdRow).toBeTruthy();
    expect(cmdRow.textContent).toContain("git worktree add ../my-project-review abc1234");
  });

  it("CmdRow contains a copy button", () => {
    render(<SnapshotPanel slug="test-project" snapshot={makeSnapshot()} />);
    // CopyButton renders data-testid="copy-button"
    expect(screen.getByTestId("copy-button")).toBeTruthy();
  });

  it("copy button aria-label starts with 'Copiar'", () => {
    const cmd = "git worktree add ../foo-review abc1234";
    const snapshot = makeSnapshot({ worktreeCommand: cmd });
    render(<SnapshotPanel slug="foo" snapshot={snapshot} />);
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
    expect(container.querySelector('[data-testid="snapshot-panel"]')).toBeNull();
  });

  it("renders no CmdRow when snapshot is null", () => {
    render(<SnapshotPanel slug="test-project" snapshot={null} />);
    expect(screen.queryByTestId("cmd-row")).toBeNull();
  });

  it("renders no copy button when snapshot is null", () => {
    render(<SnapshotPanel slug="test-project" snapshot={null} />);
    expect(screen.queryByTestId("copy-button")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// AC-14-002.1 — "building now" block (visually distinct, uses correct copy)
// ---------------------------------------------------------------------------

describe("SnapshotPanel — AC-14-002.1 (building now block)", () => {
  it("renders the building-now block when buildingNow is set", () => {
    const snapshot = makeSnapshot({ buildingNow: "building now: 45%" });
    render(<SnapshotPanel slug="test-project" snapshot={snapshot} />);
    expect(screen.getByTestId("snapshot-panel-building-now")).toBeTruthy();
  });

  it("building-now block contains 'El build sigue avanzando' (canonical copy)", () => {
    const snapshot = makeSnapshot({ buildingNow: "building now: 45%" });
    render(<SnapshotPanel slug="test-project" snapshot={snapshot} />);
    const block = screen.getByTestId("snapshot-panel-building-now");
    expect(block.textContent).toMatch(/el build sigue avanzando/i);
  });

  it("building-now block shows the progress value", () => {
    const snapshot = makeSnapshot({ buildingNow: "building now: 45%" });
    render(<SnapshotPanel slug="test-project" snapshot={snapshot} />);
    const block = screen.getByTestId("snapshot-panel-building-now");
    expect(block.textContent).toContain("45");
  });

  it("building-now block contains 'eso aún no está en verde, no lo pruebes' (canonical copy)", () => {
    const snapshot = makeSnapshot({ buildingNow: "building now: 75%" });
    render(<SnapshotPanel slug="test-project" snapshot={snapshot} />);
    const block = screen.getByTestId("snapshot-panel-building-now");
    expect(block.textContent).toMatch(/eso aún no está en verde.*no lo pruebes/i);
  });

  it("building-now block is rendered separately from the last-green section", () => {
    const snapshot = makeSnapshot({ buildingNow: "building now: 30%" });
    render(<SnapshotPanel slug="test-project" snapshot={snapshot} />);
    const panel = screen.getByTestId("snapshot-panel");
    const buildingNow = screen.getByTestId("snapshot-panel-building-now");
    expect(panel).toBeTruthy();
    expect(buildingNow).toBeTruthy();
    // They must be distinct elements — building-now is a different subtree from the green section
    const greenHeading = screen.getByTestId("snapshot-panel-green-section");
    expect(greenHeading).not.toBe(buildingNow);
  });

  it("building-now block is NOT rendered when buildingNow is undefined", () => {
    const snapshot = makeSnapshot({ buildingNow: undefined });
    render(<SnapshotPanel slug="test-project" snapshot={snapshot} />);
    expect(screen.queryByTestId("snapshot-panel-building-now")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// AC-14-003.1 — staleness warning on shared Banner (DR-057)
// ---------------------------------------------------------------------------

describe("SnapshotPanel — AC-14-003.1 (Banner staleness warning)", () => {
  it("renders the shared Banner when stale is true (DR-057, tone=warn)", () => {
    const snapshot = makeSnapshot({ stale: true });
    render(<SnapshotPanel slug="test-project" snapshot={snapshot} />);
    // Banner renders data-testid="banner" with data-tone="warn"
    const banner = screen.getByTestId("banner");
    expect(banner).toBeTruthy();
    expect(banner.getAttribute("data-tone")).toBe("warn");
  });

  it("Banner carries 'El último commit en verde quedó atrás' heading (canonical copy)", () => {
    const snapshot = makeSnapshot({ stale: true });
    render(<SnapshotPanel slug="test-project" snapshot={snapshot} />);
    const banner = screen.getByTestId("banner");
    expect(banner.textContent).toMatch(/el último commit en verde quedó atrás/i);
  });

  it("Banner has role=alert (a11y — warn state NOT by color alone)", () => {
    const snapshot = makeSnapshot({ stale: true });
    render(<SnapshotPanel slug="test-project" snapshot={snapshot} />);
    const banner = screen.getByTestId("banner");
    expect(banner.getAttribute("role")).toBe("alert");
  });

  it("Banner has an icon (not color alone — a11y)", () => {
    const snapshot = makeSnapshot({ stale: true });
    render(<SnapshotPanel slug="test-project" snapshot={snapshot} />);
    // Banner renders data-testid="banner-icon"
    expect(screen.getByTestId("banner-icon")).toBeTruthy();
  });

  it("does NOT render a Banner when stale is false", () => {
    const snapshot = makeSnapshot({ stale: false });
    render(<SnapshotPanel slug="test-project" snapshot={snapshot} />);
    expect(screen.queryByTestId("banner")).toBeNull();
  });

  it("does NOT render Banner for a fresh snapshot", () => {
    const snapshot = makeSnapshot({ stale: false, sha: "fresh123" });
    render(<SnapshotPanel slug="another-project" snapshot={snapshot} />);
    expect(screen.queryByTestId("banner")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Design token & accessibility checks
// ---------------------------------------------------------------------------

describe("SnapshotPanel — a11y + design contract", () => {
  it("snapshot panel is a section element (landmark)", () => {
    render(<SnapshotPanel slug="test-project" snapshot={makeSnapshot()} />);
    const panel = screen.getByTestId("snapshot-panel");
    expect(panel.tagName.toLowerCase()).toBe("section");
  });

  it("snapshot panel has an aria-label", () => {
    render(<SnapshotPanel slug="test-project" snapshot={makeSnapshot()} />);
    const panel = screen.getByTestId("snapshot-panel");
    expect(panel.getAttribute("aria-label")).toBeTruthy();
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
