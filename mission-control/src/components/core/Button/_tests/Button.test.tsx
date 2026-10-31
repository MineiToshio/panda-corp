/**
 * WO-13-007 — Button (CMP-13-button) — TDD tests
 *
 * Primary/secondary/ghost variants. ≥44px hit area. 1 primary per screen.
 */

import { readFileSync } from "node:fs";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button, type ButtonProps } from "@/components/core/Button/Button";

function renderButton(props: Partial<ButtonProps> & { children?: React.ReactNode } = {}) {
  return render(<Button {...props}>{props.children ?? "Acción"}</Button>);
}

describe("frd-13/wo-13-007: Button — variant rendering", () => {
  it("frd-13: Button — renders 'primary' variant", () => {
    renderButton({ variant: "primary" });
    const btn = screen.getByRole("button");
    expect(btn.getAttribute("data-variant")).toBe("primary");
  });

  it("frd-13: Button — renders 'secondary' variant", () => {
    renderButton({ variant: "secondary" });
    const btn = screen.getByRole("button");
    expect(btn.getAttribute("data-variant")).toBe("secondary");
  });

  it("frd-13: Button — renders 'ghost' variant", () => {
    renderButton({ variant: "ghost" });
    const btn = screen.getByRole("button");
    expect(btn.getAttribute("data-variant")).toBe("ghost");
  });

  it("frd-13: Button — default variant is 'secondary'", () => {
    renderButton();
    const btn = screen.getByRole("button");
    expect(btn.getAttribute("data-variant")).toBe("secondary");
  });
});

describe("Button — tone (danger palette, DR-057 reuse)", () => {
  it("defaults tone to 'default'", () => {
    renderButton();
    expect(screen.getByRole("button").getAttribute("data-tone")).toBe("default");
  });

  it("emits data-tone='danger' so CSS can target the destructive hover", () => {
    renderButton({ tone: "danger" });
    expect(screen.getByRole("button").getAttribute("data-tone")).toBe("danger");
  });

  it("danger remains outlined coral even when combined with primary", () => {
    renderButton({ variant: "primary", tone: "danger" });
    expect(screen.getByRole("button")).toHaveAttribute("data-tone", "danger");
    const css = readFileSync("src/components/core/Button/Button.module.css", "utf8");
    expect(css).toMatch(
      /\.btn\[data-tone="danger"\]\s*\{[^}]*color: var\(--coral\);[^}]*background: transparent;/,
    );
  });

  it("uses neutral primary inversion and the frozen 40/32 px sizes", () => {
    const css = readFileSync("src/components/core/Button/Button.module.css", "utf8");
    expect(css).toContain("background: var(--primary-bg)");
    expect(css).toContain("color: var(--primary-fg)");
    expect(css).toContain("min-height: 40px");
    expect(css).toContain("min-height: 32px");
    renderButton({ variant: "toned", tone: "teal", icon: "check" });
    expect(screen.getByRole("button")).toHaveAttribute("data-tone", "teal");
    expect(screen.getByRole("button").querySelector('[data-icon="check"]')).not.toBeNull();
  });
});

describe("frd-13/wo-13-007: Button — size and hit area", () => {
  it("frd-13: Button — has data-testid='button'", () => {
    renderButton();
    expect(screen.getByTestId("button")).toBeDefined();
  });

  it("frd-13: Button — size='sm' sets data-size attribute", () => {
    renderButton({ size: "sm" });
    const btn = screen.getByTestId("button");
    expect(btn.getAttribute("data-size")).toBe("sm");
  });

  it("frd-13: Button — size='md' is default", () => {
    renderButton();
    const btn = screen.getByTestId("button");
    expect(btn.getAttribute("data-size")).toBe("md");
  });

  it("frd-13: Button — size='lg' sets data-size attribute", () => {
    renderButton({ size: "lg" });
    const btn = screen.getByTestId("button");
    expect(btn.getAttribute("data-size")).toBe("lg");
  });
});

describe("frd-13/wo-13-007: Button — interaction", () => {
  it("frd-13: Button — onClick fires on click", () => {
    let clicked = false;
    renderButton({
      onClick: () => {
        clicked = true;
      },
    });
    fireEvent.click(screen.getByRole("button"));
    expect(clicked).toBe(true);
  });

  it("frd-13: Button — disabled prevents click", () => {
    let clicked = false;
    renderButton({
      disabled: true,
      onClick: () => {
        clicked = true;
      },
    });
    const btn = screen.getByRole("button");
    fireEvent.click(btn);
    expect(clicked).toBe(false);
  });

  it("frd-13: Button — is a <button> element with type='button'", () => {
    renderButton();
    const btn = screen.getByRole("button");
    expect(btn.tagName).toBe("BUTTON");
    expect(btn.getAttribute("type")).toBe("button");
  });
});

describe("frd-13/wo-13-007: Button — tokens only", () => {
  it("frd-13: Button — inline style uses var() not hardcoded hex", () => {
    const { container } = renderButton({ variant: "primary" });
    const el = container.firstElementChild as HTMLElement | null;
    if (!el) throw new Error("No element");
    const style = el.getAttribute("style") ?? "";
    expect(style).not.toMatch(/#[0-9a-fA-F]{3,6}/);
  });
});
