import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Tabs } from "../Tabs";

describe("Orbita controlled tabs", () => {
  it("links panels and skips disabled tabs without changing controlled selection", () => {
    const onChange = vi.fn();
    render(
      <Tabs
        tabs={[
          { id: "a", label: "Alpha", tone: "teal", icon: "book", panelId: "alpha-panel" },
          { id: "b", label: "Beta", disabled: true },
          { id: "c", label: "Gamma", count: 0 },
        ]}
        active="a"
        onChange={onChange}
      />,
    );
    const first = screen.getByRole("tab", { name: "Alpha" });
    expect(first).toHaveAttribute("aria-controls", "alpha-panel");
    expect(first).toHaveAttribute("data-tone", "teal");
    expect(first.querySelector("svg")).not.toBeNull();
    first.focus();
    fireEvent.keyDown(first, { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "Gamma 0" })).toHaveFocus();
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.keyDown(document.activeElement ?? first, { key: " " });
    expect(onChange).toHaveBeenCalledWith("c");
    expect(first).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(document.activeElement ?? first, { key: "Home" });
    expect(first).toHaveFocus();
    expect(screen.getByRole("tab", { name: "Beta" })).toBeDisabled();
  });
  it("shows named overflow controls and scrolls by a viewport", async () => {
    render(<Tabs tabs={[{ id: "a", label: "Alpha" }]} active="a" onChange={vi.fn()} />);
    const strip = screen.getByRole("tablist");
    Object.defineProperties(strip, {
      clientWidth: { configurable: true, value: 100 },
      scrollWidth: { configurable: true, value: 400 },
    });
    const scrollBy = vi.fn();
    strip.scrollBy = scrollBy;
    fireEvent.resize(window);
    const next = await screen.findByRole("button", { name: "Ver más secciones" });
    fireEvent.click(next);
    expect(scrollBy).toHaveBeenCalledWith({ left: 100, behavior: "auto" });
    strip.scrollLeft = 300;
    fireEvent.scroll(strip);
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Ver más secciones" })).toBeNull(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Ver secciones anteriores" }));
    expect(scrollBy).toHaveBeenLastCalledWith({ left: -100, behavior: "auto" });
  });
});
