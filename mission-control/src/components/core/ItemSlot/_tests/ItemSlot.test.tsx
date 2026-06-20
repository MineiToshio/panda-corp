/**
 * WO-13-008 — ItemSlot (CMP-13-itemslot) — RED phase tests
 *
 * Written BEFORE the implementation.
 *
 * Traceability:
 *   AC-WO-13-008 — ItemSlot renders pixel-art icon slot with image-rendering:pixelated,
 *                  tone (accent/warn/ok/danger) as border+bg color tokens (not hardcoded),
 *                  lock/reveal mechanic keyboard-reachable (focus-within),
 *                  aria-label in Spanish (REQ-13-008),
 *                  prefers-reduced-motion respected on reveal transition.
 *
 * Design-token contract (rpgSkin.itemslot + rpgSkin.lockchip):
 *   border-radius 9px, image-rendering:pixelated, inline-flex centered.
 *   Sizes observed: 34/40/42/58px.
 *   lock: filter saturate(.55); reveal overlay fades in on hover/focus-within.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ItemSlot, type ItemSlotProps } from "@/components/core/ItemSlot/ItemSlot";

function renderSlot(props: Partial<ItemSlotProps> = {}) {
  return render(
    <ItemSlot
      icon={props.icon ?? <span data-testid="slot-icon-inner">★</span>}
      aria-label={props["aria-label"] ?? "Ranura de objeto"}
      {...props}
    />,
  );
}

// ── 1. Renders root element with testid ───────────────────────────────────────

describe("frd-13/wo-13-008 ItemSlot — AC: renders root element", () => {
  it("renders an itemslot root element", () => {
    renderSlot();
    expect(screen.getByTestId("itemslot-root")).toBeDefined();
  });

  it("renders children/icon inside the slot", () => {
    render(<ItemSlot icon={<span data-testid="slot-icon-inner">★</span>} aria-label="Ranura" />);
    expect(screen.getByTestId("slot-icon-inner")).toBeDefined();
  });
});

// ── 2. size prop ──────────────────────────────────────────────────────────────

describe("frd-13/wo-13-008 ItemSlot — AC: size prop accepted without crash", () => {
  const sizes = [34, 40, 42, 58] as const;
  for (const size of sizes) {
    it(`size=${size} renders`, () => {
      renderSlot({ size });
      expect(screen.getByTestId("itemslot-root")).toBeDefined();
    });
  }

  it("default size renders", () => {
    renderSlot({});
    expect(screen.getByTestId("itemslot-root")).toBeDefined();
  });
});

// ── 3. tone prop — tokens only (no hardcoded colors) ─────────────────────────

describe("frd-13/wo-13-008 ItemSlot — AC: tone prop maps to data-tone attribute", () => {
  const tones = ["accent", "warn", "ok", "danger"] as const;
  for (const tone of tones) {
    it(`tone="${tone}" sets data-tone="${tone}"`, () => {
      renderSlot({ tone });
      expect(screen.getByTestId("itemslot-root").getAttribute("data-tone")).toBe(tone);
    });
  }

  it("no tone → no data-tone or data-tone=undefined is absent / falsy", () => {
    renderSlot({});
    const attr = screen.getByTestId("itemslot-root").getAttribute("data-tone");
    // Either omitted or not one of the named tones
    expect(attr == null || attr === "").toBe(true);
  });
});

// ── 4. lock prop — lockslot (dimmed) styling ──────────────────────────────────

describe("frd-13/wo-13-008 ItemSlot — AC: lock prop sets data-locked attribute", () => {
  it("lock=true sets data-locked=true", () => {
    renderSlot({ lock: true, icon: <span>🔒</span>, "aria-label": "Ranura bloqueada" });
    expect(screen.getByTestId("itemslot-root").getAttribute("data-locked")).toBe("true");
  });

  it("lock=false (default) — data-locked is absent or false", () => {
    renderSlot({ lock: false });
    const attr = screen.getByTestId("itemslot-root").getAttribute("data-locked");
    expect(attr == null || attr === "false").toBe(true);
  });
});

// ── 5. reveal prop — hover/focus-within reveal overlay ───────────────────────

describe("frd-13/wo-13-008 ItemSlot — AC: reveal prop renders overlay element", () => {
  it("reveal=undefined renders without a reveal overlay", () => {
    renderSlot({});
    expect(screen.queryByTestId("itemslot-reveal")).toBeNull();
  });

  it("reveal content renders overlay element when provided", () => {
    renderSlot({
      lock: true,
      reveal: <span>Cómo desbloquear</span>,
      "aria-label": "Ranura bloqueada",
    });
    expect(screen.getByTestId("itemslot-reveal")).toBeDefined();
  });

  it("reveal overlay contains the provided content", () => {
    renderSlot({
      lock: true,
      reveal: <span data-testid="reveal-content">Completa 3 proyectos</span>,
      "aria-label": "Ranura bloqueada",
    });
    expect(screen.getByTestId("reveal-content")).toBeDefined();
  });
});

// ── 6. aria-label (REQ-13-008) ───────────────────────────────────────────────

describe("frd-13/wo-13-008 ItemSlot — AC: aria-label in Spanish", () => {
  it("forwards aria-label to the root element", () => {
    renderSlot({ "aria-label": "Ranura de medalla de bronce" });
    const label = screen.getByTestId("itemslot-root").getAttribute("aria-label");
    expect(label).toBe("Ranura de medalla de bronce");
  });

  it("aria-label is present and non-empty", () => {
    renderSlot({ "aria-label": "Slot de logro" });
    const label = screen.getByTestId("itemslot-root").getAttribute("aria-label");
    expect(label).toBeTruthy();
  });
});

// ── 7. Pure / no crash on all prop combinations ───────────────────────────────

describe("frd-13/wo-13-008 ItemSlot — AC: no crash on edge props", () => {
  it("renders with all props provided", () => {
    expect(() =>
      render(
        <ItemSlot
          icon={<span>⚔</span>}
          size={42}
          tone="warn"
          lock={true}
          reveal={<span>Desbloqueo</span>}
          aria-label="Ranura de arma"
        />,
      ),
    ).not.toThrow();
  });
});
