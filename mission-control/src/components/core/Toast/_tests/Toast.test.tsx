/**
 * WO-13-007 — Toast (CMP-13-toast) — TDD tests
 *
 * Transient bottom confirmation ("copiado"). Small, sober, auto-dismiss.
 * NOT a celebration. Distinct from AchievementToast (Party).
 * Respects prefers-reduced-motion.
 */

import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Toast, type ToastProps } from "@/components/core/Toast/Toast";

function renderToast(props: ToastProps) {
  return render(<Toast {...props} />);
}

describe("frd-13/wo-13-007: Toast — rendering", () => {
  it("frd-13: Toast — renders message text when visible=true", () => {
    renderToast({ message: "Copiado", visible: true });
    expect(screen.getByText("Copiado")).toBeDefined();
  });

  it("frd-13: Toast — has data-testid='toast'", () => {
    renderToast({ message: "Copiado", visible: true });
    expect(screen.getByTestId("toast")).toBeDefined();
  });

  it("frd-13: Toast — has role='status' for polite announcement", () => {
    renderToast({ message: "Copiado", visible: true });
    const toast = screen.getByRole("status");
    expect(toast).toBeDefined();
  });

  it("frd-13: Toast — visible=false hides element (aria-hidden or not in DOM)", () => {
    renderToast({ message: "Copiado", visible: false });
    const toast = screen.queryByTestId("toast");
    // Either not in DOM or has aria-hidden="true"
    if (toast !== null) {
      const hidden = toast.getAttribute("aria-hidden");
      expect(hidden).toBe("true");
    }
    // If null, it's correctly hidden — test passes either way
  });
});

describe("frd-13/wo-13-007: Toast — auto-dismiss", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("frd-13: Toast — calls onDismiss after durationMs", () => {
    let dismissed = false;
    renderToast({
      message: "Copiado",
      visible: true,
      durationMs: 2000,
      onDismiss: () => {
        dismissed = true;
      },
    });
    expect(dismissed).toBe(false);
    act(() => {
      vi.advanceTimersByTime(2001);
    });
    expect(dismissed).toBe(true);
  });

  it("frd-13: Toast — does not auto-dismiss before durationMs", () => {
    let dismissed = false;
    renderToast({
      message: "Copiado",
      visible: true,
      durationMs: 2000,
      onDismiss: () => {
        dismissed = true;
      },
    });
    act(() => {
      vi.advanceTimersByTime(1999);
    });
    expect(dismissed).toBe(false);
  });
});

describe("frd-13/wo-13-007: Toast — tokens only", () => {
  it("frd-13: Toast — inline style uses var() not hardcoded hex", () => {
    const { container } = renderToast({ message: "Copiado", visible: true });
    const el = container.firstElementChild as HTMLElement | null;
    if (!el) throw new Error("No element");
    const style = el.getAttribute("style") ?? "";
    expect(style).not.toMatch(/#[0-9a-fA-F]{3,6}/);
  });
});
