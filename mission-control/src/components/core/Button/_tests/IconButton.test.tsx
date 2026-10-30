/** WO-13-011 — IconButton requires a Spanish name; ButtonLink is a real link; StackBar words every segment. AC-13-010.1. */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProgressBar } from "../../ProgressBar/ProgressBar";
import { StackBar } from "../../ProgressBar/StackBar";
import { ButtonLink } from "../ButtonLink";
import { IconButton } from "../IconButton";

describe("AC-13-010.1: button family", () => {
  it("AC-13-010.1: IconButton is named, an empty name throws, ButtonLink is an anchor", () => {
    render(<IconButton icon="copy" label="Copiar comando" />);
    expect(screen.getByRole("button", { name: "Copiar comando" })).toBeTruthy();
    expect(() => render(<IconButton icon="copy" label=" " />)).toThrow(/accessible label/);
    render(<ButtonLink href="/x">Abrir</ButtonLink>);
    expect(screen.getByRole("link", { name: "Abrir" }).getAttribute("href")).toBe("/x");
  });

  it("AC-13-010.1: StackBar lists each state with its count; the hue ProgressBar keeps progressbar semantics", () => {
    render(
      <>
        <StackBar
          segments={[
            { label: "Verificado", count: 3, tone: "green" },
            { label: "En curso", count: 0, tone: "blue" },
          ]}
        />
        <ProgressBar done={1} total={4} tone="violet" ariaLabel="Avance" />
      </>,
    );
    expect(screen.getByRole("img", { name: "3 Verificado" })).toBeTruthy();
    expect(screen.getByRole("progressbar", { name: "Avance" }).getAttribute("aria-valuenow")).toBe(
      "1",
    );
  });
});
