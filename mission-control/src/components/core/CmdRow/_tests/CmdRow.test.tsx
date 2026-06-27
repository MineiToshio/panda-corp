/**
 * WO-13-007 — CmdRow (CMP-13-cmdrow) — TDD tests
 *
 * Mono command row (.cmd): inset on canvas, bd2 hairline, mono + tabular-nums,
 * with a CopyButton. THE command-chip primitive.
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { CmdRow, type CmdRowMode, type CmdRowProps } from "@/components/core/CmdRow/CmdRow";

function renderCmd(props: CmdRowProps) {
  return render(<CmdRow {...props} />);
}

const SPEC_MODES: ReadonlyArray<CmdRowMode> = [
  { flag: "--ask", label: "ask", hint: "siempre pregunta" },
  { flag: "--auto", label: "auto", hint: "pregunta solo lo clave" },
  { flag: "--infer", label: "infer", hint: "no pregunta" },
];

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

describe("frd-02/AC-02-010.9: CmdRow — inline mode selector", () => {
  it("frd-02: renders one pill per mode, before the copy button", () => {
    renderCmd({ command: "/pandacorp:spec my-app", modes: SPEC_MODES });
    expect(screen.getByRole("button", { name: "ask" })).toBeDefined();
    expect(screen.getByRole("button", { name: "auto" })).toBeDefined();
    expect(screen.getByRole("button", { name: "infer" })).toBeDefined();
  });

  it("frd-02: renders no pills when no modes are given", () => {
    renderCmd({ command: "/pandacorp:design" });
    expect(screen.queryByRole("button", { name: "ask" })).toBeNull();
  });

  it("frd-02: folds the flag into the visible command when a mode is picked", async () => {
    const user = userEvent.setup();
    renderCmd({ command: "/pandacorp:spec my-app", modes: SPEC_MODES });
    expect(screen.getByText("/pandacorp:spec my-app")).toBeDefined();
    await user.click(screen.getByRole("button", { name: "ask" }));
    expect(screen.getByText("/pandacorp:spec my-app --ask")).toBeDefined();
    expect(screen.getByRole("button", { name: "ask" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("frd-02: copies the command WITH the selected flag", async () => {
    const user = userEvent.setup();
    renderCmd({ command: "/pandacorp:spec my-app", modes: SPEC_MODES });
    await user.click(screen.getByRole("button", { name: "auto" }));
    await user.click(screen.getByTestId("copy-button"));
    await waitFor(async () => {
      expect(await navigator.clipboard.readText()).toBe("/pandacorp:spec my-app --auto");
    });
  });

  it("frd-02: picking the active mode again clears the flag", async () => {
    const user = userEvent.setup();
    renderCmd({ command: "/pandacorp:spec my-app", modes: SPEC_MODES });
    const ask = screen.getByRole("button", { name: "ask" });
    await user.click(ask);
    expect(screen.getByText("/pandacorp:spec my-app --ask")).toBeDefined();
    await user.click(ask);
    expect(screen.getByText("/pandacorp:spec my-app")).toBeDefined();
    expect(ask.getAttribute("aria-pressed")).toBe("false");
  });

  it("frd-02: shows the fallback modeHint, then the active mode's hint", async () => {
    const user = userEvent.setup();
    renderCmd({ command: "/pandacorp:spec my-app", modes: SPEC_MODES, modeHint: "elige un modo" });
    expect(screen.getByTestId("cmd-row-hint").textContent).toBe("elige un modo");
    await user.click(screen.getByRole("button", { name: "infer" }));
    expect(screen.getByTestId("cmd-row-hint").textContent).toBe("no pregunta");
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
