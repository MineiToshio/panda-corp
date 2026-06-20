/**
 * WO-13-007 — CountBadge (CMP-13-countbadge) — TDD tests
 *
 * Numeric pill for rail/badge counts. A Chip count preset.
 * tabular-nums, canvas-colored numeral, 17px min.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CountBadge, type CountBadgeProps } from "@/components/core/CountBadge/CountBadge";

function renderBadge(props: CountBadgeProps) {
  return render(<CountBadge {...props} />);
}

describe("frd-13/wo-13-007: CountBadge — rendering", () => {
  it("frd-13: CountBadge — renders count as text", () => {
    renderBadge({ count: 5, tone: "warn" });
    expect(screen.getByText("5")).toBeDefined();
  });

  it("frd-13: CountBadge — has data-testid='count-badge'", () => {
    renderBadge({ count: 3, tone: "accent" });
    expect(screen.getByTestId("count-badge")).toBeDefined();
  });

  it("frd-13: CountBadge — has data-tone attribute", () => {
    renderBadge({ count: 7, tone: "danger" });
    const el = screen.getByTestId("count-badge");
    expect(el.getAttribute("data-tone")).toBe("danger");
  });

  it("frd-13: CountBadge — zero count renders '0'", () => {
    renderBadge({ count: 0, tone: "ok" });
    expect(screen.getByText("0")).toBeDefined();
  });

  it("frd-13: CountBadge — large count renders correctly", () => {
    renderBadge({ count: 999, tone: "warn" });
    expect(screen.getByText("999")).toBeDefined();
  });
});

describe("frd-13/wo-13-007: CountBadge — tokens only", () => {
  it("frd-13: CountBadge — inline style uses var() not hardcoded hex", () => {
    const { container } = renderBadge({ count: 1, tone: "warn" });
    const el = container.firstElementChild as HTMLElement | null;
    if (!el) throw new Error("No element");
    const style = el.getAttribute("style") ?? "";
    expect(style).not.toMatch(/#[0-9a-fA-F]{3,6}/);
  });
});
