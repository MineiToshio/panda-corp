/** WO-13-011 — Ring, StateDot, BadgeIcon, KeyValue: names and text alongside hue. AC-13-010.1, REQ-13-009. */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BadgeIcon } from "../../BadgeIcon/BadgeIcon";
import { KeyValue } from "../../KeyValue/KeyValue";
import { StateDot } from "../../StateDot/StateDot";
import { Ring } from "../Ring";

describe("AC-13-010.1: Ring and friends", () => {
  it("AC-13-010.1: a ring with a tip is a focusable image named by the sentence and carries data-tip", () => {
    render(<Ring percent={81} tip="39 de 48 work orders verificadas" />);
    const ring = screen.getByRole("img", { name: "39 de 48 work orders verificadas" });
    expect(ring.getAttribute("tabindex")).toBe("0");
    expect(ring.getAttribute("data-tip")).toBe("39 de 48 work orders verificadas");
    expect(ring.textContent).toBe("81%");
  });

  it("AC-13-010.1: without a tip the ring is not focusable, is named by the percentage and goes green at 100", () => {
    render(<Ring percent={120} />);
    const ring = screen.getByRole("img", { name: "100% completado" });
    expect(ring.getAttribute("tabindex")).toBeNull();
    expect(ring.getAttribute("data-tone")).toBe("green");
  });

  it("AC-13-010.1: StateDot always writes the state word; BadgeIcon is decorative unless labelled; KeyValue is a description list", () => {
    const { container } = render(
      <>
        <StateDot state="blocked" />
        <BadgeIcon icon="alert" tone="coral" label="Alerta" />
        <KeyValue items={[{ id: "a", label: "Rama", value: "main" }]} />
      </>,
    );
    expect(screen.getByText("Bloqueado")).toBeTruthy();
    expect(screen.getByRole("img", { name: "Alerta" })).toBeTruthy();
    expect(container.querySelector("dt")?.textContent).toBe("Rama");
    expect(container.querySelector("dd")?.textContent).toBe("main");
  });
});
