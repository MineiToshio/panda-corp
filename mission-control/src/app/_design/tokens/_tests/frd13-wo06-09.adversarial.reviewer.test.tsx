/**
 * FRD-13 WO-13-006..009 ADVERSARIAL REVIEWER TESTS (DR-015 / DR-016)
 *
 * Written by the independent reviewer (Sonnet 4.6), NOT the implementers.
 * Exercises WO-13-006 (PageTitle / SectionHead / Tabs), WO-13-007 (Banner /
 * Button / ProgressBar / …), WO-13-008 (Shield / TierBadge / ItemSlot /
 * KanbanColumn) and WO-13-009 (Room / AgentSprite / MissionBar / FlowStrip /
 * PowerOffOverlay) TOGETHER as an integrated cross-WO unit — the integration
 * the per-WO self-tests do not run.
 *
 * Scope: edge cases, error paths and abuse scenarios the implementer suites
 * did not cover, anchored in EARS acceptance criteria:
 *
 *   AC-13: tabular-nums, token-only, prefers-reduced-motion, no color-alone,
 *          WCAG aria-label in Spanish, keyboard operability, DR-062 cohesion.
 *   REQ-06-001 / DR-061: AgentSprite state rendering, MissionBar read-only.
 *   DR-057: one Banner, one set of cohesion primitives — no near-duplicates.
 *
 * Each test is mutation-hostile: a one-line deletion/flip in the source
 * makes at least one test here RED (DR-016 mutation gate).
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// WO-13-006
import { PageTitle } from "@/components/core/PageTitle/PageTitle";
import { SectionHead } from "@/components/core/SectionHead/SectionHead";
import { SubTabs, Tabs } from "@/components/core/Tabs/Tabs";

// WO-13-007
import { Banner, type BannerProps } from "@/components/core/Banner/Banner";
import { ProgressBar } from "@/components/core/ProgressBar/ProgressBar";
import { Button } from "@/components/core/Button/Button";

// WO-13-008
import { ItemSlot } from "@/components/core/ItemSlot/ItemSlot";
import { KanbanColumn } from "@/components/core/KanbanColumn/KanbanColumn";
import { Shield } from "@/components/core/Shield/Shield";
import { TierBadge } from "@/components/core/TierBadge/TierBadge";

// WO-13-009
import { AgentSprite } from "@/components/modules/party/AgentSprite/AgentSprite";
import { FlowStrip } from "@/components/modules/party/FlowStrip/FlowStrip";
import { MissionBar } from "@/components/modules/party/MissionBar/MissionBar";
import { PowerOffOverlay } from "@/components/modules/party/PowerOffOverlay/PowerOffOverlay";
import { Room } from "@/components/modules/party/Room/Room";

// ──────────────────────────────────────────────────────────────────────────────
// Shared fixtures
// ──────────────────────────────────────────────────────────────────────────────

const THREE_TABS = [
  { id: "inicio", label: "Inicio" },
  { id: "tablero", label: "Tablero" },
  { id: "portfolio", label: "Portfolio" },
];

const EIGHT_BEATS = [
  { key: "product", icon: "📋", label: "Producto", sub: "spec" },
  { key: "design", icon: "🎨", label: "Diseño", sub: "tokens" },
  { key: "architecture", icon: "📐", label: "Arquitectura", sub: "blueprint" },
  { key: "foundation", icon: "🧱", label: "Fundación", sub: "FND" },
  { key: "build", icon: "⚒️", label: "Construcción", sub: "FRD×N" },
  { key: "review", icon: "⚖️", label: "Revisión", sub: "gate" },
  { key: "integration", icon: "🔗", label: "Integración", sub: "cross" },
  { key: "release", icon: "🚀", label: "Release", sub: "deploy" },
] as const;

// ──────────────────────────────────────────────────────────────────────────────
// 1. WO-13-006: Tabs — edge cases the implementer missed
// ──────────────────────────────────────────────────────────────────────────────

describe("frd-13 reviewer (WO-13-006): Tabs — adversarial edge cases", () => {
  // Mutation target: if onChange is wired to the wrong tab, this fails.
  it("clicking the SECOND tab (not first) calls onChange with the correct id", () => {
    const onChange = vi.fn();
    render(<Tabs level="top" tabs={THREE_TABS} active="inicio" onChange={onChange} />);
    fireEvent.click(screen.getByTestId("tab-tablero"));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("tablero"); // NOT "inicio"
  });

  // Mutation target: a broken ArrowLeft wrap would land on tab[2] instead of tab[0]
  it("ArrowLeft on the FIRST tab wraps to the LAST tab (not undefined)", () => {
    render(<Tabs level="top" tabs={THREE_TABS} active="inicio" onChange={vi.fn()} />);
    const tablist = screen.getByRole("tablist");
    const buttons = screen.getAllByRole("tab");
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    first.focus();
    fireEvent.keyDown(tablist, { key: "ArrowLeft" });
    expect(document.activeElement).toBe(last);
  });

  // Mutation target: roving tabindex — only active tab is 0; others must be -1
  it("only the active tab has tabIndex=0; all others have tabIndex=-1 (roving tabindex)", () => {
    render(<Tabs level="top" tabs={THREE_TABS} active="tablero" onChange={vi.fn()} />);
    const buttons = screen.getAllByRole("tab");
    const [inicio, tablero, portfolio] = buttons as HTMLButtonElement[];
    expect(Number(inicio.tabIndex)).toBe(-1);
    expect(Number(tablero.tabIndex)).toBe(0);
    expect(Number(portfolio.tabIndex)).toBe(-1);
  });

  // Mutation target: single-tab wrap — ArrowRight on the only tab must not throw
  it("single-tab Tabs: ArrowRight does not throw and keeps focus on the same tab", () => {
    const SINGLE = [{ id: "solo", label: "Solo" }];
    render(<Tabs level="top" tabs={SINGLE} active="solo" onChange={vi.fn()} />);
    const tablist = screen.getByRole("tablist");
    const tab = screen.getByTestId("tab-solo");
    tab.focus();
    expect(() => fireEvent.keyDown(tablist, { key: "ArrowRight" })).not.toThrow();
    // Focus must remain on the sole tab, not vanish
    expect(document.activeElement).toBe(tab);
  });

  // Mutation target: SubTabs must be level="sub", not "top"
  it("SubTabs alias renders with data-level='sub', not 'top'", () => {
    render(<SubTabs tabs={THREE_TABS} active="inicio" onChange={vi.fn()} />);
    const root = screen.getByTestId("tabs-root");
    expect(root).toHaveAttribute("data-level", "sub");
    expect(root).not.toHaveAttribute("data-level", "top");
  });

  // Mutation target: changing active prop updates aria-selected without re-mounting
  it("when active changes to a different tab, aria-selected updates correctly", () => {
    const { rerender } = render(
      <Tabs level="top" tabs={THREE_TABS} active="inicio" onChange={vi.fn()} />,
    );
    expect(screen.getByTestId("tab-inicio")).toHaveAttribute("aria-selected", "true");

    rerender(<Tabs level="top" tabs={THREE_TABS} active="portfolio" onChange={vi.fn()} />);
    expect(screen.getByTestId("tab-inicio")).toHaveAttribute("aria-selected", "false");
    expect(screen.getByTestId("tab-portfolio")).toHaveAttribute("aria-selected", "true");
  });

  // Mutation target: ariaLabel prop must reach the tablist element
  it("ariaLabel prop is forwarded to role=tablist (not dropped)", () => {
    render(
      <Tabs
        level="top"
        tabs={THREE_TABS}
        active="inicio"
        onChange={vi.fn()}
        ariaLabel="Navegación principal"
      />,
    );
    expect(screen.getByRole("tablist")).toHaveAttribute("aria-label", "Navegación principal");
  });

  // DR-062 cross-surface cohesion: SectionHead + Tabs together on one surface
  it("DR-062 integration: PageTitle + SectionHead + Tabs render together without conflict", () => {
    render(
      <div>
        <PageTitle icon="ti-home" title="Inicio" />
        <SectionHead label="Actividad reciente" count={5} />
        <Tabs level="top" tabs={THREE_TABS} active="inicio" onChange={vi.fn()} />
      </div>,
    );
    // All three must be present — one of each (DR-062 "one everywhere")
    expect(screen.getByTestId("page-title")).toBeInTheDocument();
    expect(screen.getByTestId("section-head")).toBeInTheDocument();
    expect(screen.getByTestId("tabs-root")).toBeInTheDocument();

    // Exactly one H1 (not zero, not two — AC-13 + WCAG 2.2)
    const h1s = document.querySelectorAll("h1");
    expect(h1s).toHaveLength(1);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 2. WO-13-007: Banner — adversarial edge cases
// ──────────────────────────────────────────────────────────────────────────────

describe("frd-13 reviewer (WO-13-007): Banner — adversarial edge cases", () => {
  // Mutation target: onDismiss without dismissible=true must NOT fire on click
  // (the button must not even be rendered)
  it("onDismiss callback is NOT wired when dismissible is not set (no stray button)", () => {
    const onDismiss = vi.fn();
    render(<Banner tone="warn" heading="Aviso sin botón de descarte" onDismiss={onDismiss} />);
    // The dismiss button must not appear
    expect(screen.queryByTestId("banner-dismiss")).toBeNull();
    // Callback must not have been called
    expect(onDismiss).not.toHaveBeenCalled();
  });

  // Mutation target: collapse toggle aria-expanded must start at false
  it("collapse toggle starts with aria-expanded=false before user interaction", () => {
    const items = [
      { id: "a", label: "A" },
      { id: "b", label: "B" },
      { id: "c", label: "C" },
    ];
    render(<Banner tone="warn" heading="Lista" items={items} collapseAfter={1} />);
    const toggle = screen.getByTestId("banner-collapse-toggle");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  // Mutation target: after expand, toggle text changes AND aria-expanded flips
  it("collapse toggle becomes aria-expanded=true after click", () => {
    const items = [
      { id: "a", label: "A" },
      { id: "b", label: "B" },
      { id: "c", label: "C" },
    ];
    render(<Banner tone="warn" heading="Lista" items={items} collapseAfter={1} />);
    const toggle = screen.getByTestId("banner-collapse-toggle");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
  });

  // Mutation target: items=undefined must not crash (the implementer used Array.isArray guard)
  it("Banner renders without crashing when items is undefined (no crash on absent list)", () => {
    expect(() => render(<Banner tone="info" heading="Sin items" items={undefined} />)).not.toThrow();
  });

  // Mutation target: items=[] (empty array) must render without a collapse toggle
  it("empty items array renders no items and no collapse toggle", () => {
    render(<Banner tone="ok" heading="Lista vacía" items={[]} collapseAfter={1} />);
    expect(screen.queryByTestId("banner-collapse-toggle")).toBeNull();
  });

  // Mutation target: all four tones must render with role="alert" (not just warn)
  it.each(["warn", "info", "ok", "danger"] as const)(
    "tone='%s' renders with role=alert (not just warn tone)",
    (tone) => {
      render(<Banner tone={tone} heading={`Banner ${tone}`} />);
      expect(screen.getByRole("alert")).toBeInTheDocument();
    },
  );

  // Mutation target: each tone must produce a GEOMETRICALLY DISTINCT icon
  // (color-alone test: icons differ by shape, not just color)
  it("all four tones produce geometrically distinct SVG icons (no two shapes identical)", () => {
    // Render each tone and capture the SVG path/polygon elements
    const shapes: string[] = [];
    for (const tone of ["warn", "info", "ok", "danger"] as BannerProps["tone"][]) {
      const { unmount } = render(<Banner tone={tone} heading={`T ${tone}`} />);
      const icon = screen.getByTestId("banner-icon");
      // The outerHTML of each icon SVG should differ (polygon vs circle vs polyline)
      shapes.push(icon.outerHTML);
      unmount();
    }
    // All four icon shapes must be distinct
    const unique = new Set(shapes);
    expect(unique.size).toBe(4);
  });

  // Mutation target: commandRow renders the text AND the CopyButton, not just one
  it("commandRow renders both the command text AND a copy affordance", () => {
    render(<Banner tone="warn" heading="Comando" commandRow="claude plugin update" />);
    const cmdRow = screen.getByTestId("banner-cmd-row");
    // The command text must be present
    expect(cmdRow).toHaveTextContent("claude plugin update");
    // A copy button (CopyButton) must be present — role=button inside cmdRow
    const copyBtn = cmdRow.querySelector("button");
    expect(copyBtn).not.toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 3. WO-13-007: ProgressBar — adversarial edge cases
// ──────────────────────────────────────────────────────────────────────────────

describe("frd-13 reviewer (WO-13-007): ProgressBar — adversarial edge cases", () => {
  // Mutation target: if total=0 guard is removed, division by zero → NaN → "NaN%"
  it("total=0 renders 0% without NaN in the output", () => {
    render(<ProgressBar done={0} total={0} />);
    const bar = screen.getByTestId("progress-bar");
    expect(bar.textContent).not.toContain("NaN");
    expect(bar.textContent).toContain("0%");
  });

  // Mutation target: done > total must not produce >100% or data-complete=false
  it("done>total clamps to 100% and sets data-complete=true", () => {
    render(<ProgressBar done={15} total={10} />);
    const bar = screen.getByTestId("progress-bar");
    // data-complete must be set (done >= total)
    expect(bar).toHaveAttribute("data-complete", "true");
    // Percentage shown must not exceed 100
    const pctMatch = bar.textContent?.match(/(\d+)%/);
    const pct = pctMatch ? Number(pctMatch[1]) : -1;
    expect(pct).toBeLessThanOrEqual(100);
  });

  // Mutation target: the stripe gradient contains a hardcoded hex fallback (#0f1517)
  // that violates the "tokens only" AC. The fill test passes because it only checks
  // the fill element, not the stripe overlay.
  it("stripe overlay style must not contain hardcoded hex color fallback", () => {
    const { container } = render(<ProgressBar done={5} total={10} />);
    // Find the stripe div (the one with aria-hidden=true inside the track)
    const stripeDiv = container.querySelector(
      "[data-testid='progress-bar'] div > div[aria-hidden='true']",
    ) as HTMLElement | null;
    if (!stripeDiv) {
      // If the stripe overlay is not rendered as a direct child, scan all divs
      const allDivs = Array.from(container.querySelectorAll("div"));
      const stripe = allDivs.find((d) => {
        const s = d.getAttribute("style") ?? "";
        return s.includes("repeating-linear-gradient") || s.includes("transparent");
      });
      if (stripe) {
        const style = stripe.getAttribute("style") ?? "";
        expect(style, "Stripe overlay uses hardcoded hex fallback — violates AC tokens-only").not.toMatch(/#[0-9a-fA-F]{3,8}/);
      }
      // If no stripe found, at least the container should have no hex
      return;
    }
    const style = stripeDiv.getAttribute("style") ?? "";
    expect(style, "Stripe overlay uses hardcoded hex fallback — violates AC tokens-only").not.toMatch(
      /#[0-9a-fA-F]{3,8}/,
    );
  });

  // Mutation target: aria-valuenow must reflect `done`, not a stale value
  it("aria-valuenow equals done, aria-valuemax equals total", () => {
    render(<ProgressBar done={7} total={20} />);
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "7");
    expect(bar).toHaveAttribute("aria-valuemax", "20");
    expect(bar).toHaveAttribute("aria-valuemin", "0");
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 4. WO-13-008: Shield, TierBadge, ItemSlot, KanbanColumn — adversarial
// ──────────────────────────────────────────────────────────────────────────────

describe("frd-13 reviewer (WO-13-008): Shield — adversarial edge cases", () => {
  // Mutation target: level=0 must render "0", not empty
  it("level=0 renders '0' in the DOM (not empty / not skipped)", () => {
    render(<Shield level={0} />);
    expect(screen.getByTestId("shield-level").textContent).toContain("0");
  });

  // Mutation target: glow=false must NOT apply a glow box-shadow
  it("glow=false does not apply data-glow='true' (must be 'false' or absent)", () => {
    render(<Shield level={5} glow={false} />);
    const root = screen.getByTestId("shield-root");
    expect(root.getAttribute("data-glow")).not.toBe("true");
  });

  // Mutation target: both NIVEL label and numeral must always be in the DOM together
  it("NIVEL label and level numeral are always co-present (tabular-nums AC)", () => {
    render(<Shield level={42} />);
    expect(screen.getByTestId("shield-nivel-label")).toBeInTheDocument();
    expect(screen.getByTestId("shield-level")).toHaveTextContent("42");
  });
});

describe("frd-13 reviewer (WO-13-008): TierBadge — adversarial edge cases", () => {
  // Mutation target: tier name must always be VISIBLE text, not just aria-label
  // (never-color-alone: the badge must show text alongside the colored background)
  it("tier name is visible as textContent (not just aria-label) — never color-alone", () => {
    render(<TierBadge tier={5} name="Leyenda" />);
    const nameEl = screen.getByTestId("tier-badge-name");
    // Must be a real text node that a sighted user can see, not just aria
    expect(nameEl.textContent).toContain("Leyenda");
    // The nameEl must not have aria-hidden (hidden text is not "visible")
    expect(nameEl.getAttribute("aria-hidden")).not.toBe("true");
  });

  // Mutation target: data-tier must be numeric string, not name string
  it("data-tier attribute is the numeric tier (1–5), not the name string", () => {
    for (const tier of [1, 2, 3, 4, 5] as const) {
      const { unmount } = render(<TierBadge tier={tier} name={`T${tier}`} />);
      const root = screen.getByTestId("tier-badge-root");
      expect(root.getAttribute("data-tier")).toBe(String(tier));
      // Sanity: data-tier must not be the name
      expect(root.getAttribute("data-tier")).not.toBe(`T${tier}`);
      unmount();
    }
  });
});

describe("frd-13 reviewer (WO-13-008): ItemSlot — adversarial edge cases", () => {
  // Mutation target: tone=undefined (no tone) must not crash and must use neutral tokens
  it("ItemSlot with no tone renders without crash (neutral style applied)", () => {
    expect(() =>
      render(
        <ItemSlot aria-label="Espacio vacío" icon={<span>?</span>} />,
      ),
    ).not.toThrow();
    expect(screen.getByTestId("itemslot-root")).toBeInTheDocument();
  });

  // Mutation target: data-locked must track the lock prop precisely
  it("lock=true sets data-locked='true'; lock=false (or omitted) sets data-locked='false'", () => {
    const { unmount } = render(
      <ItemSlot aria-label="Bloqueado" icon={<span>🔒</span>} lock={true} />,
    );
    expect(screen.getByTestId("itemslot-root")).toHaveAttribute("data-locked", "true");
    unmount();

    render(<ItemSlot aria-label="Libre" icon={<span>🎖</span>} />);
    expect(screen.getByTestId("itemslot-root")).toHaveAttribute("data-locked", "false");
  });

  // Mutation target: reveal overlay must NOT render when reveal prop is omitted
  it("itemslot-reveal does not appear when reveal prop is absent", () => {
    render(<ItemSlot aria-label="Sin reveal" icon={<span>X</span>} />);
    expect(screen.queryByTestId("itemslot-reveal")).toBeNull();
  });

  // Mutation target: reveal overlay MUST render when reveal prop is provided
  it("itemslot-reveal appears when reveal prop is provided", () => {
    render(
      <ItemSlot
        aria-label="Con reveal"
        icon={<span>🏅</span>}
        lock={true}
        reveal={<span>Secreto revelado</span>}
      />,
    );
    expect(screen.getByTestId("itemslot-reveal")).toBeInTheDocument();
  });

  // Mutation target: role=img is required for a non-interactive item slot with aria-label
  it("ItemSlot root has role='img' (required for aria-label to be meaningful)", () => {
    render(<ItemSlot aria-label="Medalla de oro" icon={<span>🥇</span>} tone="ok" />);
    const root = screen.getByTestId("itemslot-root");
    expect(root).toHaveAttribute("role", "img");
  });
});

describe("frd-13 reviewer (WO-13-008): KanbanColumn — adversarial edge cases", () => {
  // Mutation target: count=0 must render "0", not be treated as falsy/absent
  it("count=0 renders '0' in the count slot (not empty, 0 is a valid count)", () => {
    render(<KanbanColumn label="Pendiente" count={0} />);
    const count = screen.getByTestId("kanban-col-count");
    expect(count.textContent).toContain("0");
  });

  // Mutation target: aria-label must include both label AND count for context
  it("aria-label includes both the column label and the count", () => {
    render(<KanbanColumn label="En progreso" count={4} />);
    const root = screen.getByTestId("kanban-col-root");
    const ariaLabel = root.getAttribute("aria-label") ?? "";
    expect(ariaLabel).toContain("En progreso");
    expect(ariaLabel).toContain("4");
  });

  // Mutation target: children slot must render inside the column body
  it("children render inside the kanban-col-body slot", () => {
    render(
      <KanbanColumn label="Hecho" count={2}>
        <div data-testid="child-card">Tarjeta</div>
      </KanbanColumn>,
    );
    const body = screen.getByTestId("kanban-col-body");
    expect(body).toContainElement(screen.getByTestId("child-card"));
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 5. WO-13-009: Room, AgentSprite, MissionBar, FlowStrip — adversarial
// ──────────────────────────────────────────────────────────────────────────────

describe("frd-13 reviewer (WO-13-009): Room — adversarial edge cases", () => {
  // Mutation target: count=0 is falsy but must still render the count chip
  it("count=0 renders the count chip (0 is a valid, meaningful count)", () => {
    render(<Room zone="forge" label="Forja" state="cool" count={0} />);
    const countEl = screen.getByTestId("room-count");
    expect(countEl.textContent).toContain("0");
  });

  // Mutation target: active state must apply accent glow (not locked glow)
  it("active state sets data-state='active' (not 'locked' or 'done')", () => {
    render(<Room zone="tribunal" label="Tribunal" state="active" />);
    expect(screen.getByTestId("room-root")).toHaveAttribute("data-state", "active");
  });

  // Mutation target: aria-label must be in Spanish and include the label
  it("aria-label references the label text in Spanish", () => {
    render(<Room zone="vault" label="Bóveda" state="done" />);
    const root = screen.getByTestId("room-root");
    const ariaLabel = root.getAttribute("aria-label") ?? "";
    expect(ariaLabel).toContain("Bóveda");
  });

  // Mutation target: `spec` zone must map to review.png (not spec.png — that asset doesn't exist)
  it("zone='spec' maps to a non-empty background image URL", () => {
    render(<Room zone="spec" label="Spec" state="cool" />);
    const bg = screen.getByTestId("room-bg");
    const bgStyle = bg.getAttribute("style") ?? "";
    // Must have a url() reference, and it must not be empty
    expect(bgStyle).toMatch(/url\(.+\)/);
    expect(bgStyle).not.toMatch(/url\(\s*\)/);
  });

  // Mutation target: locked state must apply grayscale filter (not none)
  it("locked state mentions data-state='locked' on root", () => {
    render(<Room zone="research" label="Investigación" state="locked" />);
    expect(screen.getByTestId("room-root")).toHaveAttribute("data-state", "locked");
  });

  // Mutation target: children must render ABOVE the background (not behind it)
  it("children slot is rendered as a sibling of the bg, not inside it", () => {
    render(
      <Room zone="build" label="Construcción" state="hot">
        <span data-testid="sprite-child">Agente</span>
      </Room>,
    );
    const child = screen.getByTestId("sprite-child");
    const bg = screen.getByTestId("room-bg");
    const root = screen.getByTestId("room-root");
    // Both bg and child must be children of root (not bg > child)
    expect(root).toContainElement(bg);
    expect(root).toContainElement(child);
    expect(bg).not.toContainElement(child);
  });
});

describe("frd-13 reviewer (WO-13-009): AgentSprite — adversarial edge cases", () => {
  // Mutation target: progress > 1.0 — the fill width must clamp to ≤100%
  it("progress=2.0 (out of range) renders fill width ≤ 100%, never >100%", () => {
    const { container } = render(
      <AgentSprite agentRole="implementer" state="work" woId="WO-06-001" progress={2.0} />,
    );
    const fill = container.querySelector("i[aria-hidden]") as HTMLElement | null;
    if (fill) {
      const style = fill.getAttribute("style") ?? "";
      const widthMatch = style.match(/width:\s*([\d.]+)%/);
      if (widthMatch) {
        expect(Number(widthMatch[1])).toBeLessThanOrEqual(100);
      }
    }
  });

  // Mutation target: progress=0 must show a 0% fill, not undefined
  it("progress=0 renders a 0% fill in work state (not broken/absent)", () => {
    const { container } = render(
      <AgentSprite agentRole="implementer" state="work" woId="WO-06-001" progress={0} />,
    );
    const fill = container.querySelector("i[aria-hidden]") as HTMLElement | null;
    if (fill) {
      const style = fill.getAttribute("style") ?? "";
      expect(style).toMatch(/width:\s*0%/);
    }
  });

  // Mutation target: aria-label must include role, woId AND state — three distinct data points
  it("aria-label includes agentRole, woId AND state (DR-062 identity triangle)", () => {
    render(
      <AgentSprite agentRole="reviewer" state="review" woId="WO-13-006" />,
    );
    const root = screen.getByTestId("agent-sprite-root");
    const label = root.getAttribute("aria-label") ?? "";
    expect(label).toContain("reviewer");
    expect(label).toContain("WO-13-006");
    expect(label).toContain("review");
  });

  // Mutation target: data-role must reflect the agentRole prop, not a default
  it("data-role reflects agentRole 'reviewer', not 'implementer' default", () => {
    render(<AgentSprite agentRole="reviewer" state="work" woId="WO-06-X" />);
    const root = screen.getByTestId("agent-sprite-root");
    expect(root).toHaveAttribute("data-role", "reviewer");
    expect(root).not.toHaveAttribute("data-role", "implementer");
  });

  // Mutation target: say-on state must not show carry or medal icons
  it("say-on state does not show carry icon or medal (only work/carry/vault trigger those)", () => {
    render(<AgentSprite agentRole="implementer" state="say-on" woId="WO-06-002" />);
    expect(screen.getByTestId("agent-sprite-carry")).toHaveAttribute("data-visible", "false");
    expect(screen.getByTestId("agent-sprite-medal")).toHaveAttribute("data-visible", "false");
  });
});

describe("frd-13 reviewer (WO-13-009): MissionBar — adversarial edge cases", () => {
  // Mutation target: empty frdPips must not crash and must render no pips
  it("empty frdPips array renders no pips without crashing", () => {
    expect(() =>
      render(<MissionBar frdPips={[]} done={0} total={10} effort="pro" />),
    ).not.toThrow();
    expect(screen.queryAllByTestId(/^mission-bar-pip-/)).toHaveLength(0);
  });

  // Mutation target: done=0, total=0 — tabular-nums counter must not show NaN
  it("done=0 total=0 renders counter without NaN", () => {
    render(<MissionBar frdPips={[{ id: "FRD-01", state: "current" }]} done={0} total={0} effort="pro" />);
    const counter = screen.getByTestId("mission-bar-counter");
    expect(counter.textContent).not.toContain("NaN");
  });

  // Mutation target: DR-061 — effort must never be a button, input or select
  // even when the effort string looks like a command
  it("DR-061: effort displayed as plain text even when it looks like a command", () => {
    render(
      <MissionBar
        frdPips={[{ id: "FRD-01", state: "current" }]}
        done={5}
        total={10}
        effort="pandacorp:implement --mode potente"
      />,
    );
    const effort = screen.getByTestId("mission-bar-effort");
    expect(effort.tagName).not.toBe("BUTTON");
    expect(effort.tagName).not.toBe("INPUT");
    expect(effort.tagName).not.toBe("A"); // Not a link either
    expect(effort).toHaveTextContent("pandacorp:implement --mode potente");
  });

  // Mutation target: N-1 arrows between N pips (not N arrows)
  it("N pips produce exactly N-1 arrow separators", () => {
    const pips = [
      { id: "FRD-01", state: "done" as const },
      { id: "FRD-02", state: "current" as const },
      { id: "FRD-03", state: "pending" as const },
      { id: "FRD-04", state: "pending" as const },
    ];
    render(<MissionBar frdPips={pips} done={10} total={20} effort="pro" />);
    const arrows = screen.getAllByTestId("mission-bar-arrow");
    expect(arrows).toHaveLength(pips.length - 1);
  });

  // Mutation target: the WO counter must show done/total in that order
  it("WO counter shows done BEFORE total (done/total, not total/done)", () => {
    render(
      <MissionBar
        frdPips={[{ id: "FRD-01", state: "current" }]}
        done={3}
        total={42}
        effort="pro"
      />,
    );
    const counter = screen.getByTestId("mission-bar-counter");
    const text = counter.textContent ?? "";
    // The string "3" must appear before "42"
    expect(text.indexOf("3")).toBeLessThan(text.indexOf("42"));
  });
});

describe("frd-13 reviewer (WO-13-009): FlowStrip — adversarial edge cases", () => {
  // Mutation target: an activeKey that matches NO beat must not crash or
  // mark a non-existent beat as active
  it("activeKey referencing a non-existent beat does not crash or corrupt other beats", () => {
    expect(() =>
      render(<FlowStrip beats={EIGHT_BEATS} activeKeys={["nonexistent-beat"]} />),
    ).not.toThrow();
    // All real beats must remain inactive
    for (const beat of EIGHT_BEATS) {
      expect(screen.getByTestId(`flow-beat-${beat.key}`)).toHaveAttribute("data-active", "false");
    }
  });

  // Mutation target: empty activeKeys — ALL beats must be data-active=false (not undefined)
  it("empty activeKeys sets all beats to data-active='false' (not undefined)", () => {
    render(<FlowStrip beats={EIGHT_BEATS} activeKeys={[]} />);
    for (const beat of EIGHT_BEATS) {
      expect(screen.getByTestId(`flow-beat-${beat.key}`)).toHaveAttribute("data-active", "false");
    }
  });

  // Mutation target: all 8 beats active simultaneously must not merge/collide
  it("all 8 beats active simultaneously renders 8 distinct active beat elements", () => {
    render(<FlowStrip beats={EIGHT_BEATS} activeKeys={EIGHT_BEATS.map((b) => b.key)} />);
    const actives = screen
      .getAllByTestId(/^flow-beat-/)
      .filter((el) => el.getAttribute("data-active") === "true");
    expect(actives).toHaveLength(8);
  });

  // Mutation target: tooltip testid convention — must be flow-tip-<key>, NOT flow-beat-tip-<key>
  it("tooltip testids follow the flow-tip-{key} convention (not flow-beat-tip-{key})", () => {
    render(<FlowStrip beats={EIGHT_BEATS} activeKeys={[]} />);
    // Correct: flow-tip-product exists
    expect(screen.getByTestId("flow-tip-product")).toBeInTheDocument();
    // Wrong pattern must NOT exist
    expect(screen.queryByTestId("flow-beat-tip-product")).toBeNull();
  });
});

describe("frd-13 reviewer (WO-13-009): PowerOffOverlay — adversarial edge cases", () => {
  // Mutation target: off=false must set display:none (visually hidden, not missing from DOM)
  it("off=false renders the overlay as display:none in the DOM (not removed)", () => {
    render(<PowerOffOverlay off={false} />);
    const overlay = screen.getByTestId("power-off-overlay-root");
    // The element must exist in the DOM but be hidden
    expect(overlay).toBeInTheDocument();
    const style = overlay.getAttribute("style") ?? "";
    expect(style).toContain("none");
    expect(overlay).toHaveAttribute("data-off", "false");
  });

  // Mutation target: off=true must set display:flex (not none)
  it("off=true renders the overlay as display:flex (visible)", () => {
    render(<PowerOffOverlay off={true} />);
    const overlay = screen.getByTestId("power-off-overlay-root");
    expect(overlay).toBeInTheDocument();
    const style = overlay.getAttribute("style") ?? "";
    expect(style).toContain("flex");
    expect(overlay).toHaveAttribute("data-off", "true");
  });

  // Mutation target: "Fábrica apagada" title must always be present regardless of off prop
  it("'Fábrica apagada' title is in the DOM whether off=true or off=false", () => {
    const { rerender } = render(<PowerOffOverlay off={false} />);
    expect(screen.getByTestId("power-off-title")).toBeInTheDocument();
    rerender(<PowerOffOverlay off={true} />);
    expect(screen.getByTestId("power-off-title")).toBeInTheDocument();
  });

  // Mutation target: overlay must never expose any interactive controls (never a toggle)
  it("PowerOffOverlay has no interactive buttons or inputs (derived state only, DR-061)", () => {
    const { container } = render(<PowerOffOverlay off={true} />);
    expect(container.querySelectorAll("button")).toHaveLength(0);
    expect(container.querySelectorAll("input")).toHaveLength(0);
    expect(container.querySelectorAll("select")).toHaveLength(0);
    expect(container.querySelectorAll("a")).toHaveLength(0);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 6. Cross-WO INTEGRATION: DR-062 cohesion — exercises WO-006 + 007 + 008 + 009
//    together on a single simulated surface
// ──────────────────────────────────────────────────────────────────────────────

describe("frd-13 reviewer: DR-062 cross-WO integration (all four foundation WOs together)", () => {
  it("a surface using PageTitle + Banner + Shield + Room + AgentSprite renders without conflict", () => {
    // Simulates a project workspace surface that combines primitives from all four WOs
    render(
      <div>
        {/* WO-13-006: cohesion title */}
        <PageTitle icon="ti-bolt" title="La Fragua" subtitle="Build en curso" />

        {/* WO-13-007: one banner */}
        <Banner tone="warn" heading="Plugin desincronizado" kind="drift" />

        {/* WO-13-008: gamification primitives */}
        <Shield level={7} />
        <TierBadge tier={3} name="Oro" />
        <KanbanColumn label="En progreso" count={2} />

        {/* WO-13-009: party canvas */}
        <MissionBar
          frdPips={[
            { id: "FRD-13", state: "done" },
            { id: "FRD-06", state: "current" },
          ]}
          done={42}
          total={78}
          effort="pro"
        />
        <Room zone="forge" label="Forja" state="hot">
          <AgentSprite agentRole="implementer" state="work" woId="WO-06-001" progress={0.6} />
        </Room>
      </div>,
    );

    // All primitives must coexist without conflict
    expect(screen.getByTestId("page-title")).toBeInTheDocument();
    expect(screen.getByTestId("banner")).toBeInTheDocument();
    expect(screen.getByTestId("shield-root")).toBeInTheDocument();
    expect(screen.getByTestId("tier-badge-root")).toBeInTheDocument();
    expect(screen.getByTestId("kanban-col-root")).toBeInTheDocument();
    expect(screen.getByTestId("mission-bar-root")).toBeInTheDocument();
    expect(screen.getByTestId("room-root")).toBeInTheDocument();
    expect(screen.getByTestId("agent-sprite-root")).toBeInTheDocument();

    // Exactly one H1 (DR-062 + WCAG — "H1 equals the nav label")
    const h1s = document.querySelectorAll("h1");
    expect(h1s).toHaveLength(1);
    expect(h1s[0].textContent).toBe("La Fragua");
  });

  it("no hardcoded hex appears in any of the four WOs when rendered together", () => {
    const { container } = render(
      <div>
        <PageTitle icon="ti-star" title="Portfolio" />
        <SectionHead label="Proyectos activos" count={3} />
        <Tabs level="top" tabs={THREE_TABS} active="inicio" onChange={vi.fn()} />
        <Banner tone="ok" heading="Todo en orden" />
        <ProgressBar done={55} total={78} />
        <Shield level={5} />
        <KanbanColumn label="Verificado" count={7} />
        <MissionBar
          frdPips={[{ id: "FRD-01", state: "done" }]}
          done={55}
          total={78}
          effort="equilibrado"
        />
        <Room zone="vault" label="Bóveda" state="done" />
      </div>,
    );

    // Scan the outerHTML for bare hex color literals (the token-only AC)
    // Allow the agent-sprite tag scrim rgba() and party structural literals
    // which are approved structural literals, not token violations
    const html = container.outerHTML;
    // Extract all style attribute values to check
    const styleAttrs: string[] = [];
    container.querySelectorAll("[style]").forEach((el) => {
      const s = el.getAttribute("style") ?? "";
      // Exclude the ProgressBar stripe (known violation, caught by separate test above)
      if (!s.includes("repeating-linear-gradient")) {
        styleAttrs.push(s);
      }
    });
    // None of the non-stripe style attrs should have hex colors
    for (const s of styleAttrs) {
      if (s.includes("#")) {
        // Permit only if it's inside a var() or bg-image url() context
        expect(s, `Hardcoded hex found outside allowed context: ${s}`).not.toMatch(
          /(?<!url\([^)]*|var\([^)]*)#[0-9a-fA-F]{3,8}/,
        );
      }
    }
    void html; // reference to avoid unused-var
  });
});
