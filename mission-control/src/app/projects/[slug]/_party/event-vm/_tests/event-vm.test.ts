/**
 * WO-06-001 — Iconic event vocabulary + event view-model mapper (Wave 2 — La Fragua redesign).
 *
 * Tests for the pure `toEventVM` mapper and the `EVENT_ICON` vocabulary constant.
 *
 * Traceability:
 *   AC-06-011.1 — bitácora: bounded vocabulary, role color, tabular-nums timestamp, failure first-class
 *   AC-06-010.3 — multi-project: project-color border + role-color border
 *   AC-06-012.1 — fixed bounded iconic vocabulary (~12 event types) [existing tests kept]
 *   AC-06-013.1 — failure is a first-class state (isFailure flag) [existing tests kept]
 *
 * Wave 2 additions (La Fragua redesign):
 *   - EventType includes `contract` and `gate` (engine lines)
 *   - roleColorKey derived from event.role (not event.agent)
 *   - EventVM exposes wo and frd fields
 *   - Spanish labels for handoff / contract / gate
 *
 * Dependencies:
 *   IF-01-readEvents (lib/events.ts) — the `Event` type consumed as `DashboardEvent`.
 *   IF-13-agent-colors (app/_design/tokens.ts) — AGENT_COLOR record.
 *
 * Pure module — no I/O, no DOM.
 * Stack: Vitest.
 */

import { describe, expect, it } from "vitest";

import type { Event as DashboardEvent } from "@/lib/events/events";
import { EVENT_ICON, type EventType, toEventVM } from "../event-vm";

// ---------------------------------------------------------------------------
// Wave 2 (La Fragua redesign) — new EventType members: contract + gate
// ---------------------------------------------------------------------------

describe("frd-06 Wave 2: EVENT_ICON — contract and gate in bounded vocabulary", () => {
  it("frd-06: EVENT_ICON has an entry for 'contract'", () => {
    expect(EVENT_ICON).toHaveProperty("contract");
    expect(typeof (EVENT_ICON as Record<string, string>)["contract"]).toBe("string");
    expect(((EVENT_ICON as Record<string, string>)["contract"] as string).length).toBeGreaterThan(
      0,
    );
  });

  it("frd-06: EVENT_ICON has an entry for 'gate'", () => {
    expect(EVENT_ICON).toHaveProperty("gate");
    expect(typeof (EVENT_ICON as Record<string, string>)["gate"]).toBe("string");
    expect(((EVENT_ICON as Record<string, string>)["gate"] as string).length).toBeGreaterThan(0);
  });
});

describe("frd-06 Wave 2: toEventVM — icon mapping for contract and gate", () => {
  it("frd-06: WHEN event type is 'contract' THEN icon is set from EVENT_ICON.contract", () => {
    const ev: DashboardEvent = { event: "contract", at: "2026-06-18T10:00:00Z" };
    const vm = toEventVM(ev);
    expect(vm.icon).toBe((EVENT_ICON as Record<string, string>)["contract"]);
  });

  it("frd-06: WHEN event type is 'gate' THEN icon is set from EVENT_ICON.gate", () => {
    const ev: DashboardEvent = { event: "gate", at: "2026-06-18T10:00:00Z" };
    const vm = toEventVM(ev);
    expect(vm.icon).toBe((EVENT_ICON as Record<string, string>)["gate"]);
  });
});

// ---------------------------------------------------------------------------
// Wave 2 — roleColorKey derived from event.role (not event.agent)
// ---------------------------------------------------------------------------

