/**
 * FrdDriftBadge (FRD-12 AC-12-003.3): "Verificado · N derivas" on a VERIFIED FRD whose `drift:`
 * frontmatter lists pre-existing drift, linking to the project's change queue. Fail-loud: a drift
 * value the reader could not interpret shows an error chip instead of vanishing.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { FrdDriftResult } from "@/lib/frds/frd-drift";
import { FrdDriftBadge } from "../FrdDriftBadge";

const TWO: FrdDriftResult = { ok: true, ids: ["AC-02-010.4", "REQ-03-001"] };

describe("FrdDriftBadge: a verified FRD with recorded drift", () => {
  it("shows 'Verificado · N derivas' as a link to the project's change queue", () => {
    render(<FrdDriftBadge frdId="frd-02-ideas-board" state="done" drift={TWO} project="alpha" />);
    const link = screen.getByRole("link", { name: /Verificado · 2 derivas/ });
    expect(link).toHaveAttribute("href", "?project=alpha&tab=changes");
    expect(link).toHaveAttribute("title", expect.stringContaining("AC-02-010.4, REQ-03-001"));
    expect(link).toHaveAttribute("data-testid", "frd-drift-badge-frd-02-ideas-board");
  });

  it("uses the singular for a single drift", () => {
    render(
      <FrdDriftBadge
        frdId="frd-02-ideas-board"
        state="done"
        drift={{ ok: true, ids: ["AC-02-010.4"] }}
        project="alpha"
      />,
    );
    expect(screen.getByRole("link", { name: /Verificado · 1 deriva$/ })).toBeInTheDocument();
  });

  it("conveys the warning by an icon and text, not color alone", () => {
    const { container } = render(
      <FrdDriftBadge frdId="frd-02-ideas-board" state="done" drift={TWO} project="alpha" />,
    );
    expect(container.querySelector("i.ti-alert-triangle")).toHaveAttribute("aria-hidden", "true");
  });
});

describe("FrdDriftBadge: renders nothing when there is nothing honest to claim", () => {
  const cases: readonly { readonly label: string; readonly drift: FrdDriftResult | undefined }[] = [
    { label: "no drift recorded", drift: { ok: true, ids: [] } },
    { label: "drift not resolved (hand-built timeline)", drift: undefined },
    { label: "no frd.md to read", drift: { ok: false, reason: "missing" } },
  ];
  for (const { label, drift } of cases) {
    it(`nothing for ${label}`, () => {
      const { container } = render(
        <FrdDriftBadge frdId="frd-02-ideas-board" state="done" drift={drift} project="alpha" />,
      );
      expect(container).toBeEmptyDOMElement();
    });
  }

  it("never claims VERIFIED on a FRD that is not verified (the list is a stale replica there)", () => {
    const { container } = render(
      <FrdDriftBadge frdId="frd-02-ideas-board" state="in_progress" drift={TWO} project="alpha" />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe("FrdDriftBadge: fail loud on an unreadable drift value (DR-078)", () => {
  it.each([
    "done",
    "in_progress",
    "todo",
  ] as const)("shows an error chip with the reason on a %s FRD", (state) => {
    render(
      <FrdDriftBadge
        frdId="frd-02-ideas-board"
        state={state}
        drift={{ ok: false, reason: "malformed", detail: "`drift` must be a list of REQ/AC ids" }}
        project="alpha"
      />,
    );
    const chip = screen.getByText("Deriva ilegible");
    expect(chip.closest("[title]")).toHaveAttribute(
      "title",
      expect.stringContaining("must be a list"),
    );
  });

  it("an unreadable frd.md is also an error chip", () => {
    render(
      <FrdDriftBadge
        frdId="frd-02-ideas-board"
        state="done"
        drift={{ ok: false, reason: "unreadable", detail: "EACCES" }}
        project="alpha"
      />,
    );
    expect(screen.getByText("Deriva ilegible")).toBeInTheDocument();
  });
});
