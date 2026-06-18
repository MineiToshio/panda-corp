/**
 * BusinessSnapshot — component tests (TDD: RED first, then GREEN).
 *
 * Verifies AC-03-003.1:
 *   EACH shipped project SHALL show its business snapshot when present
 *   (active users / return metric / last review verdict).
 *
 * Traceability:
 *   CMP-03-snapshot → REQ-03-003, AC-03-003.1
 *   WO-03-003
 *
 * Definition of done (from WO-03-003):
 *   1. Shipped project with users/return/verdict → all three chips render.
 *   2. Shipped project with only some fields → only those chips render.
 *   3. No snapshot (undefined) → component renders nothing.
 *   4. Empty snapshot ({}) → component renders nothing.
 *   5. data-testid="business-snapshot" present when fields exist.
 *   6. Design token invariant: zero hardcoded hex/rgb/hsl colors.
 *   7. tabular-nums font variant on numeric values container.
 *   8. Read-only: no interactive controls.
 *
 * Stack: Vitest + @testing-library/react (jsdom).
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BusinessSnapshot } from "./BusinessSnapshot";

// ---------------------------------------------------------------------------
// 1. Full snapshot — all three fields present
// ---------------------------------------------------------------------------

describe("BusinessSnapshot — all fields present", () => {
  it("renders data-testid=business-snapshot root element", () => {
    render(<BusinessSnapshot users="1 200" returnMetric="$3 400 MRR" verdict="double-down" />);
    expect(screen.getByTestId("business-snapshot")).toBeDefined();
  });

  it("renders business-snapshot-users chip with the users value", () => {
    render(<BusinessSnapshot users="1 200" returnMetric="$3 400 MRR" verdict="double-down" />);
    const el = screen.getByTestId("business-snapshot-users");
    expect(el.textContent).toContain("1 200");
  });

  it("renders business-snapshot-return chip with the return metric value", () => {
    render(<BusinessSnapshot users="1 200" returnMetric="$3 400 MRR" verdict="double-down" />);
    const el = screen.getByTestId("business-snapshot-return");
    expect(el.textContent).toContain("$3 400 MRR");
  });

  it("renders business-snapshot-verdict chip with the verdict value", () => {
    render(<BusinessSnapshot users="1 200" returnMetric="$3 400 MRR" verdict="double-down" />);
    const el = screen.getByTestId("business-snapshot-verdict");
    expect(el.textContent).toContain("double-down");
  });

  it("renders all three chips when all fields are provided", () => {
    render(<BusinessSnapshot users="500" returnMetric="OSS stars" verdict="hold" />);
    expect(screen.getByTestId("business-snapshot-users")).toBeDefined();
    expect(screen.getByTestId("business-snapshot-return")).toBeDefined();
    expect(screen.getByTestId("business-snapshot-verdict")).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 2. Partial snapshot — only some fields present
// ---------------------------------------------------------------------------

describe("BusinessSnapshot — partial fields", () => {
  it("renders only users chip when only users is provided", () => {
    render(<BusinessSnapshot users="800" />);
    expect(screen.getByTestId("business-snapshot-users")).toBeDefined();
    expect(screen.queryByTestId("business-snapshot-return")).toBeNull();
    expect(screen.queryByTestId("business-snapshot-verdict")).toBeNull();
  });

  it("renders only return chip when only returnMetric is provided", () => {
    render(<BusinessSnapshot returnMetric="$2 000 MRR" />);
    expect(screen.queryByTestId("business-snapshot-users")).toBeNull();
    expect(screen.getByTestId("business-snapshot-return")).toBeDefined();
    expect(screen.queryByTestId("business-snapshot-verdict")).toBeNull();
  });

  it("renders only verdict chip when only verdict is provided", () => {
    render(<BusinessSnapshot verdict="kill" />);
    expect(screen.queryByTestId("business-snapshot-users")).toBeNull();
    expect(screen.queryByTestId("business-snapshot-return")).toBeNull();
    expect(screen.getByTestId("business-snapshot-verdict")).toBeDefined();
  });

  it("renders users and verdict chips when returnMetric is absent", () => {
    render(<BusinessSnapshot users="300" verdict="double-down" />);
    expect(screen.getByTestId("business-snapshot-users")).toBeDefined();
    expect(screen.queryByTestId("business-snapshot-return")).toBeNull();
    expect(screen.getByTestId("business-snapshot-verdict")).toBeDefined();
  });

  it("renders users and return chips when verdict is absent", () => {
    render(<BusinessSnapshot users="50" returnMetric="€500/mo" />);
    expect(screen.getByTestId("business-snapshot-users")).toBeDefined();
    expect(screen.getByTestId("business-snapshot-return")).toBeDefined();
    expect(screen.queryByTestId("business-snapshot-verdict")).toBeNull();
  });

  it("snapshot root element still present when at least one field exists", () => {
    render(<BusinessSnapshot users="42" />);
    expect(screen.getByTestId("business-snapshot")).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 3. No snapshot / empty snapshot → renders nothing
// ---------------------------------------------------------------------------

describe("BusinessSnapshot — no snapshot renders nothing", () => {
  it("renders nothing when no props are provided (all undefined)", () => {
    const { container } = render(<BusinessSnapshot />);
    // The component must return null — nothing in the DOM
    expect(container.firstChild).toBeNull();
  });

  it("does NOT render data-testid=business-snapshot when all props undefined", () => {
    render(<BusinessSnapshot />);
    expect(screen.queryByTestId("business-snapshot")).toBeNull();
  });

  it("does NOT render any chip when no props given", () => {
    render(<BusinessSnapshot />);
    expect(screen.queryByTestId("business-snapshot-users")).toBeNull();
    expect(screen.queryByTestId("business-snapshot-return")).toBeNull();
    expect(screen.queryByTestId("business-snapshot-verdict")).toBeNull();
  });

  it("renders nothing when users=undefined, returnMetric=undefined, verdict=undefined explicitly", () => {
    const { container } = render(
      <BusinessSnapshot users={undefined} returnMetric={undefined} verdict={undefined} />,
    );
    expect(container.firstChild).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 4. tabular-nums — numeric values container uses tabular-nums
// ---------------------------------------------------------------------------

describe("BusinessSnapshot — tabular-nums invariant", () => {
  it("snapshot root has tabular-nums in its inline style", () => {
    render(<BusinessSnapshot users="1 200" returnMetric="$3 400 MRR" verdict="double-down" />);
    const el = screen.getByTestId("business-snapshot");
    const style = el.getAttribute("style") ?? "";
    expect(style).toContain("tabular-nums");
  });
});

// ---------------------------------------------------------------------------
// 5. Design token invariant — zero hardcoded hex/rgb/hsl colors
// ---------------------------------------------------------------------------

describe("BusinessSnapshot — design token invariant", () => {
  it("no element has a hardcoded hex color in inline style", () => {
    const { container } = render(
      <BusinessSnapshot users="500" returnMetric="$1 200 MRR" verdict="double-down" />,
    );
    const all = container.querySelectorAll("[style]");
    for (const el of all) {
      const style = el.getAttribute("style") ?? "";
      expect(style).not.toMatch(/#[0-9a-fA-F]{3,8}/);
      expect(style).not.toMatch(/\brgb\b/);
      expect(style).not.toMatch(/\bhsl\b/);
    }
  });

  it("partial snapshot has no hardcoded colors", () => {
    const { container } = render(<BusinessSnapshot verdict="hold" />);
    const all = container.querySelectorAll("[style]");
    for (const el of all) {
      const style = el.getAttribute("style") ?? "";
      expect(style).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    }
  });
});

// ---------------------------------------------------------------------------
// 6. Read-only invariant — no interactive controls
// ---------------------------------------------------------------------------

describe("BusinessSnapshot — read-only", () => {
  it("renders no button elements", () => {
    const { container } = render(
      <BusinessSnapshot users="100" returnMetric="$500 MRR" verdict="hold" />,
    );
    expect(container.querySelectorAll("button")).toHaveLength(0);
  });

  it("renders no input elements", () => {
    const { container } = render(
      <BusinessSnapshot users="100" returnMetric="$500 MRR" verdict="hold" />,
    );
    expect(container.querySelectorAll("input")).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 7. Snapshot accepts arbitrary string values
// ---------------------------------------------------------------------------

describe("BusinessSnapshot — value rendering", () => {
  it("renders the exact users string passed in", () => {
    render(<BusinessSnapshot users="42 activos" />);
    expect(screen.getByTestId("business-snapshot-users").textContent).toContain("42 activos");
  });

  it("renders the exact returnMetric string passed in", () => {
    render(<BusinessSnapshot returnMetric="1k GitHub stars" />);
    expect(screen.getByTestId("business-snapshot-return").textContent).toContain("1k GitHub stars");
  });

  it("renders the exact verdict string passed in", () => {
    render(<BusinessSnapshot verdict="zombie" />);
    expect(screen.getByTestId("business-snapshot-verdict").textContent).toContain("zombie");
  });
});
