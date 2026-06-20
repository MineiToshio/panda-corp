/**
 * WO-13-007 — CmdRow (CMP-13-cmdrow) — TDD tests
 *
 * Mono command row (.cmd): inset on canvas, bd2 hairline, mono + tabular-nums,
 * with a CopyButton. THE command-chip primitive.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CmdRow, type CmdRowProps } from "@/components/core/CmdRow/CmdRow";

function renderCmd(props: CmdRowProps) {
  return render(<CmdRow {...props} />);
}

describe("frd-13/wo-13-007: CmdRow — rendering", () => {
  it("frd-13: CmdRow — renders command text", () => {
    renderCmd({ command: "claude plugin update pandacorp@panda-corp" });
    expect(screen.getByText("claude plugin update pandacorp@panda-corp")).toBeDefined();
  });

  it("frd-13: CmdRow — has data-testid='cmd-row'", () => {
    renderCmd({ command: "/pandacorp:adopt" });
    expect(screen.getByTestId("cmd-row")).toBeDefined();
  });

  it("frd-13: CmdRow — renders CopyButton when copy=true (default)", () => {
    renderCmd({ command: "/pandacorp:adopt" });
    // CopyButton renders with data-testid="copy-button"
    expect(screen.getByTestId("copy-button")).toBeDefined();
  });

  it("frd-13: CmdRow — does not render CopyButton when copy=false", () => {
    renderCmd({ command: "/pandacorp:adopt", copy: false });
    expect(screen.queryByTestId("copy-button")).toBeNull();
  });
});

describe("frd-13/wo-13-007: CmdRow — tokens only", () => {
  it("frd-13: CmdRow — inline style uses var() not hardcoded hex", () => {
    const { container } = renderCmd({ command: "test" });
    const el = container.firstElementChild as HTMLElement | null;
    if (!el) throw new Error("No element");
    const style = el.getAttribute("style") ?? "";
    expect(style).not.toMatch(/#[0-9a-fA-F]{3,6}/);
  });
});
