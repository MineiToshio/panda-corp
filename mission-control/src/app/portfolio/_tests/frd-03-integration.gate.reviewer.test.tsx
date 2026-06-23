/**
 * FRD-03 integration gate (DR-050, DR-015) — reviewer adversarial edge cases.
 *
 * The implementer's repair anchor (frd-03-integration.reviewer.test.tsx) covers the
 * happy paths (badge + recovery reach the rail; the rail item carries NO business
 * snapshot, per the prototype `.rail`). These tests probe the EDGE cases the
 * implementer did NOT write, exercising the WOs TOGETHER through the LIVE rail
 * (SelectableProjectRail), which is the only rail the /portfolio page renders:
 *
 *   - launched row AND broken-path row in ONE list (same render): no cross-row leakage,
 *     and neither carries a business snapshot.
 *   - AC-03-006.4 — no-repo missing-path row shows the warning, NOT a clone command.
 *   - AC-03-006.5/.6 — an EXISTING release (launched) row never shows the not-found badge.
 *   - empty-string repo treated as no-repo (RecoveryHint contract) on the live rail.
 *   - partial snapshot (only verdict) still surfaces; absent snapshot omitted silently.
 *   - selected vs unselected rows BOTH carry their snapshot/recovery (selection must not
 *     gate the contract — a regression class: "only the selected row got wired").
 *
 * Traceability: REQ-03-003, REQ-03-006 → CMP-03-rail (the LIVE rail). FRD-03 gate.
 */

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ProjectListItem } from "@/lib/portfolio/portfolio";
import type { StatusResult } from "@/lib/status/status";
import { SelectableProjectRail } from "../SelectableProjectRail";

function status(phase: string, running?: boolean): StatusResult {
  return {
    present: true,
    malformed: false,
    status: { phase: phase as never, ...(running !== undefined ? { running } : {}) },
  };
}

const absentStatus: StatusResult = { present: false, malformed: false, status: null };

const SHIPPED: ProjectListItem = {
  name: "winner",
  path: "/p/winner",
  status: status("release", false),
  exists: true,
  stage: "release",
  running: false,
  snapshot: { users: "500", returnMetric: "$1 200 MRR", verdict: "double-down" },
};

const BROKEN_WITH_REPO: ProjectListItem = {
  name: "gone-repo",
  path: "/p/gone-repo",
  repo: "https://github.com/ada/gone.git",
  status: absentStatus,
  exists: false,
  stage: "implementation",
  running: undefined,
};

const BROKEN_NO_REPO: ProjectListItem = {
  name: "gone-orphan",
  path: "/p/gone-orphan",
  status: absentStatus,
  exists: false,
  stage: "implementation",
  running: undefined,
};

function rowFor(name: string): HTMLElement {
  return screen.getByRole("article", { name: new RegExp(name, "i") });
}

describe("FRD-03 integration gate — LIVE rail edge cases (reviewer)", () => {
  it("launched row and broken-path row coexist in one list without cross-leakage", () => {
    render(<SelectableProjectRail items={[SHIPPED, BROKEN_WITH_REPO]} selectedSlug="winner" />);

    const winner = rowFor("winner");
    const gone = rowFor("gone-repo");

    // The launched row carries no business snapshot (prototype `.rail`) and no recovery hint.
    expect(within(winner).queryByTestId("business-snapshot")).toBeNull();
    expect(within(winner).queryByText("double-down")).toBeNull();
    expect(within(winner).queryByText(/ruta no encontrada|path not found/i)).toBeNull();

    // The broken row has the recovery hint, and (like every row) no snapshot values.
    expect(within(gone).queryByText(/ruta no encontrada|path not found/i)).not.toBeNull();
    expect(within(gone).queryByText("500")).toBeNull();
    expect(within(gone).queryByText("double-down")).toBeNull();
  });

  it("AC-03-006.4 — a missing-path row with NO repo shows the warning, not a clone command", () => {
    render(<SelectableProjectRail items={[BROKEN_NO_REPO]} selectedSlug="gone-orphan" />);

    const row = rowFor("gone-orphan");
    expect(within(row).queryByText(/ruta no encontrada|path not found/i)).not.toBeNull();
    // No clone command must appear.
    expect(within(row).queryByText(/git clone/i)).toBeNull();
    // The no-remote warning must appear (mentions /pandacorp:spec).
    expect(within(row).queryByText(/pandacorp:spec/i)).not.toBeNull();
  });

  it("AC-03-006.5/.6 — an EXISTING release (launched) row never shows the not-found badge", () => {
    render(<SelectableProjectRail items={[SHIPPED]} selectedSlug="winner" />);

    const row = rowFor("winner");
    expect(within(row).queryByText(/ruta no encontrada|path not found/i)).toBeNull();
    expect(within(row).queryByText(/git clone/i)).toBeNull();
  });

  it("an empty-string repo on a broken row is treated as no-repo (warning, no clone)", () => {
    const brokenEmptyRepo: ProjectListItem = { ...BROKEN_NO_REPO, name: "gone-empty", repo: "" };
    render(<SelectableProjectRail items={[brokenEmptyRepo]} selectedSlug="gone-empty" />);

    const row = rowFor("gone-empty");
    expect(within(row).queryByText(/ruta no encontrada|path not found/i)).not.toBeNull();
    expect(within(row).queryByText(/git clone/i)).toBeNull();
    expect(within(row).queryByText(/pandacorp:spec/i)).not.toBeNull();
  });

  it("a row never renders a business-snapshot block, even with snapshot data on the model", () => {
    const partial: ProjectListItem = {
      ...SHIPPED,
      name: "partial",
      snapshot: { verdict: "hold" },
    };
    const noSnap: ProjectListItem = {
      name: "no-snap",
      path: "/p/no-snap",
      status: status("release", false),
      exists: true,
      stage: "release",
      running: false,
    };
    render(<SelectableProjectRail items={[partial, noSnap]} selectedSlug="partial" />);

    // Prototype `.rail`: no snapshot in the rail, regardless of the data model.
    const partialRow = rowFor("partial");
    expect(within(partialRow).queryByTestId("business-snapshot")).toBeNull();
    expect(within(partialRow).queryByText("hold")).toBeNull();

    const noSnapRow = rowFor("no-snap");
    expect(within(noSnapRow).queryByTestId("business-snapshot")).toBeNull();
  });

  it("selection does not gate the contract — an UNSELECTED broken row still carries recovery", () => {
    render(
      <SelectableProjectRail
        items={[SHIPPED, BROKEN_WITH_REPO]}
        // Select the launched row; the broken (recovery) row is unselected.
        selectedSlug="winner"
      />,
    );

    const winner = rowFor("winner");
    expect(winner.getAttribute("data-selected")).toBe("true");
    // No business snapshot reaches the rail item (prototype `.rail`).
    expect(within(winner).queryByTestId("business-snapshot")).toBeNull();

    const gone = rowFor("gone-repo");
    expect(gone.getAttribute("data-selected")).toBe("false");
    // The unselected broken row must still render its recovery command.
    expect(within(gone).queryByText(/git clone/i)).not.toBeNull();
    expect(within(gone).queryByText(/sync-portfolio/i)).not.toBeNull();
  });
});
