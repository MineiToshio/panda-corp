import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Markdown } from "@/components/core/Markdown/Markdown";
import { DocIndex } from "../DocIndex";
import { Paper } from "../Paper";

describe("shared document reader", () => {
  it("AC-08-020.3 exposes controlled search, typed filters, current link and disclosure", () => {
    const onQuery = vi.fn();
    const onOpenChange = vi.fn();
    const onSelect = vi.fn();
    render(
      <DocIndex
        groups={[
          {
            id: "frds",
            label: "FRDs",
            count: 1,
            items: [{ id: "one", label: "Feature", href: "/feature", current: true }],
          },
        ]}
        query=""
        onQuery={onQuery}
        open={false}
        onOpenChange={onOpenChange}
        toggleLabel="Elegir documento · 1"
        typeFilters={[{ id: "frd", label: "FRD", count: 1, selected: true, onSelect }]}
      />,
    );
    expect(screen.getByRole("link", { name: "Feature" })).toHaveAttribute("aria-current", "page");
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "spec" } });
    expect(onQuery).toHaveBeenCalledWith("spec");
    fireEvent.click(screen.getByRole("button", { name: "FRD · 1" }));
    expect(onSelect).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Elegir documento · 1" }));
    expect(onOpenChange).toHaveBeenCalledWith(true);
  });
  it("renders a typed paper with path copy and the shared Markdown body", () => {
    render(
      <Paper type="FRD" path="docs/frds/feature.md">
        <Markdown>{"## Feature\n\nDocument body"}</Markdown>
      </Paper>,
    );
    expect(screen.getByText("FRD")).toBeInTheDocument();
    expect(screen.getByText("docs/frds/feature.md")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copiar al portapapeles" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Feature" })).toBeInTheDocument();
  });
});
