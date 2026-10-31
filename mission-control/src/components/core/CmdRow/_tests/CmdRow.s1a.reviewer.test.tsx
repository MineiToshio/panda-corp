import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CmdRow, CommandCompact } from "../CmdRow";

describe("CommandBox independent review (WO-13-011)", () => {
  it("offers a break after every colon and keeps the exact command text", () => {
    render(<CmdRow variant="box" command="/pandacorp:implement change:my-slug" />);
    const code = screen.getByText(/pandacorp/);
    expect(code.querySelectorAll("wbr")).toHaveLength(2);
    expect(code).toHaveTextContent("/pandacorp:implement change:my-slug");
  });

  it("lets CommandCompact apply its own smaller frame", () => {
    render(<CommandCompact command="/pandacorp:change" />);
    expect(screen.getByTestId("cmd-row").style.minHeight).not.toBe("44px");
  });
});
