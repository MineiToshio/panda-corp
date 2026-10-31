import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DataModelViewer } from "../DataModelViewer";
import { readyFixture } from "./fixture";
import { waitForLayout } from "./waitForLayout";

beforeEach(() => window.history.replaceState({}, "", "/portfolio/a/architecture"));
afterEach(cleanup);

describe("WO-02-018 viewer, independent edge review", () => {
  it("AC-02-015.5: a search hit is highlighted, never dimmed by the first hit's selection", async () => {
    render(<DataModelViewer result={readyFixture()} />);
    await waitForLayout();
    fireEvent.change(await screen.findByRole("searchbox"), { target: { value: "id" } });
    const dimmed = [...document.querySelectorAll("[data-match='true'][data-dimmed='true']")].map(
      (card) => card.getAttribute("aria-label"),
    );
    expect(dimmed).toEqual([]);
  });

  it("AC-02-015.5: clearing the search leaves the model data intact", async () => {
    render(<DataModelViewer result={readyFixture()} />);
    await waitForLayout();
    const input = await screen.findByRole("searchbox");
    fireEvent.change(input, { target: { value: "nothing-here" } });
    expect(document.querySelectorAll(".entity")).toHaveLength(3);
    fireEvent.change(input, { target: { value: "" } });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("AC-02-015.7: an unavailable selection is explicit and never invents a selected card", async () => {
    window.history.replaceState({}, "", "/portfolio/a/architecture?entity=ghost");
    render(<DataModelViewer result={readyFixture()} />);
    await waitForLayout();
    expect(await screen.findByRole("status")).toHaveTextContent("no está disponible");
    expect(document.querySelectorAll("[data-selected='true']")).toHaveLength(0);
  });
});
