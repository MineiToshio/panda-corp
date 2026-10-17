import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Markdown } from "../Markdown";

afterEach(() => vi.restoreAllMocks());

describe("shared document heading locations", () => {
  it("preserves Unicode and formatted heading text and disambiguates duplicate IDs", () => {
    render(
      <Markdown>
        {
          "## Diseño de **datos**\n\n## Diseño de datos\n\n## Diseño de datos-1\n\n## Diseño de datos"
        }
      </Markdown>,
    );
    expect(screen.getAllByRole("heading").map((heading) => heading.id)).toEqual([
      "diseño-de-datos",
      "diseño-de-datos-1",
      "diseño-de-datos-1-1",
      "diseño-de-datos-2",
    ]);
  });
  it("restores a pasted heading after async content arrives and on browser fragment navigation", () => {
    const scrolled: string[] = [];
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(function (this: HTMLElement) {
        scrolled.push(this.id);
      }),
    });
    window.history.replaceState({}, "", "/portfolio/p/documents/docs%2Fprd#dise%C3%B1o");
    const { rerender } = render(<Markdown>{"Loading body"}</Markdown>);
    expect(scrolled).toEqual([]);
    rerender(<Markdown>{"## Diseño\n\n## Alcance"}</Markdown>);
    expect(scrolled).toEqual(["diseño"]);
    act(() => {
      window.history.replaceState({}, "", "/portfolio/p/documents/docs%2Fprd#alcance");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(scrolled).toEqual(["diseño", "alcance"]);
  });
  it("keeps same-document heading links in the current browsing context", () => {
    render(<Markdown>{"[Read scope](#scope)\n\n## Scope"}</Markdown>);
    expect(screen.getByRole("link", { name: "Read scope" })).toHaveAttribute("href", "#scope");
    expect(screen.getByRole("link", { name: "Read scope" })).not.toHaveAttribute("target");
  });
});
