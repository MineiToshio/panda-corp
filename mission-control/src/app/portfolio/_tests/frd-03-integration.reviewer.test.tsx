/**
 * FRD-03 integration gate (DR-050, DR-015) — reviewer-authored adversarial tests.
 *
 * The per-WO unit tests are all green in isolation, but they test the standalone
 * components (BusinessSnapshot, RecoveryHint, PortfolioEmpty) and the original
 * ProjectRail module — NONE of which the live /portfolio page actually renders.
 * The live page composes `SelectableProjectRail` (WO-03-004), which dropped the
 * business snapshot and the path-not-found recovery when it replaced ProjectRail.
 *
 * These tests exercise the rail the page actually renders, asserting the FRD's
 * acceptance criteria reach the integrated surface:
 *   AC-03-003.1 — a shipped (operation) project shows its business snapshot.
 *   AC-03-006.2 — a project whose path is missing shows a ⚠ path-not-found badge.
 *   AC-03-006.3 — with a repo, that row shows the copyable recovery command.
 *
 * Traceability: REQ-03-003, REQ-03-006 → CMP-03-rail (the LIVE rail).
 */

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ProjectListItem } from "@/lib/portfolio/portfolio";
import type { StatusResult } from "@/lib/status/status";
import { SelectableProjectRail } from "../SelectableProjectRail";

function makeStatus(phase: string, running?: boolean): StatusResult {
  return {
    present: true,
    malformed: false,
    status: { phase: phase as never, ...(running !== undefined ? { running } : {}) },
  };
}

const SHIPPED_WITH_SNAPSHOT: ProjectListItem = {
  name: "proj-shipped",
  path: "/projects/proj-shipped",
  status: makeStatus("operation", false),
  exists: true,
  stage: "operation",
  running: false,
  snapshot: { users: "1234", returnMetric: "$980 MRR", verdict: "double-down" },
};

const MISSING_PATH_WITH_REPO: ProjectListItem = {
  name: "proj-gone",
  path: "/projects/proj-gone",
  repo: "https://github.com/acme/proj-gone.git",
  status: { present: false, malformed: false, status: null },
  exists: false,
  stage: "implementation",
  running: undefined,
};

describe("FRD-03 integration gate — the LIVE rail (SelectableProjectRail)", () => {
  it("AC-03-003.1 — a shipped project's business snapshot reaches the rendered rail", () => {
    render(<SelectableProjectRail items={[SHIPPED_WITH_SNAPSHOT]} selectedSlug="proj-shipped" />);

    const row = screen.getByRole("article", { name: /proj-shipped/i });
    // The snapshot values must be visible somewhere in the row, not just on the data model.
    expect(within(row).queryByText("1234")).not.toBeNull();
    expect(within(row).queryByText("$980 MRR")).not.toBeNull();
    expect(within(row).queryByText("double-down")).not.toBeNull();
  });

  it("AC-03-006.2 — a missing-path project shows the ⚠ path-not-found badge on its row", () => {
    render(<SelectableProjectRail items={[MISSING_PATH_WITH_REPO]} selectedSlug="proj-gone" />);

    const row = screen.getByRole("article", { name: /proj-gone/i });
    // Badge text per FRD-03 / FRD-15/16 banner shape.
    expect(within(row).queryByText(/ruta no encontrada|path not found/i)).not.toBeNull();
  });

  it("AC-03-006.3 — a missing-path project with a repo shows the copyable recovery command", () => {
    render(<SelectableProjectRail items={[MISSING_PATH_WITH_REPO]} selectedSlug="proj-gone" />);

    const row = screen.getByRole("article", { name: /proj-gone/i });
    // The recovery command must mention the clone + the sync step.
    const recovery = within(row).queryByText(/git clone/i);
    expect(recovery).not.toBeNull();
    expect(within(row).queryByText(/sync-portfolio/i)).not.toBeNull();
  });
});
