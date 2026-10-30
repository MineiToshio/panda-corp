/**
 * FRD-14 gate — adversarial / integration tests (DR-015).
 *
 * Written by the reviewer (a different model from the implementers) to exercise
 * the work orders TOGETHER: WO-14-001 helpers feed WO-14-005 panel feed the same
 * shapes the FRD-04 page derives. These probe edges the implementer tests did not:
 *   - buildSnapshot → SnapshotPanel end-to-end (not the panel in isolation).
 *   - staleness wiring: isSnapshotStale verdict actually drives the amber Notice.
 *   - buildingNow stays the plain "building now" sentinel (the old `progress`
 *     status.yaml field had no writer anywhere and was removed, DR-092/DR-115), and
 *     the panel renders the Órbita sentence, never the sentinel.
 *   - safeToTest=false while the panel still shows the green pill.
 *   - whitespace-only sha, slug with shell metacharacters in the shown command.
 *
 * Primitive reuse (DR-057) — queried via the shared primitives' testids:
 *   - Command row  → data-testid="cmd-row"   (CmdRow, not a bespoke element)
 *   - Stale warn   → role="status"           (Notice tone="amber", not a bespoke element)
 *   - Stale icon   → the Notice's own svg    (icon + text, never colour alone)
 *   - Green signal → data-testid="chip"      (Chip tone="green" in CardHeader, not a bespoke badge)
 *
 * These tests are NOT decorative: each would fail against a plausible naive
 * implementation (e.g. one that fires the warning unconditionally).
 */

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  buildSnapshot,
  isSnapshotStale,
  SNAPSHOT_STALE_COMMITS_THRESHOLD,
  SNAPSHOT_STALE_HOURS_THRESHOLD,
  type SnapshotInfo,
} from "@/lib/snapshot/snapshot";
import type { ProjectStatus } from "@/lib/status/status";
import { SnapshotPanel } from "../snapshot-panel";

/**
 * The git probe's `gap` prop. Spread into the panel so this suite also type-checks while the
 * panel in the tree does not declare the prop yet.
 */
function probe(commitsBehind: number, hoursBehind: number, stale: boolean) {
  return { gap: { status: "ok", commitsBehind, hoursBehind, stale } } as const;
}

/** The verdict pill of the card header: the one chip beside the h2 title. */
function verdictPill(): HTMLElement {
  const header = screen.getByRole("heading", { level: 2 }).parentElement as HTMLElement;
  return within(header).getByTestId("chip");
}

