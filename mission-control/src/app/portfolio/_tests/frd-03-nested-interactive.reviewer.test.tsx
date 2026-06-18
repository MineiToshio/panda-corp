/**
 * FRD-03 integration gate (DR-050, DR-015) — reviewer adversarial test:
 * NO nested interactive content on the LIVE rail.
 *
 * The repair (WO-03-004) wired RecoveryHint into SelectableProjectRail's row.
 * But every row in SelectableProjectRail is wrapped in a Next.js <Link> (an <a>),
 * and RecoveryHint renders a CopyButton (a <button>) for the recovery command.
 * A <button> nested inside an <a> is INVALID interactive-content nesting (HTML
 * spec / WCAG 4.1.2): React emits a hydration error, and a click on "copiar"
 * also fires the anchor's navigation — the copy affordance cannot work in place.
 *
 * The standalone RecoveryHint unit tests rendered it OUTSIDE any link, so the
 * defect only appears in integration — exactly what this FRD gate exists to catch.
 *
 * Traceability: AC-03-006.3 (copyable recovery), AC-03-006.5 (read-only — the
 * recovery must be usable as copyable text, not hijacked into navigation).
 */

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ProjectListItem } from "@/lib/portfolio/portfolio";
import type { StatusResult } from "@/lib/status/status";
import { SelectableProjectRail } from "../SelectableProjectRail";

const absentStatus: StatusResult = { present: false, malformed: false, status: null };

const BROKEN_WITH_REPO: ProjectListItem = {
  name: "gone-repo",
  path: "/p/gone-repo",
  repo: "https://github.com/ada/gone.git",
  status: absentStatus,
  exists: false,
  stage: "implementation",
  running: undefined,
};

describe("FRD-03 integration gate — no nested interactive content (reviewer)", () => {
  it("AC-03-006.3 — the recovery copy button is NOT nested inside the row's navigation link", () => {
    render(<SelectableProjectRail items={[BROKEN_WITH_REPO]} selectedSlug="gone-repo" />);

    const row = screen.getByRole("article", { name: /gone-repo/i });
    const copyButton = within(row).queryByTestId("copy-button");
    expect(copyButton).not.toBeNull();

    // Walk up from the copy button: it must NOT have an ancestor <a> element.
    // A <button> inside an <a> is invalid interactive-content nesting; clicking
    // it would also trigger the row link navigation.
    let ancestor: HTMLElement | null = copyButton?.parentElement ?? null;
    let nestedInsideAnchor = false;
    while (ancestor !== null) {
      if (ancestor.tagName === "A") {
        nestedInsideAnchor = true;
        break;
      }
      ancestor = ancestor.parentElement;
    }
    expect(nestedInsideAnchor).toBe(false);
  });
});
