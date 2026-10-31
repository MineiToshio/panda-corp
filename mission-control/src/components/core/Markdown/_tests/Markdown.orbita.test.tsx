import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Markdown } from "../Markdown";

describe("Orbita document presentation", () => {
  it("applies hue and compact mode while keeping heading anchors", () => {
    render(
      <Markdown tone="teal" compact data-testid="document">
        {"# Project\n\n## Progress"}
      </Markdown>,
    );
    expect(screen.getByTestId("document")).toHaveAttribute("data-tone", "teal");
    expect(screen.getByTestId("document")).toHaveClass("md", "compact");
    expect(screen.getByRole("heading", { name: "Project" })).toHaveAttribute("id", "project");
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
  });
  it("adds a keyboard scroll target and a hint when a table overflows", () => {
    render(<Markdown>{"| Name | Status |\n| --- | --- |\n| Project | Built |"}</Markdown>);
    const region = screen.getByRole("region", { name: "Tabla desplazable" });
    expect(region).not.toHaveAttribute("tabindex");
    Object.defineProperties(region, {
      clientWidth: { configurable: true, value: 100 },
      scrollWidth: { configurable: true, value: 400 },
    });
    fireEvent.resize(window);
    expect(region).toHaveAttribute("tabindex", "0");
    const hint = screen.getByText("Desliza la tabla para ver todas las columnas");
    expect(region).toHaveAttribute("aria-describedby", hint.id);
    expect(screen.getAllByRole("table")).toHaveLength(1);
  });
});