function status(overrides: Partial<ProjectStatus> = {}): Partial<ProjectStatus> {
  return {
    project: "p",
    running: false,
    lastGreenSha: "abc1234",
    safeToTest: true,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Integration: buildSnapshot output drives the panel (the real page seam).
// ---------------------------------------------------------------------------

describe("FRD-14 integration — buildSnapshot feeds SnapshotPanel (the page.tsx seam)", () => {
  it("absent last_green_sha → buildSnapshot null → panel renders nothing", () => {
    const snap = buildSnapshot("proj", status({ lastGreenSha: undefined }));
    expect(snap).toBeNull();
    const { container } = render(<SnapshotPanel slug="proj" snapshot={snap} />);
    expect(container.firstChild).toBeNull();
    expect(screen.queryByTestId("snapshot-panel")).toBeNull();
  });

  it("derived command from buildSnapshot is the exact string shown in CmdRow (DR-057)", () => {
    const snap = buildSnapshot("mission-control", status({ lastGreenSha: "d150223" }));
    render(<SnapshotPanel slug="mission-control" snapshot={snap} />);
    // Command is shown inside the shared CmdRow (data-testid="cmd-row")
    const cmdRow = screen.getByTestId("cmd-row");
    expect(cmdRow.textContent).toContain(
      "git worktree add /Users/Shared/review-worktrees/mission-control d150223",
    );
  });

  it("running build → buildingNow set by helper → panel shows the don't-test-yet block", () => {
    const snap = buildSnapshot(
      "proj",
      status({ running: true, supervisorHeartbeat: new Date().toISOString() }),
    );
    render(<SnapshotPanel slug="proj" snapshot={snap} />);
    const block = screen.getByTestId("snapshot-panel-building-now");
    expect(block.textContent).toContain("Construyendo ahora:");
    expect(block.textContent).toContain("no lo pruebes");
    // The helper's sentinel is data, not copy: it never reaches the screen.
    expect(block.textContent).not.toContain("building now");
  });

  it("stopped build → no buildingNow → panel omits the building-now block", () => {
    const snap = buildSnapshot("proj", status({ running: false }));
    render(<SnapshotPanel slug="proj" snapshot={snap} />);
    expect(screen.queryByTestId("snapshot-panel-building-now")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// AC-14-002.1 — the staleness verdict must actually drive the amber Notice.
// This is the seam blueprint §5 deferred: prove the panel reacts to the
// isSnapshotStale verdict so wiring the git probe later is a one-line change.
// ---------------------------------------------------------------------------

describe("FRD-14 staleness — isSnapshotStale verdict drives the amber Notice (AC-14-002.1)", () => {
  it("verdict TRUE (>= commit threshold) → Notice shown (DR-057, tone=amber)", () => {
    const snap = buildSnapshot("proj", status());
    const stale = isSnapshotStale(SNAPSHOT_STALE_COMMITS_THRESHOLD, 0);
    expect(stale).toBe(true);
    render(
      <SnapshotPanel
        slug="proj"
        snapshot={snap}
        {...probe(SNAPSHOT_STALE_COMMITS_THRESHOLD, 0, stale)}
      />,
    );
    // Staleness warning is the shared Notice (role="status")
    const notice = screen.getByRole("status");
    expect(notice.getAttribute("data-tone")).toBe("amber");
    expect(notice.textContent).toContain("Este commit quedó atrás del build");
    expect(verdictPill().textContent).toContain("Quedó atrás del build");
  });

  it("verdict TRUE (>= hour threshold) → Notice shown even with 0 commits behind", () => {
    const snap = buildSnapshot("proj", status());
    const stale = isSnapshotStale(0, SNAPSHOT_STALE_HOURS_THRESHOLD);
    expect(stale).toBe(true);
    render(
      <SnapshotPanel
        slug="proj"
        snapshot={snap}
        {...probe(0, SNAPSHOT_STALE_HOURS_THRESHOLD, stale)}
      />,
    );
    expect(screen.getByRole("status").textContent).toContain(
      `${SNAPSHOT_STALE_HOURS_THRESHOLD} horas`,
    );
  });

  it("verdict FALSE (fresh, just below both thresholds) → NO Notice", () => {
    const snap = buildSnapshot("proj", status());
    const stale = isSnapshotStale(
      SNAPSHOT_STALE_COMMITS_THRESHOLD - 1,
      SNAPSHOT_STALE_HOURS_THRESHOLD - 1,
    );
    expect(stale).toBe(false);
    render(
      <SnapshotPanel
        slug="proj"
        snapshot={snap}
        {...probe(SNAPSHOT_STALE_COMMITS_THRESHOLD - 1, SNAPSHOT_STALE_HOURS_THRESHOLD - 1, stale)}
      />,
    );
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("Notice carries text + icon (not color alone) — a11y; role=status", () => {
    const snap = buildSnapshot("proj", status());
    render(<SnapshotPanel slug="proj" snapshot={snap} {...probe(14, 26, true)} />);
    // role="status" is the drawn notice contract (fdd.md States, Responsive & accessibility)
    const notice = screen.getByRole("status");
    // The measured distance and its consequence are text, not color alone
    expect(notice.textContent).toContain("El build lleva 14 commits y 26 horas más.");
    expect(notice.textContent).toContain("ya no refleja lo que el build construyó");
    // The alert icon travels with the text
    expect(notice.innerHTML).toContain('data-icon="alert"');
  });
});

// ---------------------------------------------------------------------------
// buildingNow copy stays sane — status.yaml's `progress` field had no writer
// anywhere and was removed (DR-092/DR-115 dead-field cleanup); buildingNow is
// always the plain "building now" string now, regardless of what other numeric
// noise might appear on the status object.
// ---------------------------------------------------------------------------

describe("FRD-14 buildingNow — always the plain 'building now' string (no fabricated percentage)", () => {
  it("running with a fresh heartbeat → buildingNow is exactly 'building now'", () => {
    const snap = buildSnapshot(
      "proj",
      status({ running: true, supervisorHeartbeat: new Date().toISOString() }),
    );
    expect(snap?.buildingNow).toBe("building now");
    render(<SnapshotPanel slug="proj" snapshot={snap} />);
    expect(screen.getByTestId("snapshot-panel-building-now")).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// safeToTest semantics — AC-14-001.1 reads BOTH last_green_sha AND safe_to_test.
// When safeToTest=false the panel MUST NOT claim "seguro para probar".
// The previous version of this test was decorative (it pinned broken behavior).
// These tests are the CORRECT behavior per AC-14-001.1 and the gate review.
// ---------------------------------------------------------------------------

describe("FRD-14 safeToTest — panel MUST consult safe_to_test (AC-14-001.1)", () => {
  it("safeToTest=false: panel still renders (snapshot non-null) but does NOT say 'seguro para probar'", () => {
    const snap = buildSnapshot("proj", status({ safeToTest: false }));
    expect(snap).not.toBeNull();
    expect((snap as SnapshotInfo).safeToTest).toBe(false);
    render(<SnapshotPanel slug="proj" snapshot={snap} />);
    // The panel must NOT claim "seguro para probar" when safeToTest=false
    const panel = screen.getByTestId("snapshot-panel");
    expect(panel.textContent).not.toMatch(/segur[ao] para probar/i);
  });

  it("safeToTest=false: panel shows the sha + worktree command (the info is still useful)", () => {
    const snap = buildSnapshot("proj", status({ safeToTest: false }));
    render(<SnapshotPanel slug="proj" snapshot={snap} />);
    // SHA is still shown
    expect(screen.getByTestId("snapshot-panel-sha")).toBeTruthy();
    // Command row is still shown
    expect(screen.getByTestId("cmd-row")).toBeTruthy();
  });

  it("safeToTest=false: pill is amber (not a green signal when not safe)", () => {
    const snap = buildSnapshot("proj", status({ safeToTest: false }));
    render(<SnapshotPanel slug="proj" snapshot={snap} />);
    // Must be amber (green would imply safe when it's not)
    expect(verdictPill().getAttribute("data-tone")).toBe("amber");
  });

  it("safeToTest=true: panel shows 'Seguro para probar' (normal green state)", () => {
    const snap = buildSnapshot("proj", status({ safeToTest: true }));
    render(<SnapshotPanel slug="proj" snapshot={snap} />);
    expect(verdictPill().textContent).toContain("Seguro para probar");
  });

  it("safeToTest=true: pill is green (green signal)", () => {
    const snap = buildSnapshot("proj", status({ safeToTest: true }));
    render(<SnapshotPanel slug="proj" snapshot={snap} />);
    expect(verdictPill().getAttribute("data-tone")).toBe("green");
  });
});

// ---------------------------------------------------------------------------
// sha / slug robustness in the command shown to the operator.
// ---------------------------------------------------------------------------

describe("FRD-14 robustness — sha/slug edges in the shown command", () => {
  it("whitespace-only sha is treated as absent → null (no broken command)", () => {
    expect(buildSnapshot("proj", status({ lastGreenSha: "   " }))).toBeNull();
  });

  it("slug is embedded verbatim in CmdRow — read-only display only (not executed)", () => {
    // FRD-14 non-goal: MC shows the command, never executes it. Verify the
    // panel only renders text; a weird slug appears as-is, harmless on screen.
    const snap = buildSnapshot("a b;rm", status({ lastGreenSha: "deadbee" }));
    render(<SnapshotPanel slug="a b;rm" snapshot={snap} />);
    // Command is in the shared CmdRow (data-testid="cmd-row")
    const cmdRow = screen.getByTestId("cmd-row");
    expect(cmdRow.textContent).toContain(
      "git worktree add /Users/Shared/review-worktrees/a b;rm deadbee",
    );
    // The cmd-row is a plain div (not an executed action)
    expect(cmdRow.tagName.toLowerCase()).toBe("div");
  });
});
