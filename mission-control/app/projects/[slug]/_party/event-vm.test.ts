/**
 * WO-06-001 — Iconic event vocabulary + event view-model mapper — RED phase.
 *
 * Tests for the pure `toEventVM` mapper and the `EVENT_ICON` vocabulary constant.
 *
 * Traceability:
 *   AC-06-012.1 — fixed bounded iconic vocabulary (~12 event types)
 *   AC-06-013.1 — failure is a first-class state (isFailure flag, danger treatment)
 *   AC-06-011.1 — each agent has a fixed color; multi-project → projectColorKey set
 *
 * Dependencies:
 *   IF-01-readEvents (lib/events.ts) — the `Event` type consumed as `DashboardEvent`.
 *   IF-13-agent-colors (app/_design/tokens.ts) — AGENT_COLOR record.
 *
 * Pure module — no I/O, no DOM.
 * Stack: Vitest.
 */

import { describe, expect, it } from "vitest";

import type { Event as DashboardEvent } from "@/lib/events";
import { EVENT_ICON, type EventType, toEventVM } from "./event-vm";

// ---------------------------------------------------------------------------
// AC-06-012.1 — EVENT_ICON covers the full bounded vocabulary
// ---------------------------------------------------------------------------

describe("frd-06: EVENT_ICON — bounded vocabulary (AC-06-012.1)", () => {
  const REQUIRED_TYPES: EventType[] = [
    "read",
    "write",
    "edit",
    "test_ok",
    "test_fail",
    "message",
    "start",
    "end",
    "handoff",
    "blocked",
    "review",
    "achievement",
  ];

  it("frd-06: EVENT_ICON covers all ~12 required event types", () => {
    for (const type of REQUIRED_TYPES) {
      expect(EVENT_ICON).toHaveProperty(type);
    }
  });

  it("frd-06: every EVENT_ICON entry is a non-empty string", () => {
    for (const [_key, icon] of Object.entries(EVENT_ICON)) {
      expect(typeof icon).toBe("string");
      expect((icon as string).length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// AC-06-012.1 — toEventVM maps event type to an icon
// ---------------------------------------------------------------------------

describe("frd-06: toEventVM — icon mapping (AC-06-012.1)", () => {
  it("frd-06: WHEN event type is 'start' THEN icon is set from EVENT_ICON", () => {
    const ev: DashboardEvent = { event: "start", at: "2026-06-15T10:00:00Z" };
    const vm = toEventVM(ev);
    expect(vm.icon).toBe(EVENT_ICON.start);
  });

  it("frd-06: WHEN event type is 'end' THEN icon is set from EVENT_ICON", () => {
    const ev: DashboardEvent = { event: "end", at: "2026-06-15T10:00:00Z" };
    const vm = toEventVM(ev);
    expect(vm.icon).toBe(EVENT_ICON.end);
  });

  it("frd-06: WHEN event type is 'test_ok' THEN icon maps to test_ok icon", () => {
    const ev: DashboardEvent = { event: "test_ok", at: "2026-06-15T10:00:00Z" };
    const vm = toEventVM(ev);
    expect(vm.icon).toBe(EVENT_ICON.test_ok);
  });

  it("frd-06: WHEN event type is 'test_fail' THEN icon maps to test_fail icon", () => {
    const ev: DashboardEvent = { event: "test_fail", at: "2026-06-15T10:00:00Z" };
    const vm = toEventVM(ev);
    expect(vm.icon).toBe(EVENT_ICON.test_fail);
  });

  it("frd-06: WHEN event type is unknown THEN a fallback icon is returned (no throw)", () => {
    const ev: DashboardEvent = { event: "UnknownEventType", at: "2026-06-15T10:00:00Z" };
    expect(() => toEventVM(ev)).not.toThrow();
    const vm = toEventVM(ev);
    expect(typeof vm.icon).toBe("string");
    expect(vm.icon.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// AC-06-012.1 — tool becomes toolIcon when present
// ---------------------------------------------------------------------------

describe("frd-06: toEventVM — toolIcon when tool present (AC-06-012.1)", () => {
  it("frd-06: WHEN event has a tool field THEN vm.toolIcon is set to a non-empty string", () => {
    const ev: DashboardEvent = {
      event: "write",
      at: "2026-06-15T10:00:00Z",
      tool: "Write",
    };
    const vm = toEventVM(ev);
    expect(typeof vm.toolIcon).toBe("string");
    expect((vm.toolIcon as string).length).toBeGreaterThan(0);
  });

  it("frd-06: WHEN event has no tool field THEN vm.toolIcon is undefined", () => {
    const ev: DashboardEvent = { event: "start", at: "2026-06-15T10:00:00Z" };
    const vm = toEventVM(ev);
    expect(vm.toolIcon).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// AC-06-013.1 — isFailure is a first-class state (never hidden)
// ---------------------------------------------------------------------------

describe("frd-06: toEventVM — isFailure first-class state (AC-06-013.1)", () => {
  it("frd-06: WHEN event.status is 'fail' THEN vm.isFailure is true", () => {
    const ev: DashboardEvent = {
      event: "write",
      at: "2026-06-15T10:00:00Z",
      status: "fail",
    };
    const vm = toEventVM(ev);
    expect(vm.isFailure).toBe(true);
  });

  it("frd-06: WHEN event.event is 'test_fail' THEN vm.isFailure is true", () => {
    const ev: DashboardEvent = { event: "test_fail", at: "2026-06-15T10:00:00Z" };
    const vm = toEventVM(ev);
    expect(vm.isFailure).toBe(true);
  });

  it("frd-06: WHEN event.status is 'ok' THEN vm.isFailure is false", () => {
    const ev: DashboardEvent = {
      event: "write",
      at: "2026-06-15T10:00:00Z",
      status: "ok",
    };
    const vm = toEventVM(ev);
    expect(vm.isFailure).toBe(false);
  });

  it("frd-06: WHEN event has no status THEN vm.isFailure is false", () => {
    const ev: DashboardEvent = { event: "start", at: "2026-06-15T10:00:00Z" };
    const vm = toEventVM(ev);
    expect(vm.isFailure).toBe(false);
  });

  it("frd-06: failure event is never hidden — isFailure property always present", () => {
    const ev: DashboardEvent = {
      event: "test_fail",
      at: "2026-06-15T10:00:00Z",
      status: "fail",
    };
    const vm = toEventVM(ev);
    expect("isFailure" in vm).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AC-06-011.1 — agentColorKey derived from agent; projectColorKey when project present
// ---------------------------------------------------------------------------

describe("frd-06: toEventVM — agent and project color keys (AC-06-011.1)", () => {
  it("frd-06: WHEN event has an agent field THEN vm.agentColorKey is a non-empty CSS variable string", () => {
    const ev: DashboardEvent = {
      event: "start",
      at: "2026-06-15T10:00:00Z",
      agent: "frontend-dev",
    };
    const vm = toEventVM(ev);
    expect(typeof vm.agentColorKey).toBe("string");
    expect(vm.agentColorKey).toContain("--color-agent-");
  });

  it("frd-06: WHEN event has no agent field THEN vm.agentColorKey is undefined", () => {
    const ev: DashboardEvent = { event: "start", at: "2026-06-15T10:00:00Z" };
    const vm = toEventVM(ev);
    expect(vm.agentColorKey).toBeUndefined();
  });

  it("frd-06: WHEN event has a project field THEN vm.projectColorKey is set", () => {
    const ev: DashboardEvent = {
      event: "write",
      at: "2026-06-15T10:00:00Z",
      project: "proj-a",
    };
    const vm = toEventVM(ev);
    expect(typeof vm.projectColorKey).toBe("string");
    expect((vm.projectColorKey as string).length).toBeGreaterThan(0);
  });

  it("frd-06: WHEN event has no project field THEN vm.projectColorKey is undefined", () => {
    const ev: DashboardEvent = { event: "write", at: "2026-06-15T10:00:00Z" };
    const vm = toEventVM(ev);
    expect(vm.projectColorKey).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// EventVM structure completeness
// ---------------------------------------------------------------------------

describe("frd-06: toEventVM — EventVM structure completeness", () => {
  it("frd-06: vm always has icon, isFailure, label, and at keys", () => {
    const ev: DashboardEvent = {
      event: "start",
      at: "2026-06-15T10:00:00Z",
    };
    const vm = toEventVM(ev);
    expect("icon" in vm).toBe(true);
    expect("isFailure" in vm).toBe(true);
    expect("label" in vm).toBe(true);
    expect("at" in vm).toBe(true);
  });

  it("frd-06: vm.at equals the original event.at timestamp", () => {
    const ev: DashboardEvent = { event: "start", at: "2026-06-16T08:30:00Z" };
    const vm = toEventVM(ev);
    expect(vm.at).toBe("2026-06-16T08:30:00Z");
  });

  it("frd-06: vm.label is a non-empty Spanish string", () => {
    const ev: DashboardEvent = { event: "start", at: "2026-06-15T10:00:00Z" };
    const vm = toEventVM(ev);
    expect(typeof vm.label).toBe("string");
    expect(vm.label.length).toBeGreaterThan(0);
  });

  it("frd-06: vm.workOrder equals event.workOrder when present", () => {
    const ev: DashboardEvent = {
      event: "end",
      at: "2026-06-15T10:00:00Z",
      workOrder: "WO-01-007",
    };
    const vm = toEventVM(ev);
    expect(vm.workOrder).toBe("WO-01-007");
  });

  it("frd-06: vm.workOrder is undefined when event.workOrder is absent", () => {
    const ev: DashboardEvent = { event: "end", at: "2026-06-15T10:00:00Z" };
    const vm = toEventVM(ev);
    expect(vm.workOrder).toBeUndefined();
  });

  it("frd-06: vm.project equals event.project when present", () => {
    const ev: DashboardEvent = {
      event: "write",
      at: "2026-06-15T10:00:00Z",
      project: "mission-control",
    };
    const vm = toEventVM(ev);
    expect(vm.project).toBe("mission-control");
  });
});

// ---------------------------------------------------------------------------
// Idempotency — pure function, no hidden state
// ---------------------------------------------------------------------------

describe("frd-06: toEventVM — idempotency (pure function)", () => {
  it("frd-06: WHEN toEventVM is called twice with the same event THEN both results are equal", () => {
    const ev: DashboardEvent = {
      event: "handoff",
      at: "2026-06-15T10:00:00Z",
      agent: "backend-dev",
      project: "proj-a",
      status: "ok",
    };
    const vm1 = toEventVM(ev);
    const vm2 = toEventVM(ev);
    expect(vm1).toEqual(vm2);
  });
});
