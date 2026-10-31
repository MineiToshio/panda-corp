import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { parseFrdDrift } from "@/lib/frds/frd-drift";
import { DriftNote } from "../DriftNote";
import { FrdDriftBadge } from "../FrdDriftBadge";

describe("AC-12-003.3 drift source and presentation", () => {
  it("shows verified drift ids and a Cambios link from one reader result", () => {
    const drift = parseFrdDrift("---\ndrift: [REQ-05-001, AC-05-008.1]\n---");
    render(
      <>
        <FrdDriftBadge frdId="frd-05-orders" state="done" drift={drift} project="demo" />
        <DriftNote
          frdId="frd-05-orders"
          state="done"
          drift={drift}
          href="/portfolio/demo/observability"
        />
      </>,
    );
    expect(screen.getByRole("link", { name: "Verificado · 2 derivas" })).toHaveAttribute(
      "href",
      "/portfolio/demo/changes",
    );
    expect(screen.getByText(/REQ-05-001, AC-05-008.1/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver en Cambios" })).toBeInTheDocument();
    expect(document.querySelector(".drift-chip svg")).toHaveAttribute("aria-hidden", "true");
  });
  it.each([
    "todo",
    "in_progress",
    "review",
  ] as const)("suppresses a valid list while %s", (state) => {
    render(
      <FrdDriftBadge
        frdId="frd-05-orders"
        state={state}
        drift={{ ok: true, ids: ["REQ-05-001"] }}
        project="demo"
      />,
    );
    expect(screen.queryByText(/derivas?/)).not.toBeInTheDocument();
  });
  it.each(["todo", "done"] as const)("fails loud on malformed drift in any state (%s)", (state) => {
    const drift = parseFrdDrift("---\ndrift: broken\n---");
    render(
      <>
        <FrdDriftBadge frdId="frd-05-orders" state={state} drift={drift} project="demo" />
        <DriftNote
          frdId="frd-05-orders"
          state={state}
          drift={drift}
          href="/portfolio/demo/observability"
        />
      </>,
    );
    expect(screen.getByText("Deriva ilegible")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("no es una lista de requisitos");
  });
  it.each([
    { ok: true, ids: [] } as const,
    { ok: false, reason: "missing" } as const,
  ])("shows nothing for absent or empty drift", (drift) => {
    const { container } = render(
      <FrdDriftBadge frdId="frd-05-orders" state="done" drift={drift} project="demo" />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
