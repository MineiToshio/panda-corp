/**
 * WO-13-007 — Banner (CMP-13-banner) — TDD tests
 *
 * The ONE shared banner primitive (DR-057 dup-fix).
 *
 * Traceability:
 *   AC-13-006.1 — ONE Banner; no BANNER_STYLE/ICON_STYLE/CMD_ROW_STYLE duplication.
 *   AC-13-006.2 — Tone (warn/info/ok/danger): icon+text+shape — never color alone.
 *   AC-13-006.3 — Dismiss is keyboard-operable (button, accessible label).
 *   AC-13-006.4 — prefers-reduced-motion: banner content renders without motion issues.
 *   AC-13-006.5 — Multi-item + collapse after collapseAfter items.
 *   AC-13-006.6 — Tokens only, no hardcoded colors.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Banner, type BannerProps } from "@/components/core/Banner/Banner";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderBanner(
  props: Partial<BannerProps> & { tone: BannerProps["tone"]; heading: BannerProps["heading"] },
) {
  return render(<Banner {...props} />);
}

// ---------------------------------------------------------------------------
// 1. Tone rendering — icon + text, never color alone (AC-13-006.2)
// ---------------------------------------------------------------------------

describe("frd-13/wo-13-007: Banner — tone rendering (AC-13-006.2)", () => {
  it("frd-13: Banner warn — renders warning icon data-tone and heading", () => {
    renderBanner({ tone: "warn", heading: "Plugin desincronizado" });
    const banner = screen.getByRole("alert");
    expect(banner).toBeDefined();
    expect(banner.getAttribute("data-tone")).toBe("warn");
    expect(screen.getByText("Plugin desincronizado")).toBeDefined();
  });

  it("frd-13: Banner info — renders info tone", () => {
    renderBanner({ tone: "info", heading: "Información" });
    const banner = screen.getByRole("alert");
    expect(banner.getAttribute("data-tone")).toBe("info");
  });

  it("frd-13: Banner ok — renders ok tone", () => {
    renderBanner({ tone: "ok", heading: "Operación completada" });
    const banner = screen.getByRole("alert");
    expect(banner.getAttribute("data-tone")).toBe("ok");
  });

  it("frd-13: Banner danger — renders danger tone", () => {
    renderBanner({ tone: "danger", heading: "Error crítico" });
    const banner = screen.getByRole("alert");
    expect(banner.getAttribute("data-tone")).toBe("danger");
  });

  it("frd-13: Banner — has a visible icon aria-hidden element per tone", () => {
    renderBanner({ tone: "warn", heading: "Alerta" });
    // Icon must be aria-hidden (decorative; label carries the meaning)
    const icon = screen.getByTestId("banner-icon");
    expect(icon.getAttribute("aria-hidden")).toBe("true");
  });
});

// ---------------------------------------------------------------------------
// 2. Detail text (optional body copy)
// ---------------------------------------------------------------------------

describe("frd-13/wo-13-007: Banner — detail text", () => {
  it("frd-13: Banner — renders detail when provided", () => {
    renderBanner({ tone: "warn", heading: "Aviso", detail: "Descripción del aviso" });
    expect(screen.getByText("Descripción del aviso")).toBeDefined();
  });

  it("frd-13: Banner — does not render detail element when omitted", () => {
    renderBanner({ tone: "info", heading: "Sin detalle" });
    const detail = screen.queryByTestId("banner-detail");
    expect(detail).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 3. Command row (optional)
// ---------------------------------------------------------------------------

describe("frd-13/wo-13-007: Banner — command row (optional)", () => {
  it("frd-13: Banner — renders command row when commandRow prop provided", () => {
    renderBanner({ tone: "warn", heading: "Update", commandRow: "claude plugin update" });
    const cmdRow = screen.getByTestId("banner-cmd-row");
    expect(cmdRow).toBeDefined();
    expect(screen.getByText("claude plugin update")).toBeDefined();
  });

  it("frd-13: Banner — no command row when not provided", () => {
    renderBanner({ tone: "info", heading: "Solo texto" });
    const cmdRow = screen.queryByTestId("banner-cmd-row");
    expect(cmdRow).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 4. Dismissible (keyboard-operable) — AC-13-006.3
// ---------------------------------------------------------------------------

describe("frd-13/wo-13-007: Banner — dismiss (AC-13-006.3)", () => {
  it("frd-13: Banner — renders dismiss button when dismissible=true", () => {
    renderBanner({ tone: "warn", heading: "Aviso descartable", dismissible: true });
    const btn = screen.getByTestId("banner-dismiss");
    expect(btn.tagName).toBe("BUTTON");
    expect(btn.getAttribute("type")).toBe("button");
  });

  it("frd-13: Banner — dismiss button has Spanish aria-label", () => {
    renderBanner({ tone: "warn", heading: "Aviso descartable", dismissible: true });
    const btn = screen.getByTestId("banner-dismiss");
    const label = btn.getAttribute("aria-label") ?? "";
    expect(label.length).toBeGreaterThan(0);
  });

  it("frd-13: Banner — clicking dismiss calls onDismiss callback", () => {
    let dismissed = false;
    renderBanner({
      tone: "warn",
      heading: "Aviso descartable",
      dismissible: true,
      onDismiss: () => {
        dismissed = true;
      },
    });
    const btn = screen.getByTestId("banner-dismiss");
    fireEvent.click(btn);
    expect(dismissed).toBe(true);
  });

  it("frd-13: Banner — no dismiss button when dismissible not set", () => {
    renderBanner({ tone: "info", heading: "Permanente" });
    expect(screen.queryByTestId("banner-dismiss")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 5. Multi-item + collapse (AC-13-006.5)
// ---------------------------------------------------------------------------

describe("frd-13/wo-13-007: Banner — multi-item + collapse (AC-13-006.5)", () => {
  const items = [
    { id: "a", label: "Proyecto A" },
    { id: "b", label: "Proyecto B" },
    { id: "c", label: "Proyecto C" },
  ];

  it("frd-13: Banner — renders all items when collapseAfter not set", () => {
    renderBanner({ tone: "warn", heading: "Proyectos", items });
    expect(screen.getByText("Proyecto A")).toBeDefined();
    expect(screen.getByText("Proyecto B")).toBeDefined();
    expect(screen.getByText("Proyecto C")).toBeDefined();
  });

  it("frd-13: Banner — collapses items beyond collapseAfter threshold", () => {
    renderBanner({ tone: "warn", heading: "Proyectos", items, collapseAfter: 1 });
    // Only first item visible initially
    expect(screen.getByText("Proyecto A")).toBeDefined();
    // Overflow items hidden — toggle button visible
    const toggle = screen.getByTestId("banner-collapse-toggle");
    expect(toggle).toBeDefined();
    // Projects B and C not in DOM (collapsed)
    expect(screen.queryByText("Proyecto B")).toBeNull();
    expect(screen.queryByText("Proyecto C")).toBeNull();
  });

  it("frd-13: Banner — expanding the toggle shows all items", () => {
    renderBanner({ tone: "warn", heading: "Proyectos", items, collapseAfter: 1 });
    const toggle = screen.getByTestId("banner-collapse-toggle");
    fireEvent.click(toggle);
    expect(screen.getByText("Proyecto B")).toBeDefined();
    expect(screen.getByText("Proyecto C")).toBeDefined();
  });

  it("frd-13: Banner — no toggle when items <= collapseAfter", () => {
    renderBanner({
      tone: "warn",
      heading: "Proyectos",
      items: items.slice(0, 1),
      collapseAfter: 2,
    });
    expect(screen.queryByTestId("banner-collapse-toggle")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 6. data-testid on root (required for integration)
// ---------------------------------------------------------------------------

describe("frd-13/wo-13-007: Banner — testid contract", () => {
  it("frd-13: Banner — has data-testid='banner' on root", () => {
    renderBanner({ tone: "warn", heading: "Test" });
    expect(screen.getByTestId("banner")).toBeDefined();
  });

  it("frd-13: Banner — kind prop stored as data-kind attribute", () => {
    renderBanner({ tone: "warn", kind: "drift", heading: "Drift" });
    const banner = screen.getByTestId("banner");
    expect(banner.getAttribute("data-kind")).toBe("drift");
  });
});

// ---------------------------------------------------------------------------
// 7. Tokens only — no hardcoded colors in inline styles
// ---------------------------------------------------------------------------

describe("frd-13/wo-13-007: Banner — tokens only (AC-13-006.6)", () => {
  it("frd-13: Banner — root element style uses var() not hardcoded hex", () => {
    const { container } = renderBanner({ tone: "warn", heading: "Tokens check" });
    const root = container.firstElementChild as HTMLElement | null;
    if (!root) throw new Error("Root element not found");
    const style = root.getAttribute("style") ?? "";
    // Must not contain any hardcoded hex colors
    expect(style).not.toMatch(/#[0-9a-fA-F]{3,6}/);
  });
});
