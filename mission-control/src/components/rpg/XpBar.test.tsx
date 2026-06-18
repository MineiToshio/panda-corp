/**
 * WO-09-004 — CMP-09-xp-bar tests (RED phase)
 *
 * Acceptance criteria (EARS, FRD-09 / WO-09-004):
 *   AC-09-004.2 — Numbers use font-variant-numeric: tabular-nums (text nodes present).
 *   AC-09-004.3 — Bar reflects real pct-to-next; NEVER renders fake/stuck fill.
 *   AC-09-004.4 — Uses rationed accent; NOT color-alone (label+shape present alongside bar).
 *   AC-09-004.5 — CMP-09-xp-bar is a reusable primitive (accepts xp, next, pctToNext, label, nextTitle props).
 *
 * Traceability:
 *   CMP-09-xp-bar → blueprint §3 → WO-09-004 TDD plan
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { XpBar } from "./XpBar";

// ---------------------------------------------------------------------------
// AC-09-004.5 — Reusable primitive (accepts standard props)
// ---------------------------------------------------------------------------

describe("AC-09-004.5 — XpBar is a reusable primitive", () => {
  it("renders without crashing with required props", () => {
    const { container } = render(
      <XpBar xp={50} next={100} pctToNext={50} label="Artesano" nextTitle="Oficial" />,
    );
    expect(container.firstChild).not.toBeNull();
  });

  it("renders with data-testid='xp-bar'", () => {
    render(<XpBar xp={50} next={100} pctToNext={50} label="Artesano" nextTitle="Oficial" />);
    expect(screen.getByTestId("xp-bar")).toBeDefined();
  });

  it("exposes xp, next values as readable text nodes", () => {
    render(<XpBar xp={150} next={500} pctToNext={10} label="Artesano" nextTitle="Oficial" />);
    // XP total and next threshold must be visible to assistive tech / tests
    expect(screen.getByTestId("xp-bar").textContent).toContain("150");
    expect(screen.getByTestId("xp-bar").textContent).toContain("500");
  });

  it("can be rendered with xp=0 (zero state — honest empty bar)", () => {
    const { container } = render(
      <XpBar xp={0} next={100} pctToNext={0} label="Aprendiz" nextTitle="Artesano" />,
    );
    expect(container.firstChild).not.toBeNull();
  });

  it("renders the nextTitle string as visible text (faltan N para Nv X pattern)", () => {
    render(<XpBar xp={0} next={100} pctToNext={0} label="Aprendiz" nextTitle="Artesano" />);
    expect(screen.getByTestId("xp-bar-next-label")).toBeDefined();
    expect(screen.getByTestId("xp-bar-next-label").textContent).toContain("Artesano");
  });

  it("renders the current rank label", () => {
    render(<XpBar xp={200} next={500} pctToNext={25} label="Oficial" nextTitle="Maestro" />);
    expect(screen.getByTestId("xp-bar-label")).toBeDefined();
    expect(screen.getByTestId("xp-bar-label").textContent).toContain("Oficial");
  });
});

// ---------------------------------------------------------------------------
// AC-09-004.3 — Bar reflects REAL pct-to-next; NEVER fake/stuck
// ---------------------------------------------------------------------------

describe("AC-09-004.3 — real pct-to-next, no fake fill", () => {
  it("zero pctToNext → bar fill is 0% (not 80%)", () => {
    render(<XpBar xp={0} next={100} pctToNext={0} label="Aprendiz" nextTitle="Artesano" />);
    const fill = screen.getByTestId("xp-bar-fill");
    // The fill width must be 0%
    const style = fill.style.width ?? fill.getAttribute("aria-valuenow") ?? "";
    expect(style).toBe("0%");
  });

  it("50 pctToNext → bar fill is 50%", () => {
    render(<XpBar xp={50} next={100} pctToNext={50} label="Artesano" nextTitle="Oficial" />);
    const fill = screen.getByTestId("xp-bar-fill");
    expect(fill.style.width).toBe("50%");
  });

  it("100 pctToNext → bar fill is 100% (max rank or full)", () => {
    render(
      <XpBar
        xp={1000}
        next={1000}
        pctToNext={100}
        label="Maestro del Gremio"
        nextTitle="Maestro del Gremio"
      />,
    );
    const fill = screen.getByTestId("xp-bar-fill");
    expect(fill.style.width).toBe("100%");
  });

  it("NEGATIVE AC — zero pctToNext NEVER renders fill near 80%", () => {
    render(<XpBar xp={0} next={100} pctToNext={0} label="Aprendiz" nextTitle="Artesano" />);
    const fill = screen.getByTestId("xp-bar-fill");
    const widthStr = fill.style.width;
    const widthNum = Number.parseFloat(widthStr);
    // Must not be near 80 (forbidden pattern: bar stuck at ~80% with no work)
    expect(widthNum).toBeLessThan(50);
  });

  it("bar width matches pctToNext prop exactly", () => {
    render(<XpBar xp={30} next={100} pctToNext={30} label="Aprendiz" nextTitle="Artesano" />);
    const fill = screen.getByTestId("xp-bar-fill");
    expect(fill.style.width).toBe("30%");
  });
});

// ---------------------------------------------------------------------------
// AC-09-004.4 — Rationed accent; NOT color-alone (label + shape present)
// ---------------------------------------------------------------------------

describe("AC-09-004.4 — rationed accent, not color-alone", () => {
  it("bar track element is present (shape = non-color indicator)", () => {
    render(<XpBar xp={50} next={100} pctToNext={50} label="Artesano" nextTitle="Oficial" />);
    expect(screen.getByTestId("xp-bar-track")).toBeDefined();
  });

  it("fill uses the accent CSS custom property (not a hardcoded color)", () => {
    render(<XpBar xp={50} next={100} pctToNext={50} label="Artesano" nextTitle="Oficial" />);
    const fill = screen.getByTestId("xp-bar-fill");
    // The element must have a CSS class or inline style referencing --color-accent
    // We check the class name includes the tailwind token variant or a data attribute
    const cls = fill.className;
    const styleAttr = fill.getAttribute("style") ?? "";
    // Accept either a tailwind class that resolves to accent (bg-accent) OR
    // an inline style with var(--color-accent) OR a data-accent attribute as a marker
    const usesAccent =
      cls.includes("accent") || styleAttr.includes("accent") || fill.hasAttribute("data-accent");
    expect(usesAccent).toBe(true);
  });

  it("label text is present alongside the bar (not color-alone)", () => {
    render(<XpBar xp={50} next={100} pctToNext={50} label="Artesano" nextTitle="Oficial" />);
    // Both a label AND the bar shape must be in the DOM
    expect(screen.getByTestId("xp-bar-label")).toBeDefined();
    expect(screen.getByTestId("xp-bar-track")).toBeDefined();
  });

  it("has an aria-valuenow attribute on the bar fill for accessibility", () => {
    render(<XpBar xp={75} next={100} pctToNext={75} label="Artesano" nextTitle="Oficial" />);
    // Either the track or the fill carries role=progressbar + aria-valuenow
    const bar = screen.getByRole("progressbar");
    expect(bar).toBeDefined();
    expect(bar.getAttribute("aria-valuenow")).toBe("75");
  });

  it("has aria-valuemin=0 and aria-valuemax=100 on progressbar role", () => {
    render(<XpBar xp={0} next={100} pctToNext={0} label="Aprendiz" nextTitle="Artesano" />);
    const bar = screen.getByRole("progressbar");
    expect(bar.getAttribute("aria-valuemin")).toBe("0");
    expect(bar.getAttribute("aria-valuemax")).toBe("100");
  });
});

// ---------------------------------------------------------------------------
// AC-09-004.2 — tabular-nums on numbers (text must be present for CSS to apply)
// ---------------------------------------------------------------------------

describe("AC-09-004.2 — tabular-nums on numbers", () => {
  it("xp value is rendered in a dedicated numeric element with data-testid='xp-bar-xp'", () => {
    render(<XpBar xp={123} next={500} pctToNext={5} label="Artesano" nextTitle="Oficial" />);
    const xpEl = screen.getByTestId("xp-bar-xp");
    expect(xpEl.textContent).toContain("123");
  });

  it("next threshold is rendered in a dedicated numeric element with data-testid='xp-bar-next'", () => {
    render(<XpBar xp={50} next={500} pctToNext={10} label="Artesano" nextTitle="Oficial" />);
    const nextEl = screen.getByTestId("xp-bar-next");
    expect(nextEl.textContent).toContain("500");
  });

  it("numeric elements are inside the bar root (not orphaned)", () => {
    const { container } = render(
      <XpBar xp={50} next={100} pctToNext={50} label="Artesano" nextTitle="Oficial" />,
    );
    const root = container.querySelector('[data-testid="xp-bar"]');
    expect(root).not.toBeNull();
    expect(root?.querySelector('[data-testid="xp-bar-xp"]')).not.toBeNull();
    expect(root?.querySelector('[data-testid="xp-bar-next"]')).not.toBeNull();
  });
});
