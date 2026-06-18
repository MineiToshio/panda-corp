/**
 * WO-06-007 — EventFeed Wave 3 tests (La Fragua redesign retry)
 *
 * New tests for the WO-06-007 retry requirements:
 *   1. Feed renders handoff / contract / gate rows (new vocabulary lines).
 *   2. Live / No-signal badge in the feed header (folded from WO-06-010).
 *      - Badge reads `live` + `lastEventAt` props.
 *      - Icon + label (NEVER color-only). tabular-nums timestamp.
 *   3. `roleColorKey` correctly wired to `data-role-color` attribute.
 *
 * Traceability:
 *   AC-06-011.1 — bitácora with bounded vocabulary incl. handoff/contract/gate
 *   AC-06-010.3 — multi-project color (covered by existing tests; not re-tested)
 *   WO-06-007 scope (La Fragua redesign wave 3)
 *
 * Stack: Vitest + @testing-library/react + jsdom.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { EventVM } from "../../event-vm/event-vm";
import { EventFeed } from "../EventFeed";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeVM(overrides: Partial<EventVM> = {}): EventVM {
  return {
    icon: "play-circle",
    isFailure: false,
    label: "Inicio",
    at: "2026-06-15T10:00:00Z",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// handoff / contract / gate rows
// ---------------------------------------------------------------------------

describe("frd-06: EventFeed — handoff/contract/gate vocabulary rows (AC-06-011.1 wave 3)", () => {
  it("frd-06: WHEN a handoff event VM renders THEN the row appears with handoff label", () => {
    render(
      <EventFeed
        events={[
          makeVM({
            icon: "arrow-right-circle",
            label: "📜 nota de estado entregada",
            wo: "WO-06-001",
          }),
        ]}
      />,
    );
    const rows = screen.getAllByTestId("event-feed-row");
    expect(rows).toHaveLength(1);
    expect(rows[0]?.textContent).toContain("nota de estado entregada");
  });

  it("frd-06: WHEN a contract event VM renders THEN the row appears with contract label", () => {
    render(
      <EventFeed
        events={[
          makeVM({
            icon: "file-text",
            label: "📄 contrato docs/api.md publicado",
            frd: "frd-06",
          }),
        ]}
      />,
    );
    const rows = screen.getAllByTestId("event-feed-row");
    expect(rows).toHaveLength(1);
    expect(rows[0]?.textContent).toContain("contrato docs/api.md publicado");
  });

  it("frd-06: WHEN a gate event VM renders THEN the row appears with gate label", () => {
    render(
      <EventFeed
        events={[
          makeVM({
            icon: "gavel",
            label: "tribunal del juez abierto",
          }),
        ]}
      />,
    );
    const rows = screen.getAllByTestId("event-feed-row");
    expect(rows).toHaveLength(1);
    expect(rows[0]?.textContent).toContain("tribunal del juez abierto");
  });

  it("frd-06: WHEN handoff + contract + gate rows all present THEN all 3 render (none filtered)", () => {
    render(
      <EventFeed
        events={[
          makeVM({ icon: "arrow-right-circle", label: "📜 nota de estado entregada" }),
          makeVM({ icon: "file-text", label: "📄 contrato docs/api.md publicado" }),
          makeVM({ icon: "gavel", label: "tribunal del juez abierto" }),
        ]}
      />,
    );
    const rows = screen.getAllByTestId("event-feed-row");
    expect(rows).toHaveLength(3);
  });

  it("frd-06: WHEN a handoff row has a wo field THEN the wo id appears in the row", () => {
    render(
      <EventFeed
        events={[
          makeVM({
            icon: "arrow-right-circle",
            label: "📜 nota de estado entregada",
            wo: "WO-06-007",
          }),
        ]}
      />,
    );
    const row = screen.getByTestId("event-feed-row");
    expect(row.textContent).toContain("WO-06-007");
  });
});

// ---------------------------------------------------------------------------
// Live / No-signal badge in the feed header (folded from WO-06-010)
// ---------------------------------------------------------------------------

describe("frd-06: EventFeed — Live/No-signal badge in header (WO-06-007 wave 3)", () => {
  it("frd-06: WHEN live=true THEN feed header renders the live badge with data-testid='event-feed-live-badge'", () => {
    render(<EventFeed events={[makeVM()]} live={true} lastEventAt="2026-06-15T10:00:00Z" />);
    expect(screen.getByTestId("event-feed-live-badge")).toBeDefined();
  });

  it("frd-06: WHEN live=false THEN feed header renders the no-signal badge with data-testid='event-feed-no-signal-badge'", () => {
    render(<EventFeed events={[makeVM()]} live={false} lastEventAt="2026-06-15T10:00:00Z" />);
    expect(screen.getByTestId("event-feed-no-signal-badge")).toBeDefined();
  });

  it("frd-06: WHEN live=true THEN the badge shows a visible icon AND a label (never color-only)", () => {
    render(<EventFeed events={[makeVM()]} live={true} lastEventAt="2026-06-15T10:00:00Z" />);
    // The badge must have BOTH an icon and a text label (FRD-13: never convey state by color alone)
    const badge = screen.getByTestId("event-feed-live-badge");
    const icon = badge.querySelector("[data-testid='event-feed-badge-icon']");
    const label = badge.querySelector("[data-testid='event-feed-badge-label']");
    expect(icon).toBeDefined();
    expect(label).toBeDefined();
    expect(label?.textContent).toContain("En vivo");
  });

  it("frd-06: WHEN live=false THEN the badge shows icon + 'Sin señal' label", () => {
    render(<EventFeed events={[makeVM()]} live={false} lastEventAt={null} />);
    const badge = screen.getByTestId("event-feed-no-signal-badge");
    const label = badge.querySelector("[data-testid='event-feed-badge-label']");
    expect(label?.textContent).toContain("Sin señal");
  });

  it("frd-06: WHEN live=true and lastEventAt is provided THEN a tabular-nums timestamp appears in the badge", () => {
    render(<EventFeed events={[makeVM()]} live={true} lastEventAt="2026-06-15T10:30:45Z" />);
    const badge = screen.getByTestId("event-feed-live-badge");
    const ts = badge.querySelector("[data-testid='event-feed-badge-timestamp']");
    expect(ts).toBeDefined();
    // Timestamp should contain time digits (HH:MM:SS)
    expect(ts?.textContent).toMatch(/\d{2}:\d{2}:\d{2}/);
  });

  it("frd-06: WHEN live=false and lastEventAt is provided THEN a timestamp still appears (last known)", () => {
    render(<EventFeed events={[makeVM()]} live={false} lastEventAt="2026-06-15T09:00:00Z" />);
    const badge = screen.getByTestId("event-feed-no-signal-badge");
    const ts = badge.querySelector("[data-testid='event-feed-badge-timestamp']");
    expect(ts).toBeDefined();
  });

  it("frd-06: WHEN lastEventAt is null THEN badge renders without crashing and no timestamp element", () => {
    expect(() =>
      render(<EventFeed events={[makeVM()]} live={false} lastEventAt={null} />),
    ).not.toThrow();
    // No timestamp node when lastEventAt is null
    const badge = screen.getByTestId("event-feed-no-signal-badge");
    const ts = badge.querySelector("[data-testid='event-feed-badge-timestamp']");
    expect(ts).toBeNull();
  });

  it("frd-06: WHEN live and lastEventAt are not provided THEN feed renders without badge (backward compat)", () => {
    render(<EventFeed events={[makeVM()]} />);
    // Neither badge should appear when the live props are absent
    expect(screen.queryByTestId("event-feed-live-badge")).toBeNull();
    expect(screen.queryByTestId("event-feed-no-signal-badge")).toBeNull();
  });

  it("frd-06: WHEN live=true THEN the badge element has role='status' for accessibility", () => {
    render(<EventFeed events={[makeVM()]} live={true} lastEventAt="2026-06-15T10:00:00Z" />);
    const badge = screen.getByTestId("event-feed-live-badge");
    expect(badge.getAttribute("role")).toBe("status");
  });

  it("frd-06: WHEN live=false THEN the no-signal badge has role='status' for accessibility", () => {
    render(<EventFeed events={[makeVM()]} live={false} lastEventAt={null} />);
    const badge = screen.getByTestId("event-feed-no-signal-badge");
    expect(badge.getAttribute("role")).toBe("status");
  });

  it("frd-06: WHEN the feed is empty and live=false THEN no-signal badge still renders in header", () => {
    render(<EventFeed events={[]} live={false} lastEventAt={null} />);
    // The empty state should show, AND the no-signal badge in the header
    expect(screen.getByTestId("event-feed-empty")).toBeDefined();
    expect(screen.getByTestId("event-feed-no-signal-badge")).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// roleColorKey wired to data-role-color (wave 3 rename)
// ---------------------------------------------------------------------------

describe("frd-06: EventFeed — data-role-color attribute (WO-06-007 wave 3)", () => {
  it("frd-06: WHEN event has roleColorKey THEN row has data-role-color attribute", () => {
    render(
      <EventFeed
        events={[makeVM({ roleColorKey: "--color-agent-implementer" })]}
        live={false}
        lastEventAt={null}
      />,
    );
    const row = screen.getByTestId("event-feed-row");
    expect(row.getAttribute("data-role-color")).toBe("--color-agent-implementer");
  });

  it("frd-06: WHEN event has no roleColorKey THEN data-role-color is absent", () => {
    render(<EventFeed events={[makeVM()]} live={false} lastEventAt={null} />);
    const row = screen.getByTestId("event-feed-row");
    expect(row.getAttribute("data-role-color")).toBeNull();
  });

  it("frd-06: WHEN event has both roleColorKey and projectColorKey THEN both data-role-color and data-project-color are present", () => {
    render(
      <EventFeed
        events={[
          makeVM({
            roleColorKey: "--color-agent-backend-dev",
            projectColorKey: "--color-project-proj-a",
          }),
        ]}
        live={false}
        lastEventAt={null}
      />,
    );
    const row = screen.getByTestId("event-feed-row");
    expect(row.getAttribute("data-role-color")).toBe("--color-agent-backend-dev");
    expect(row.getAttribute("data-project-color")).toBe("--color-project-proj-a");
  });
});
