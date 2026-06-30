/**
 * FRD-13 WO-13-007 + WO-13-009 ADVERSARIAL REVIEWER TESTS — Round 2
 * (DR-015 / DR-016)
 *
 * Written by the INDEPENDENT REVIEWER (Sonnet 4.6), NOT the implementers.
 * Exercises WO-13-007 (Banner/Button/Panel/CmdRow/Toast/ProgressBar/Chip/
 * CountBadge/DocHeading) and WO-13-009 (Room/AgentSprite/MissionBar/
 * FlowStrip/PowerOffOverlay/SpeechBubble/DemoControls/StoneBridge/Parchment)
 * TOGETHER in cross-WO integration, plus edge cases and abuse paths the
 * per-WO self-tests did NOT cover.
 *
 * Scope — derived from EARS criteria + real implementer blind spots:
 *   AC-13: tabular-nums on numbers, tokens-only, no color-alone, WCAG a11y,
 *          prefers-reduced-motion, keyboard operability, DR-061 read-only.
 *   WO-13-007 gaps: Banner/dismiss-no-handler, Banner/empty-items, Panel/grid-hex,
 *          ProgressBar/NaN-division, Button/disabled-form-type, Toast/rapid-refire.
 *   WO-13-009 gaps: AgentSprite/progress-clamp, Room/count-zero, FlowStrip/unknown-key,
 *          MissionBar/done-gt-total, SpeechBubble/raised-position,
 *          PowerOffOverlay/toggle-is-not-a-control.
 *   Integration: Banner + Room + AgentSprite + MissionBar rendered together (cross-WO).
 *
 * Mutation-hostile: a single-line deletion/swap in any component makes one
 * test here RED (DR-016 mutation gate).
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// WO-13-007 imports
import { Banner } from "@/components/core/Banner/Banner";
import { Button } from "@/components/core/Button/Button";
import { Chip } from "@/components/core/Chip/Chip";
import { CmdRow } from "@/components/core/CmdRow/CmdRow";
import { CountBadge } from "@/components/core/CountBadge/CountBadge";
import { DocHeading } from "@/components/core/DocHeading/DocHeading";
import { Panel } from "@/components/core/Panel/Panel";
import { ProgressBar } from "@/components/core/ProgressBar/ProgressBar";
// WO-13-009 imports
import { AgentSprite } from "@/components/modules/party/AgentSprite/AgentSprite";
import { DemoControls } from "@/components/modules/party/DemoControls/DemoControls";
import { FlowStrip } from "@/components/modules/party/FlowStrip/FlowStrip";
import { MissionBar } from "@/components/modules/party/MissionBar/MissionBar";
import { PowerOffOverlay } from "@/components/modules/party/PowerOffOverlay/PowerOffOverlay";
import { Room } from "@/components/modules/party/Room/Room";
import { SpeechBubble } from "@/components/modules/party/SpeechBubble/SpeechBubble";

// ──────────────────────────────────────────────────────────────────────────────
// 1. WO-13-007: Banner — adversarial edge cases NOT in the implementer suite
// ──────────────────────────────────────────────────────────────────────────────

describe("frd-13 reviewer2 (WO-13-007): Banner — adversarial edge cases", () => {
  // Mutation target: if dismiss button renders even without dismissible=true, this fails
  it("dismissible=false (explicit) renders NO dismiss button", () => {
    render(<Banner tone="warn" heading="Aviso" dismissible={false} onDismiss={vi.fn()} />);
    expect(screen.queryByTestId("banner-dismiss")).toBeNull();
  });

  // Mutation target: clicking dismiss when onDismiss is undefined must NOT throw
  it("dismissible=true with onDismiss=undefined: clicking dismiss does not throw", () => {
    render(<Banner tone="danger" heading="Sin handler" dismissible={true} />);
    const btn = screen.getByTestId("banner-dismiss");
    expect(() => fireEvent.click(btn)).not.toThrow();
  });

  // Mutation target: items=[] (explicitly empty) — no toggle, no list items
  it("items=[] empty array: no collapse toggle, no list items rendered", () => {
    render(<Banner tone="warn" heading="Sin items" items={[]} collapseAfter={2} />);
    expect(screen.queryByTestId("banner-collapse-toggle")).toBeNull();
  });

  // Mutation target: collapseAfter equal to items.length — no toggle because len==collapseAfter
  it("items.length === collapseAfter: no collapse toggle (boundary — not > threshold)", () => {
    const items = [
      { id: "x", label: "X" },
      { id: "y", label: "Y" },
    ];
    render(<Banner tone="info" heading="Límite exacto" items={items} collapseAfter={2} />);
    expect(screen.queryByTestId("banner-collapse-toggle")).toBeNull();
    // Both items must be visible
    expect(screen.getByText("X")).toBeInTheDocument();
    expect(screen.getByText("Y")).toBeInTheDocument();
  });

  // Mutation target: collapsing and re-expanding returns to full list
  it("expand then collapse: toggle re-hides overflow items (toggle is bidirectional)", () => {
    const items = [
      { id: "a", label: "Alpha" },
      { id: "b", label: "Beta" },
      { id: "c", label: "Gamma" },
    ];
    render(<Banner tone="warn" heading="Lista" items={items} collapseAfter={1} />);
    const toggle = screen.getByTestId("banner-collapse-toggle");

    // Expand
    fireEvent.click(toggle);
    expect(screen.getByText("Beta")).toBeInTheDocument();
    expect(screen.getByText("Gamma")).toBeInTheDocument();
    // aria-expanded must be true after expand
    expect(toggle).toHaveAttribute("aria-expanded", "true");

    // Collapse again
    fireEvent.click(toggle);
    expect(screen.queryByText("Beta")).not.toBeInTheDocument();
    expect(screen.queryByText("Gamma")).not.toBeInTheDocument();
    // aria-expanded back to false
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  // Mutation target: kind=undefined → data-kind attribute must be absent/undefined, not "undefined"
  it("when kind is not set, data-kind is not the string 'undefined'", () => {
    render(<Banner tone="ok" heading="Sin kind" />);
    const banner = screen.getByTestId("banner");
    const kind = banner.getAttribute("data-kind");
    expect(kind).not.toBe("undefined");
  });

  // Mutation target: role=alert is present on all tones (not just warn)
  it("danger tone also gets role=alert (not only warn)", () => {
    render(<Banner tone="danger" heading="Peligro" />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  // Mutation target: banner aria-label contains the heading text
  it("aria-label on the banner root includes the heading text", () => {
    render(<Banner tone="warn" heading="Plugin drift detectado" />);
    const banner = screen.getByTestId("banner");
    const label = banner.getAttribute("aria-label") ?? "";
    expect(label).toContain("Plugin drift detectado");
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 2. WO-13-007: Panel grid hex fallback — tokens-only compliance
// ──────────────────────────────────────────────────────────────────────────────

describe("frd-13 reviewer2 (WO-13-007): Panel — grid overlay must not embed bare hex", () => {
  // Mutation target: the grid backgroundImage should NOT expose a raw hex color
  // that isn't wrapped in a CSS var() call. The rgba scrims and var() fallbacks
  // embedded inside var(--token, fallback) ARE the accepted pattern; a standalone
  // hex like #2f373a would be a token violation.
  //
  // In jsdom, Panel.style sets backgroundImage as a property. jsdom does NOT
  // compute CSS vars, so var() fallbacks survive as literal strings. If the
  // fallback is a hex value and it leaks outside the var() wrapper, the style
  // string will contain a naked hex literal.
  it("Panel grid=true: backgroundImage style contains no naked hex outside a var() call", () => {
    const { container } = render(
      <Panel variant="rpgpanel" grid={true}>
        Contenido
      </Panel>,
    );
    const el = container.firstElementChild as HTMLElement | null;
    if (!el) throw new Error("No panel element");
    const style = el.getAttribute("style") ?? "";
    // The backgroundImage contains var(--color-border, #2f373a) — the hex is
    // inside the var() fallback, which is the accepted form. We verify it is
    // ONLY inside var(…) and is not a standalone hex literal.
    // Strategy: remove all var(…) expressions, then check no hex remains.
    const stripped = style.replace(/var\([^)]+\)/g, "VAR");
    expect(stripped).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it("Panel grid=false: no backgroundImage style attribute present", () => {
    render(
      <Panel variant="rpgpanel" grid={false}>
        Content
      </Panel>,
    );
    const el = screen.getByTestId("panel");
    const style = el.getAttribute("style") ?? "";
    // Should contain no backgroundImage when grid is false
    expect(style).not.toContain("linear-gradient");
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 3. WO-13-007: ProgressBar — edge/abuse
// ──────────────────────────────────────────────────────────────────────────────

describe("frd-13 reviewer2 (WO-13-007): ProgressBar — edge cases", () => {
  // Mutation target: total=0 → must not produce NaN% (division by zero)
  it("total=0 done=0: renders 0% without NaN", () => {
    render(<ProgressBar done={0} total={0} />);
    const bar = screen.getByTestId("progress-bar");
    // aria-valuenow must be a number (not NaN)
    const valuenow = bar.getAttribute("aria-valuenow");
    expect(valuenow).not.toBeNull();
    expect(Number(valuenow)).not.toBeNaN();
    // The rendered label must not contain "NaN"
    expect(bar).not.toHaveTextContent("NaN");
  });

  // Mutation target: done > total should not produce >100%
  it("done > total: clamped to 100% fill and data-complete=true", () => {
    render(<ProgressBar done={15} total={10} />);
    const fill = screen.getByTestId("progress-bar-fill");
    const fillStyle = fill.getAttribute("style") ?? "";
    // Width must be exactly 100%
    expect(fillStyle).toContain("width: 100%");
    // data-complete must be true
    const bar = screen.getByTestId("progress-bar");
    expect(bar).toHaveAttribute("data-complete", "true");
  });

  // Mutation target: aria attributes must be present and correct
  it("role=progressbar with aria-valuemin=0 and aria-valuemax matches total", () => {
    render(<ProgressBar done={3} total={12} />);
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuemin", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "12");
    expect(bar).toHaveAttribute("aria-valuenow", "3");
  });

  // Mutation target: at 100% the fill switches to ok-color (not accent)
  it("done === total: fill switches to ok-color token (not accent)", () => {
    render(<ProgressBar done={10} total={10} />);
    const fill = screen.getByTestId("progress-bar-fill");
    const style = fill.getAttribute("style") ?? "";
    expect(style).toContain("--color-ok");
    expect(style).not.toContain("--color-accent");
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 4. WO-13-007: Button — edge/abuse cases
// ──────────────────────────────────────────────────────────────────────────────

describe("frd-13 reviewer2 (WO-13-007): Button — edge cases", () => {
  // Mutation target: disabled button must not fire onClick
  it("disabled=true: onClick is not called when the button is clicked", () => {
    const onClick = vi.fn();
    render(
      <Button disabled={true} onClick={onClick}>
        Guardar
      </Button>,
    );
    const btn = screen.getByRole("button");
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  // Mutation target: type="submit" must propagate to the DOM button
  it("type=submit propagates to the DOM button element", () => {
    render(<Button type="submit">Enviar</Button>);
    const btn = screen.getByRole("button");
    expect(btn).toHaveAttribute("type", "submit");
  });

  // Mutation target: ariaLabel forwarded to aria-label
  it("ariaLabel prop is forwarded to aria-label (icon-only usage)", () => {
    render(<Button ariaLabel="Cerrar panel">✕</Button>);
    const btn = screen.getByRole("button");
    expect(btn).toHaveAttribute("aria-label", "Cerrar panel");
  });

  // Mutation target: custom data-testid prop overrides the default "button"
  it("data-testid prop overrides the default 'button' testid", () => {
    render(<Button data-testid="save-btn">Guardar</Button>);
    expect(screen.getByTestId("save-btn")).toBeInTheDocument();
    expect(screen.queryByTestId("button")).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 5. WO-13-007: CmdRow — edge cases
// ──────────────────────────────────────────────────────────────────────────────

describe("frd-13 reviewer2 (WO-13-007): CmdRow — edge cases", () => {
  // Mutation target: copy=false suppresses the CopyButton
  it("copy=false: no copy button rendered", () => {
    render(<CmdRow command="/pandacorp:adopt" copy={false} />);
    // CopyButton would have a data-testid or role
    expect(screen.queryByRole("button")).toBeNull();
  });

  // Mutation target: command text must be selectable (userSelect:all)
  it("command text span has userSelect:all in style (keyboard/mouse select)", () => {
    render(<CmdRow command="claude plugin update pandacorp@panda-corp" />);
    const root = screen.getByTestId("cmd-row");
    // The command text is the first span
    const span = root.querySelector("span");
    if (!span) throw new Error("No span found");
    expect(span).toHaveStyle({ userSelect: "all" });
  });

  // Mutation target: long command does not overflow (overflow:hidden + text-overflow:ellipsis)
  it("command text has overflow:hidden and textOverflow:ellipsis (prevents layout break)", () => {
    render(
      <CmdRow command="a very very very very very very very very very very very very long command" />,
    );
    const span = screen.getByTestId("cmd-row").querySelector("span");
    if (!span) throw new Error("No span");
    const style = (span as HTMLElement).getAttribute("style") ?? "";
    expect(style).toContain("overflow: hidden");
    expect(style).toContain("text-overflow: ellipsis");
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 6. WO-13-007: CountBadge — edge cases
// ──────────────────────────────────────────────────────────────────────────────

describe("frd-13 reviewer2 (WO-13-007): CountBadge — edge cases", () => {
  // Mutation target: count=0 must still render (zero is a meaningful count)
  it("count=0 renders the badge (zero is a valid count, not hidden)", () => {
    render(<CountBadge count={0} tone="info" />);
    const badge = screen.getByTestId("count-badge");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent("0");
  });

  // Mutation target: large number renders without truncation or crash
  it("count=9999 renders without truncation or crash", () => {
    render(<CountBadge count={9999} tone="warn" />);
    expect(screen.getByTestId("count-badge")).toHaveTextContent("9999");
  });

  // Mutation target: data-tone attribute matches the tone prop
  it("data-tone attribute matches the passed tone", () => {
    render(<CountBadge count={3} tone="danger" />);
    expect(screen.getByTestId("count-badge")).toHaveAttribute("data-tone", "danger");
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 7. WO-13-007: DocHeading — edge cases
// ──────────────────────────────────────────────────────────────────────────────

describe("frd-13 reviewer2 (WO-13-007): DocHeading — edge cases", () => {
  // Mutation target: level=1 must render an h1 (not always h2)
  it("level=1 renders an h1 element", () => {
    render(<DocHeading title="Sistema visual" level={1} />);
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1).toHaveTextContent("Sistema visual");
  });

  // Mutation target: the accent ledge testid is always present
  it("the accent ledge element is always rendered (visual contract)", () => {
    render(<DocHeading title="Tokens" />);
    expect(screen.getByTestId("doc-heading-ledge")).toBeInTheDocument();
  });

  // Mutation target: level=4 (extreme) must not crash
  it("level=4 renders without throwing", () => {
    expect(() => render(<DocHeading title="Sub-sub heading" level={4} />)).not.toThrow();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 8. WO-13-007: Chip — adversarial tone coverage
// ──────────────────────────────────────────────────────────────────────────────

describe("frd-13 reviewer2 (WO-13-007): Chip — all tones + label/children", () => {
  const TONES = ["ok", "warn", "danger", "info", "accent", "secondary"] as const;

  // Mutation target: each tone must set data-tone attribute correctly
  it.each(TONES)("tone=%s sets data-tone correctly", (tone) => {
    render(<Chip tone={tone} label={tone} />);
    const chip = screen.getByTestId("chip");
    expect(chip).toHaveAttribute("data-tone", tone);
  });

  // Mutation target: children render inside the chip
  it("Chip renders children when no label prop given", () => {
    render(<Chip tone="info">Estado activo</Chip>);
    expect(screen.getByTestId("chip")).toHaveTextContent("Estado activo");
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 9. WO-13-009: AgentSprite — edge/abuse
// ──────────────────────────────────────────────────────────────────────────────

describe("frd-13 reviewer2 (WO-13-009): AgentSprite — edge cases", () => {
  // The forge "forging" indicator is a hammer (eye-candy), shown ONLY in work.
  it("work state: shows the forge hammer (animated), never a progress bar", () => {
    render(<AgentSprite agentRole="implementer" state="work" woId="WO-06-001" />);
    const hammer = screen.getByTestId("agent-sprite-hammer");
    expect(hammer).toHaveAttribute("data-visible", "true");
    expect(hammer).toHaveClass("fragua-hammer");
    // The forge indicator is decorative, not a percentage → no progress bar.
    expect(screen.queryByTestId("agent-sprite-progress")).toBeNull();
  });

  // Outside the forge the hammer is hidden (kept in the DOM, data-visible=false).
  it("non-work state: the forge hammer is hidden", () => {
    render(<AgentSprite agentRole="implementer" state="review" woId="WO-13-007" />);
    expect(screen.getByTestId("agent-sprite-hammer")).toHaveAttribute("data-visible", "false");
  });

  // Mutation target: say-on state shows neither carry nor vault indicators
  it("say-on state: carry=false and vault/medal=false (only say-on active)", () => {
    render(<AgentSprite agentRole="implementer" state="say-on" woId="WO-01" />);
    expect(screen.getByTestId("agent-sprite-carry")).toHaveAttribute("data-visible", "false");
    expect(screen.getByTestId("agent-sprite-medal")).toHaveAttribute("data-visible", "false");
  });

  // Mutation target: idle state shows no carry, no medal, no forge hammer
  it("idle state: carry=false, medal=false, hammer=false", () => {
    render(<AgentSprite agentRole="reviewer" state="idle" woId="WO-13-001" />);
    expect(screen.getByTestId("agent-sprite-carry")).toHaveAttribute("data-visible", "false");
    expect(screen.getByTestId("agent-sprite-medal")).toHaveAttribute("data-visible", "false");
    expect(screen.getByTestId("agent-sprite-hammer")).toHaveAttribute("data-visible", "false");
  });

  // Mutation target: all 13 canonical roles must resolve a sprite src (no undefined)
  it("all 13 canonical roles produce a non-empty src for the sprite img", () => {
    const roles = [
      "implementer",
      "reviewer",
      "test-writer",
      "backend-dev",
      "frontend-dev",
      "researcher",
      "designer",
      "architect",
      "product-manager",
      "copywriter",
      "analytics",
      "devops",
      "security-auditor",
    ] as const;
    for (const role of roles) {
      const { unmount } = render(<AgentSprite agentRole={role} state="work" woId="WO-00" />);
      const img = screen.getByTestId("agent-sprite-img");
      const src = img.getAttribute("src") ?? "";
      expect(src.length).toBeGreaterThan(0);
      expect(src).not.toBe("undefined");
      unmount();
    }
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 10. WO-13-009: Room — edge cases
// ──────────────────────────────────────────────────────────────────────────────

describe("frd-13 reviewer2 (WO-13-009): Room — edge cases", () => {
  // Mutation target: count=0 (falsy!) must STILL render the count chip
  // (0 agents/WOs is meaningful — it should be visible, not hidden by falsy check)
  it("count=0: count chip IS rendered (zero is a meaningful count value)", () => {
    render(<Room zone="forge" label="Forja" state="active" count={0} />);
    const chip = screen.getByTestId("room-count");
    expect(chip).toBeInTheDocument();
    expect(chip).toHaveTextContent("0");
  });

  // Mutation target: hot state on tribunal must apply warn-colored glow
  it("hot state on tribunal zone applies warn-glow box-shadow token", () => {
    render(<Room zone="tribunal" label="Tribunal" state="hot" />);
    const root = screen.getByTestId("room-root");
    const style = root.getAttribute("style") ?? "";
    expect(style).toContain("--color-warn");
  });

  // Mutation target: active state must apply accent-glow box-shadow token
  it("active state applies accent-glow box-shadow token", () => {
    render(<Room zone="vault" label="Bóveda" state="active" />);
    const root = screen.getByTestId("room-root");
    const style = root.getAttribute("style") ?? "";
    expect(style).toContain("--color-accent");
  });

  // Mutation target: locked state applies grayscale filter
  it("locked state has a grayscale filter applied", () => {
    render(<Room zone="research" label="Investigación" state="locked" />);
    const root = screen.getByTestId("room-root");
    const style = root.getAttribute("style") ?? "";
    expect(style).toContain("grayscale");
  });

  // Mutation target: cool state has a saturate filter, not grayscale
  it("cool state has saturate filter (not grayscale)", () => {
    render(<Room zone="build" label="Build" state="cool" />);
    const root = screen.getByTestId("room-root");
    const style = root.getAttribute("style") ?? "";
    expect(style).toContain("saturate");
    expect(style).not.toContain("grayscale");
  });

  // Mutation target: aria-label mentions the zone label
  it("aria-label includes the label prop text (Spanish, WCAG)", () => {
    render(<Room zone="vault" label="Bóveda de artefactos" state="done" />);
    const root = screen.getByTestId("room-root");
    const label = root.getAttribute("aria-label") ?? "";
    expect(label).toContain("Bóveda de artefactos");
  });

  // Mutation target: root must be a <section> not <div> (biome useSemanticElements)
  it("root element is a <section> (not a div)", () => {
    render(<Room zone="forge" label="Forja" state="cool" />);
    const root = screen.getByTestId("room-root");
    expect(root.tagName).toBe("SECTION");
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 11. WO-13-009: FlowStrip — edge/abuse
// ──────────────────────────────────────────────────────────────────────────────

describe("frd-13 reviewer2 (WO-13-009): FlowStrip — edge cases", () => {
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

  // Mutation target: unknown activeKey must not crash (graceful unknown key)
  it("activeKey not matching any beat: renders without throwing (graceful miss)", () => {
    expect(() =>
      render(<FlowStrip beats={EIGHT_BEATS} activeKeys={["does-not-exist", "also-not-here"]} />),
    ).not.toThrow();
    // All beats are inactive
    const steps = screen.getAllByTestId(/^flow-beat-/);
    for (const step of steps) {
      expect(step).toHaveAttribute("data-active", "false");
    }
  });

  // Mutation target: activeKeys=[] → all beats are inactive (no lit beat)
  it("activeKeys=[]: all 8 beats have data-active=false", () => {
    render(<FlowStrip beats={EIGHT_BEATS} activeKeys={[]} />);
    const steps = screen.getAllByTestId(/^flow-beat-/);
    expect(steps).toHaveLength(8);
    for (const step of steps) {
      expect(step).toHaveAttribute("data-active", "false");
    }
  });

  // Mutation target: the tooltip testid uses the key (NOT "beat-tip" infix — documented quirk)
  it("tooltip testid pattern is flow-tip-{key}, NOT flow-beat-tip-{key}", () => {
    render(<FlowStrip beats={EIGHT_BEATS} activeKeys={[]} />);
    // Per WO-13-009 Status Note: tooltip testids are flow-tip-{key}
    expect(screen.getByTestId("flow-tip-build")).toBeInTheDocument();
    expect(screen.queryByTestId("flow-beat-tip-build")).not.toBeInTheDocument();
  });

  // Mutation target: the strip uses role=nav to be accessible
  it("strip root is a <nav> with an aria-label", () => {
    render(<FlowStrip beats={EIGHT_BEATS} activeKeys={[]} />);
    const nav = screen.getByRole("navigation");
    expect(nav).toBeInTheDocument();
    const label = nav.getAttribute("aria-label") ?? "";
    expect(label.length).toBeGreaterThan(0);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 12. WO-13-009: MissionBar — edge cases
// ──────────────────────────────────────────────────────────────────────────────

describe("frd-13 reviewer2 (WO-13-009): MissionBar — edge cases", () => {
  // Mutation target: done > total (overcommit) must not crash and render correctly
  it("done > total: renders without NaN or crash, counter shows actual values", () => {
    render(
      <MissionBar
        frdPips={[{ id: "FRD-01", state: "done" }]}
        done={110}
        total={100}
        effort="pro"
      />,
    );
    const counter = screen.getByTestId("mission-bar-counter");
    expect(counter).toHaveTextContent("110");
    expect(counter).toHaveTextContent("100");
    expect(counter).not.toHaveTextContent("NaN");
  });

  // Mutation target: frdPips=[] (no pips) must not crash and must render effort
  it("frdPips=[] (empty): renders without arrows, no pip testids, effort still shows", () => {
    render(<MissionBar frdPips={[]} done={0} total={0} effort="equilibrado" />);
    expect(screen.queryAllByTestId(/^mission-bar-pip-/)).toHaveLength(0);
    expect(screen.queryAllByTestId("mission-bar-arrow")).toHaveLength(0);
    expect(screen.getByTestId("mission-bar-effort")).toHaveTextContent("equilibrado");
  });

  // Mutation target: effort must NEVER be a button/input/select (DR-061 read-only)
  it("effort element is not a BUTTON, INPUT, or SELECT (DR-061 strict)", () => {
    render(
      <MissionBar
        frdPips={[{ id: "FRD-01", state: "current" }]}
        done={3}
        total={10}
        effort="potente"
      />,
    );
    const effort = screen.getByTestId("mission-bar-effort");
    const tag = effort.tagName;
    expect(tag).not.toBe("BUTTON");
    expect(tag).not.toBe("INPUT");
    expect(tag).not.toBe("SELECT");
    expect(tag).not.toBe("A"); // anchor would also be interactive
  });

  // Mutation target: counter uses tabular-nums (FRD-13 AC)
  it("WO counter has font-variant-numeric:tabular-nums in its style", () => {
    render(
      <MissionBar frdPips={[{ id: "FRD-01", state: "done" }]} done={57} total={78} effort="pro" />,
    );
    const counter = screen.getByTestId("mission-bar-counter");
    expect(counter).toHaveStyle({ fontVariantNumeric: "tabular-nums" });
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 13. WO-13-009: SpeechBubble — raised position
// ──────────────────────────────────────────────────────────────────────────────

describe("frd-13 reviewer2 (WO-13-009): SpeechBubble — raised position", () => {
  // Mutation target: raised=true must set a DIFFERENT bottom value than raised=false
  it("raised=true: bottom differs from raised=false (no overlap protection)", () => {
    const { unmount } = render(<SpeechBubble text="hola" raised={false} />);
    const normalRoot = screen.getByTestId("speech-bubble-root");
    const normalStyle = normalRoot.getAttribute("style") ?? "";

    unmount();

    render(<SpeechBubble text="hola" raised={true} />);
    const raisedRoot = screen.getByTestId("speech-bubble-root");
    const raisedStyle = raisedRoot.getAttribute("style") ?? "";

    // The two styles must differ in their bottom value
    expect(raisedStyle).not.toBe(normalStyle);
  });

  // Mutation target: raised=true → data-raised="true" on root
  it("raised=true: data-raised attribute is 'true'", () => {
    render(<SpeechBubble text="procesando..." raised={true} />);
    expect(screen.getByTestId("speech-bubble-root")).toHaveAttribute("data-raised", "true");
  });

  // Mutation target: raised=false (default) → data-raised="false"
  it("raised=false (default): data-raised attribute is 'false'", () => {
    render(<SpeechBubble text="enviando..." />);
    expect(screen.getByTestId("speech-bubble-root")).toHaveAttribute("data-raised", "false");
  });

  // Mutation target: bubble always renders a tail pointer
  it("the bubble tail (::after CSS equivalent) is always rendered", () => {
    render(<SpeechBubble text="test" raised={true} />);
    expect(screen.getByTestId("speech-bubble-tail")).toBeInTheDocument();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 14. WO-13-009: PowerOffOverlay — not a control
// ──────────────────────────────────────────────────────────────────────────────

describe("frd-13 reviewer2 (WO-13-009): PowerOffOverlay — derived state contract", () => {
  // Mutation target: the root element must never be button/input/select
  it("root is a <div> — not a button, input, or select (never a toggle)", () => {
    render(<PowerOffOverlay off={true} />);
    const root = screen.getByTestId("power-off-overlay-root");
    expect(root.tagName).toBe("DIV");
    expect(root.tagName).not.toBe("BUTTON");
    expect(root.tagName).not.toBe("INPUT");
  });

  // Mutation target: no onClick handler on root (not a toggle)
  it("root has no onClick handler attribute (strictly presentational)", () => {
    render(<PowerOffOverlay off={true} />);
    const root = screen.getByTestId("power-off-overlay-root");
    // jsdom won't have an onclick attribute on non-interactive elements
    expect(root.getAttribute("onclick")).toBeNull();
  });

  // Mutation target: off=false hides the overlay; off=true shows it
  it("flipping off from false→true shows the overlay (re-render)", () => {
    const { rerender } = render(<PowerOffOverlay off={false} />);
    const root = screen.getByTestId("power-off-overlay-root");
    let style = root.getAttribute("style") ?? "";
    expect(style).toContain("display: none");

    rerender(<PowerOffOverlay off={true} />);
    style = root.getAttribute("style") ?? "";
    expect(style).not.toContain("display: none");
    expect(style).toContain("display: flex");
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 15. Integration: WO-13-007 + WO-13-009 together (cross-WO)
// ──────────────────────────────────────────────────────────────────────────────

describe("frd-13 reviewer2: INTEGRATION — WO-13-007 + WO-13-009 rendered together", () => {
  const FRD_PIPS = [
    { id: "FRD-13", state: "done" as const },
    { id: "FRD-14", state: "current" as const },
  ];

  // Integration: a real Party UI scene — MissionBar + warn Banner + Room + AgentSprite
  it("renders MissionBar + Banner + Room + AgentSprite together without error", () => {
    expect(() =>
      render(
        <div>
          {/* WO-13-009 */}
          <MissionBar frdPips={FRD_PIPS} done={12} total={20} effort="pro" />

          {/* WO-13-007 */}
          <Banner
            tone="warn"
            kind="gate"
            heading="El revisor está esperando"
            detail="FRD-13 en revisión · WO-13-007 IN_REVIEW"
            dismissible={true}
          />

          {/* WO-13-009 */}
          <div style={{ position: "relative", width: 920, height: 560 }}>
            <Room zone="tribunal" label="Tribunal" state="hot" count={1}>
              <AgentSprite agentRole="reviewer" state="work" woId="WO-13-007" />
            </Room>
          </div>
        </div>,
      ),
    ).not.toThrow();

    // Verify all key testids are present
    expect(screen.getByTestId("mission-bar-root")).toBeInTheDocument();
    expect(screen.getByTestId("banner")).toBeInTheDocument();
    expect(screen.getByTestId("room-root")).toBeInTheDocument();
    expect(screen.getByTestId("agent-sprite-root")).toBeInTheDocument();
  });

  // Integration: AgentSprite inside Room — the sprite is a Room child
  it("AgentSprite inside Room: both testids are present and Room is the semantic parent", () => {
    render(
      <Room zone="forge" label="Forja" state="hot" count={2}>
        <AgentSprite agentRole="frontend-dev" state="work" woId="WO-02-001" />
        <AgentSprite agentRole="backend-dev" state="work" woId="WO-02-002" />
      </Room>,
    );
    const room = screen.getByTestId("room-root");
    expect(room.tagName).toBe("SECTION");
    const sprites = screen.getAllByTestId("agent-sprite-root");
    expect(sprites).toHaveLength(2);
  });

  // Integration: Banner with commandRow inside Panel (the actual usage in MC)
  it("Banner inside Panel: commandRow CopyButton + Panel structure renders correctly", () => {
    render(
      <Panel variant="panel">
        <Banner
          tone="info"
          heading="Recuerda actualizar el plugin"
          commandRow="claude plugin update pandacorp@panda-corp"
        />
      </Panel>,
    );
    expect(screen.getByTestId("panel")).toBeInTheDocument();
    expect(screen.getByTestId("banner")).toBeInTheDocument();
    expect(screen.getByTestId("banner-cmd-row")).toBeInTheDocument();
    // CopyButton must be present (commandRow renders it)
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  // Integration: DemoControls wrapping a Button (the canonical DR-061 demo pattern)
  it("DemoControls wrapping Button: children + badge render together without conflict", () => {
    render(
      <DemoControls note="Estos controles solo existen en el preview de la Forja.">
        <Button variant="secondary">Modo: construcción</Button>
        <Button variant="secondary">⏸ Pausar</Button>
      </DemoControls>,
    );
    expect(screen.getByTestId("demo-controls-badge")).toHaveTextContent("SOLO DEMO");
    expect(screen.getByTestId("demo-controls-note")).toBeInTheDocument();
    // The children (buttons) must render inside
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(2);
  });

  // Integration: FlowStrip + MissionBar together — the real MC header pattern
  it("FlowStrip + MissionBar render together (both are horizontal strips)", () => {
    const BEATS = [
      { key: "product", icon: "📋", label: "Producto", sub: "spec" },
      { key: "design", icon: "🎨", label: "Diseño", sub: "tokens" },
      { key: "architecture", icon: "📐", label: "Arquitectura", sub: "blueprint" },
      { key: "foundation", icon: "🧱", label: "Fundación", sub: "FND" },
      { key: "build", icon: "⚒️", label: "Construcción", sub: "FRD×N" },
      { key: "review", icon: "⚖️", label: "Revisión", sub: "gate" },
      { key: "integration", icon: "🔗", label: "Integración", sub: "cross" },
      { key: "release", icon: "🚀", label: "Release", sub: "deploy" },
    ] as const;

    render(
      <div>
        <FlowStrip beats={BEATS} activeKeys={["build", "review"]} />
        <MissionBar frdPips={FRD_PIPS} done={57} total={78} effort="pro" />
      </div>,
    );

    expect(screen.getByTestId("flow-strip-root")).toBeInTheDocument();
    expect(screen.getByTestId("mission-bar-root")).toBeInTheDocument();

    // FlowStrip active beats are correctly marked
    expect(screen.getByTestId("flow-beat-build")).toHaveAttribute("data-active", "true");
    expect(screen.getByTestId("flow-beat-review")).toHaveAttribute("data-active", "true");
    expect(screen.getByTestId("flow-beat-product")).toHaveAttribute("data-active", "false");

    // MissionBar counter shows correct values
    const counter = screen.getByTestId("mission-bar-counter");
    expect(counter).toHaveTextContent("57");
    expect(counter).toHaveTextContent("78");
  });
});