describe("frd-06 Wave 2: toEventVM — roleColorKey (AC-06-011.1)", () => {
  it("frd-06: WHEN event has a role field THEN vm.roleColorKey is a non-empty CSS variable string", () => {
    const ev: DashboardEvent = {
      event: "start",
      at: "2026-06-18T10:00:00Z",
      role: "implementer",
    };
    const vm = toEventVM(ev);
    expect(typeof vm.roleColorKey).toBe("string");
    expect((vm.roleColorKey as string).startsWith("--color-agent-")).toBe(true);
  });

  it("frd-06: WHEN event.role is 'implementer' THEN roleColorKey is '--color-agent-implementer'", () => {
    const ev: DashboardEvent = {
      event: "start",
      at: "2026-06-18T10:00:00Z",
      role: "implementer",
    };
    const vm = toEventVM(ev);
    expect(vm.roleColorKey).toBe("--color-agent-implementer");
  });

  it("frd-06: WHEN event.role is 'reviewer' THEN roleColorKey is '--color-agent-reviewer'", () => {
    const ev: DashboardEvent = {
      event: "gate",
      at: "2026-06-18T10:00:00Z",
      role: "reviewer",
    };
    const vm = toEventVM(ev);
    expect(vm.roleColorKey).toBe("--color-agent-reviewer");
  });

  it("frd-06: WHEN event.role is 'test-writer' THEN roleColorKey is '--color-agent-test-writer'", () => {
    const ev: DashboardEvent = {
      event: "test_ok",
      at: "2026-06-18T10:00:00Z",
      role: "test-writer",
    };
    const vm = toEventVM(ev);
    expect(vm.roleColorKey).toBe("--color-agent-test-writer");
  });

  it("frd-06: WHEN event has no role field THEN vm.roleColorKey is undefined", () => {
    const ev: DashboardEvent = { event: "start", at: "2026-06-18T10:00:00Z" };
    const vm = toEventVM(ev);
    expect(vm.roleColorKey).toBeUndefined();
  });

  it("frd-06: WHEN event.role is an unknown role THEN roleColorKey falls back to a generic CSS var", () => {
    const ev: DashboardEvent = {
      event: "start",
      at: "2026-06-18T10:00:00Z",
      role: "some-unknown-role",
    };
    const vm = toEventVM(ev);
    expect(typeof vm.roleColorKey).toBe("string");
    expect((vm.roleColorKey as string).startsWith("--color-agent-")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Wave 2 — wo and frd fields in EventVM (from lib/events enriched fields)
// ---------------------------------------------------------------------------

describe("frd-06 Wave 2: toEventVM — wo and frd fields in EventVM", () => {
  it("frd-06: WHEN event has a frd field THEN vm.frd equals event.frd", () => {
    const ev: DashboardEvent = {
      event: "start",
      at: "2026-06-18T10:00:00Z",
      frd: "frd-06-party",
    };
    const vm = toEventVM(ev);
    expect(vm.frd).toBe("frd-06-party");
  });

  it("frd-06: WHEN event has no frd field THEN vm.frd is undefined", () => {
    const ev: DashboardEvent = { event: "start", at: "2026-06-18T10:00:00Z" };
    const vm = toEventVM(ev);
    expect(vm.frd).toBeUndefined();
  });

  it("frd-06: WHEN event has a workOrder field THEN vm.wo equals event.workOrder", () => {
    const ev: DashboardEvent = {
      event: "handoff",
      at: "2026-06-18T10:00:00Z",
      workOrder: "WO-06-001",
    };
    const vm = toEventVM(ev);
    expect(vm.wo).toBe("WO-06-001");
  });

  it("frd-06: WHEN event has no workOrder field THEN vm.wo is undefined", () => {
    const ev: DashboardEvent = { event: "handoff", at: "2026-06-18T10:00:00Z" };
    const vm = toEventVM(ev);
    expect(vm.wo).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Wave 2 — Spanish labels for handoff, contract, gate
// ---------------------------------------------------------------------------

describe("frd-06 Wave 2: toEventVM — Spanish labels for engine lines", () => {
  it("frd-06: WHEN event type is 'handoff' THEN label contains 'nota de estado'", () => {
    const ev: DashboardEvent = { event: "handoff", at: "2026-06-18T10:00:00Z" };
    const vm = toEventVM(ev);
    expect(vm.label.toLowerCase()).toContain("nota de estado");
  });

  it("frd-06: WHEN event type is 'contract' THEN label contains 'contrato'", () => {
    const ev: DashboardEvent = { event: "contract", at: "2026-06-18T10:00:00Z" };
    const vm = toEventVM(ev);
    expect(vm.label.toLowerCase()).toContain("contrato");
  });

  it("frd-06: WHEN event type is 'gate' THEN label contains 'tribunal'", () => {
    const ev: DashboardEvent = { event: "gate", at: "2026-06-18T10:00:00Z" };
    const vm = toEventVM(ev);
    expect(vm.label.toLowerCase()).toContain("tribunal");
  });

  it("frd-06: label for handoff is a non-empty Spanish string", () => {
    const ev: DashboardEvent = { event: "handoff", at: "2026-06-18T10:00:00Z" };
    const vm = toEventVM(ev);
    expect(vm.label.length).toBeGreaterThan(0);
  });

  it("frd-06: label for contract is a non-empty Spanish string", () => {
    const ev: DashboardEvent = { event: "contract", at: "2026-06-18T10:00:00Z" };
    const vm = toEventVM(ev);
    expect(vm.label.length).toBeGreaterThan(0);
  });

  it("frd-06: label for gate is a non-empty Spanish string", () => {
    const ev: DashboardEvent = { event: "gate", at: "2026-06-18T10:00:00Z" };
    const vm = toEventVM(ev);
    expect(vm.label.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Wave 2 — AC-06-010.3: multi-project color (projectColorKey without role)
// ---------------------------------------------------------------------------

describe("frd-06 Wave 2: toEventVM — multi-project color (AC-06-010.3)", () => {
  it("frd-06: WHEN event has both role and project THEN both roleColorKey and projectColorKey are set", () => {
    const ev: DashboardEvent = {
      event: "write",
      at: "2026-06-18T10:00:00Z",
      role: "implementer",
      project: "proj-a",
    };
    const vm = toEventVM(ev);
    expect(vm.roleColorKey).toBeDefined();
    expect(vm.projectColorKey).toBeDefined();
  });

  it("frd-06: WHEN event has project but no role THEN projectColorKey is set and roleColorKey is undefined", () => {
    const ev: DashboardEvent = {
      event: "write",
      at: "2026-06-18T10:00:00Z",
      project: "proj-a",
    };
    const vm = toEventVM(ev);
    expect(vm.projectColorKey).toBeDefined();
    expect(vm.roleColorKey).toBeUndefined();
  });

  it("frd-06: WHEN event has role but no project THEN roleColorKey is set and projectColorKey is undefined", () => {
    const ev: DashboardEvent = {
      event: "start",
      at: "2026-06-18T10:00:00Z",
      role: "implementer",
    };
    const vm = toEventVM(ev);
    expect(vm.roleColorKey).toBeDefined();
    expect(vm.projectColorKey).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Wave 2 — idempotency with enriched fields
// ---------------------------------------------------------------------------

describe("frd-06 Wave 2: toEventVM — idempotency with enriched fields", () => {
  it("frd-06: WHEN toEventVM is called twice with enriched event THEN both results are equal", () => {
    const ev: DashboardEvent = {
      event: "handoff",
      at: "2026-06-18T10:00:00Z",
      role: "implementer",
      project: "proj-a",
      frd: "frd-06-party",
      workOrder: "WO-06-001",
      status: "ok",
    };
    const vm1 = toEventVM(ev);
    const vm2 = toEventVM(ev);
    expect(vm1).toEqual(vm2);
  });
});

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
// AC-06-011.1 — roleColorKey derived from role; projectColorKey when project present
// (Wave 2: renamed from agentColorKey; now driven by event.role, not event.agent)
// ---------------------------------------------------------------------------

describe("frd-06: toEventVM — role and project color keys (AC-06-011.1)", () => {
  it("frd-06: WHEN event has a role field THEN vm.roleColorKey is a non-empty CSS variable string", () => {
    const ev: DashboardEvent = {
      event: "start",
      at: "2026-06-15T10:00:00Z",
      role: "frontend-dev",
    };
    const vm = toEventVM(ev);
    expect(typeof vm.roleColorKey).toBe("string");
    expect(vm.roleColorKey).toContain("--color-agent-");
  });

  it("frd-06: WHEN event has no role field THEN vm.roleColorKey is undefined", () => {
    const ev: DashboardEvent = { event: "start", at: "2026-06-15T10:00:00Z" };
    const vm = toEventVM(ev);
    expect(vm.roleColorKey).toBeUndefined();
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
      role: "backend-dev",
      project: "proj-a",
      status: "ok",
    };
    const vm1 = toEventVM(ev);
    const vm2 = toEventVM(ev);
    expect(vm1).toEqual(vm2);
  });
});
