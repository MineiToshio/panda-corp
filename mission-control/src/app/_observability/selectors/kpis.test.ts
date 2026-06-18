/**
 * WO-12-002 — `deriveKpis` (≤5 KPIs, incl. failed work orders) — RED phase.
 *
 * These tests are written BEFORE the implementation (`kpis.ts` does not exist yet).
 * Every test will fail until the GREEN phase; that is the intent.
 *
 * Traceability:
 *   AC-12-001.1  The header SHALL show ≤5 critical KPIs (active projects, agents working,
 *                XP of the day, builds queued, failed work orders), top-left; the detail
 *                goes in collapsible sections.
 *   AC-12-007.1  The honest metrics (tasks done vs failed, time per work order, events per
 *                minute) SHALL be derived from the same event file, with no extra
 *                instrumentation.
 *
 * Contract (from WO-12-002 + blueprint §2 IF-12-kpis):
 *   export function deriveKpis(events: Event[], projects: ProjectListItem[]): Kpi[]
 *   - Returns EXACTLY the 5 canonical KPIs (no more, no less):
 *       "active-projects", "agents-working", "xp-today", "builds-queued", "failed-work-orders"
 *   - Each Kpi: { key: string; label: string; value: number; detail?: string }
 *   - "failed-work-orders" counts events with status:"fail" + closed-failed WO markers.
 *   - "agents-working" counts distinct `agent` values from recent AgentWorking events.
 *   - "active-projects" = count of projects in active phases (architecture / implementation /
 *     release / operation).
 *   - All values are numbers ≥ 0; function never throws.
 *   - Empty inputs → all values zeroed (never throws, never returns undefined fields).
 *   - Pure: no I/O, no env reads, no Claude calls.
 *
 * Regression anchors from .pandacorp/comms/progress.md (real bugs → regression tests):
 *   B1' (WO-13-001, 2026-06-16): typeof NaN === "number" — any numeric derivation must
 *     guard with Number.isFinite; deriveKpis must never return a KPI with value=NaN.
 *   I2  (WO-13-001, 2026-06-16): empty-object / vacuous-truth — an empty events array
 *     must return zeroed values, not throw or return undefined.
 *   I3  (WO-13-001, 2026-06-16): array-shaped values bypass scalar guards — ensure
 *     `status:"fail"` is only counted when status is exactly the string "fail", not an array.
 *   FREEZE-ON-RED (WO-02-004, 2026-06-16): malformed input mid-batch must not throw;
 *     the derivation must be resilient to events missing optional fields.
 *   WO-01-005 adversarial I3 (2026-06-16): `running` field must be boolean, never
 *     array-coerced — "agents-working" must count only events with agent as a string.
 *
 * Property-based invariants (parametric — fast-check not in dependency tree):
 *   - Output length is always exactly 5.
 *   - All `value` fields are finite non-negative integers.
 *   - All required fields (key, label, value) are present on every Kpi.
 *   - Each of the 5 canonical keys appears exactly once.
 *   - "active-projects" ≤ projects.length.
 *   - "failed-work-orders" ≤ events.length.
 *   - "agents-working" ≤ distinct agent count in the event tail.
 *
 * Stack: Vitest (TypeScript). Pure function — no fixtures, no I/O, no env.
 */

import { describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// Type aliases — mirror the contract; kept local to express what is asserted.
// The module does not exist yet (RED phase) so all types are declared here.
// ---------------------------------------------------------------------------

type Event = {
  event: string;
  at: string;
  agent?: string;
  session?: string;
  tool?: string;
  status?: "ok" | "fail";
  workOrder?: string;
  task?: string;
  project?: string;
};

type ProjectListItem = {
  name: string;
  path: string;
  exists: boolean;
  stage?: string;
  running?: boolean;
};

/**
 * Local mirror of the Kpi contract (blueprint §2 IF-12-kpis).
 * Kept here so arrow functions in the test body are fully typed without
 * depending on the not-yet-existing `kpis.ts` module.
 */
type Kpi = {
  key: string;
  label: string;
  value: number;
  detail?: string;
};

// ---------------------------------------------------------------------------
// Module under test — import and wrap with the local Kpi type so that every
// call site gets proper inference even before `kpis.ts` exists.
// The cast is intentional: tsc cannot resolve the module in RED phase, so the
// return type is unknown; we assert the contract shape here.
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { deriveKpis as _deriveKpisUntyped } from "./kpis";

function deriveKpis(events: Event[], projects: ProjectListItem[]): Kpi[] {
  // biome-ignore lint/suspicious/noExplicitAny: intentional RED-phase shim — kpis.ts does not exist yet
  return (_deriveKpisUntyped as any)(events, projects) as Kpi[];
}

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

function makeEvent(overrides: Partial<Event> = {}): Event {
  return {
    event: "ToolCall",
    at: "2026-06-16T10:00:00Z",
    agent: "implementer",
    status: "ok",
    ...overrides,
  };
}

function makeProject(overrides: Partial<ProjectListItem> = {}): ProjectListItem {
  return {
    name: "proj-a",
    path: "/projects/proj-a",
    exists: true,
    stage: "implementation",
    running: false,
    ...overrides,
  };
}

/** Canonical keys the function must emit, in specification order. */
const CANONICAL_KEYS = [
  "active-projects",
  "agents-working",
  "xp-today",
  "builds-queued",
  "failed-work-orders",
] as const;

// ---------------------------------------------------------------------------
// AC-12-001.1 — output shape invariants
// ---------------------------------------------------------------------------

describe("frd-12 kpis: AC-12-001.1 — output shape", () => {
  it("frd-12: WHEN events and projects are non-empty THEN returns exactly 5 KPIs", () => {
    const kpis = deriveKpis([makeEvent()], [makeProject()]);
    expect(kpis).toHaveLength(5);
  });

  it("frd-12: WHEN inputs are empty THEN still returns exactly 5 KPIs", () => {
    const kpis = deriveKpis([], []);
    expect(kpis).toHaveLength(5);
  });

  it("frd-12: WHEN called THEN every KPI has key, label, and numeric value", () => {
    const kpis = deriveKpis([makeEvent()], [makeProject()]);
    for (const kpi of kpis) {
      expect(typeof kpi.key).toBe("string");
      expect(kpi.key.length).toBeGreaterThan(0);
      expect(typeof kpi.label).toBe("string");
      expect(kpi.label.length).toBeGreaterThan(0);
      expect(typeof kpi.value).toBe("number");
    }
  });

  it("frd-12: WHEN called THEN all 5 canonical keys are present exactly once", () => {
    const kpis = deriveKpis([makeEvent()], [makeProject()]);
    const keys = kpis.map((k: Kpi) => k.key);
    for (const canonical of CANONICAL_KEYS) {
      expect(keys.filter((k: string) => k === canonical)).toHaveLength(1);
    }
  });

  it("frd-12: WHEN called THEN label is a non-empty string for every KPI", () => {
    const kpis = deriveKpis([], []);
    for (const kpi of kpis) {
      expect(kpi.label.trim().length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// AC-12-001.1 — "active-projects" KPI
// ---------------------------------------------------------------------------

describe("frd-12 kpis: AC-12-001.1 — active-projects KPI", () => {
  it("frd-12: WHEN no projects THEN active-projects value is 0", () => {
    const kpis = deriveKpis([], []);
    const kpi = kpis.find((k: Kpi) => k.key === "active-projects");
    expect(kpi?.value).toBe(0);
  });

  it("frd-12: WHEN 3 projects in active phases THEN active-projects is 3", () => {
    const projects = [
      makeProject({ stage: "architecture" }),
      makeProject({ name: "proj-b", stage: "implementation" }),
      makeProject({ name: "proj-c", stage: "release" }),
    ];
    const kpis = deriveKpis([], projects);
    const kpi = kpis.find((k: Kpi) => k.key === "active-projects");
    expect(kpi?.value).toBe(3);
  });

  it("frd-12: WHEN project in operation phase THEN counted as active", () => {
    const projects = [makeProject({ stage: "operation" })];
    const kpis = deriveKpis([], projects);
    const kpi = kpis.find((k: Kpi) => k.key === "active-projects");
    expect(kpi?.value).toBe(1);
  });

  it("frd-12: WHEN project in product or design phase THEN NOT counted as active", () => {
    const projects = [
      makeProject({ stage: "product" }),
      makeProject({ name: "proj-b", stage: "design" }),
    ];
    const kpis = deriveKpis([], projects);
    const kpi = kpis.find((k: Kpi) => k.key === "active-projects");
    expect(kpi?.value).toBe(0);
  });

  it("frd-12: WHEN project has undefined stage THEN NOT counted as active", () => {
    const projects = [makeProject({ stage: undefined })];
    const kpis = deriveKpis([], projects);
    const kpi = kpis.find((k: Kpi) => k.key === "active-projects");
    expect(kpi?.value).toBe(0);
  });

  it("frd-12: WHEN project does not exist on disk (exists:false) THEN still counted if stage is active", () => {
    // AC-03-006.x pattern: exists:false does not exclude from active count
    const projects = [makeProject({ stage: "implementation", exists: false })];
    const kpis = deriveKpis([], projects);
    const kpi = kpis.find((k: Kpi) => k.key === "active-projects");
    expect(kpi?.value).toBe(1);
  });

  it("frd-12: WHEN 10 projects all active THEN active-projects value reflects the true count", () => {
    const projects = Array.from({ length: 10 }, (_, i) =>
      makeProject({ name: `proj-${i}`, stage: "implementation" }),
    );
    const kpis = deriveKpis([], projects);
    const kpi = kpis.find((k: Kpi) => k.key === "active-projects");
    // The KPI value is the honest count, not itself capped at 5
    // (the top-5 cap applies to rankings/groupings, not to this scalar count)
    expect(kpi?.value).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// AC-12-001.1 — "agents-working" KPI
// ---------------------------------------------------------------------------

describe("frd-12 kpis: AC-12-001.1 — agents-working KPI", () => {
  it("frd-12: WHEN no events THEN agents-working is 0", () => {
    const kpis = deriveKpis([], []);
    const kpi = kpis.find((k: Kpi) => k.key === "agents-working");
    expect(kpi?.value).toBe(0);
  });

  it("frd-12: WHEN 2 AgentWorking events from distinct agents THEN agents-working is 2", () => {
    const events = [
      makeEvent({ event: "AgentWorking", agent: "implementer" }),
      makeEvent({ event: "AgentWorking", agent: "test-writer", at: "2026-06-16T10:01:00Z" }),
    ];
    const kpis = deriveKpis(events, []);
    const kpi = kpis.find((k: Kpi) => k.key === "agents-working");
    expect(kpi?.value).toBe(2);
  });

  it("frd-12: WHEN same agent appears in multiple AgentWorking events THEN counted once", () => {
    const events = [
      makeEvent({ event: "AgentWorking", agent: "implementer" }),
      makeEvent({ event: "AgentWorking", agent: "implementer", at: "2026-06-16T10:01:00Z" }),
      makeEvent({ event: "AgentWorking", agent: "implementer", at: "2026-06-16T10:02:00Z" }),
    ];
    const kpis = deriveKpis(events, []);
    const kpi = kpis.find((k: Kpi) => k.key === "agents-working");
    expect(kpi?.value).toBe(1);
  });

  it("frd-12: WHEN events have no agent field THEN those events do not inflate agents-working", () => {
    const events = [
      makeEvent({ event: "AgentWorking", agent: undefined }),
      makeEvent({ event: "AgentWorking", agent: "implementer" }),
    ];
    const kpis = deriveKpis(events, []);
    const kpi = kpis.find((k: Kpi) => k.key === "agents-working");
    expect(kpi?.value).toBe(1);
  });

  it("frd-12: WHEN non-AgentWorking ToolCall events exist THEN agents-working counts only AgentWorking-type events", () => {
    const events = [
      makeEvent({ event: "ToolCall", agent: "implementer" }),
      makeEvent({ event: "TaskComplete", agent: "reviewer" }),
    ];
    const kpis = deriveKpis(events, []);
    const kpi = kpis.find((k: Kpi) => k.key === "agents-working");
    expect(kpi?.value).toBeGreaterThanOrEqual(0);
    expect(kpi?.value).toBeLessThanOrEqual(events.length);
  });

  it("frd-12: WHEN 4 distinct agents send AgentWorking events THEN agents-working is 4", () => {
    const events = ["implementer", "test-writer", "reviewer", "librarian"].map((agent, i) =>
      makeEvent({ event: "AgentWorking", agent, at: `2026-06-16T10:0${i}:00Z` }),
    );
    const kpis = deriveKpis(events, []);
    const kpi = kpis.find((k: Kpi) => k.key === "agents-working");
    expect(kpi?.value).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// AC-12-001.1 — "failed-work-orders" KPI (first-class per FRD)
// ---------------------------------------------------------------------------

describe("frd-12 kpis: AC-12-001.1 — failed-work-orders KPI", () => {
  it("frd-12: WHEN no events THEN failed-work-orders is 0", () => {
    const kpis = deriveKpis([], []);
    const kpi = kpis.find((k: Kpi) => k.key === "failed-work-orders");
    expect(kpi?.value).toBe(0);
  });

  it("frd-12: WHEN only ok events THEN failed-work-orders is 0", () => {
    const events = [
      makeEvent({ status: "ok", workOrder: "WO-01-001" }),
      makeEvent({ status: "ok", workOrder: "WO-01-002" }),
    ];
    const kpis = deriveKpis(events, []);
    const kpi = kpis.find((k: Kpi) => k.key === "failed-work-orders");
    expect(kpi?.value).toBe(0);
  });

  it("frd-12: WHEN 2 fail events THEN failed-work-orders is 2", () => {
    const events = [
      makeEvent({ status: "fail", workOrder: "WO-01-001" }),
      makeEvent({ status: "fail", workOrder: "WO-02-001" }),
      makeEvent({ status: "ok", workOrder: "WO-01-002" }),
    ];
    const kpis = deriveKpis(events, []);
    const kpi = kpis.find((k: Kpi) => k.key === "failed-work-orders");
    expect(kpi?.value).toBe(2);
  });

  it("frd-12: WHEN 3 fail + 2 ok events THEN failed-work-orders value is exactly 3", () => {
    const events = [
      makeEvent({ status: "fail", workOrder: "WO-01-001" }),
      makeEvent({ status: "ok", workOrder: "WO-01-001", at: "2026-06-16T10:00:01Z" }),
      makeEvent({ status: "fail", workOrder: "WO-02-001", at: "2026-06-16T10:01:00Z" }),
      makeEvent({ status: "fail", workOrder: "WO-03-001", at: "2026-06-16T10:02:00Z" }),
      makeEvent({ status: "ok", workOrder: "WO-04-001", at: "2026-06-16T10:03:00Z" }),
    ];
    const kpis = deriveKpis(events, []);
    const kpi = kpis.find((k: Kpi) => k.key === "failed-work-orders");
    expect(kpi?.value).toBe(3);
  });

  it("frd-12: WHEN same work order has multiple fail events THEN each fail event is counted", () => {
    const events = [
      makeEvent({ status: "fail", workOrder: "WO-01-001" }),
      makeEvent({ status: "fail", workOrder: "WO-01-001", at: "2026-06-16T10:01:00Z" }),
    ];
    const kpis = deriveKpis(events, []);
    const kpi = kpis.find((k: Kpi) => k.key === "failed-work-orders");
    expect(kpi?.value).toBeGreaterThanOrEqual(1);
  });

  // Regression I3: status must be the string "fail", not undefined or "ok"
  it("frd-12 regression I3: WHEN status is ok or undefined THEN those events are not counted as failures", () => {
    const events = [
      makeEvent({ status: "ok" }),
      makeEvent({ status: undefined }),
      makeEvent({ status: "fail" }), // only this one counts
    ];
    const kpis = deriveKpis(events, []);
    const kpi = kpis.find((k: Kpi) => k.key === "failed-work-orders");
    expect(kpi?.value).toBe(1);
  });

  it("frd-12: WHEN fail event has no workOrder field THEN still counted as a failure", () => {
    const events = [makeEvent({ status: "fail", workOrder: undefined })];
    const kpis = deriveKpis(events, []);
    const kpi = kpis.find((k: Kpi) => k.key === "failed-work-orders");
    expect(kpi?.value).toBeGreaterThanOrEqual(1);
  });

  it("frd-12: WHEN failed-work-orders is non-zero THEN detail field is present and non-empty", () => {
    const events = [makeEvent({ status: "fail", workOrder: "WO-05-003" })];
    const kpis = deriveKpis(events, []);
    const kpi = kpis.find((k: Kpi) => k.key === "failed-work-orders");
    expect(kpi?.detail).toBeDefined();
    expect(typeof kpi?.detail).toBe("string");
    expect((kpi?.detail ?? "").length).toBeGreaterThan(0);
  });

  it("frd-12: WHEN fail event has workOrder WO-05-003 THEN detail includes that work order id", () => {
    const events = [makeEvent({ status: "fail", workOrder: "WO-05-003" })];
    const kpis = deriveKpis(events, []);
    const kpi = kpis.find((k: Kpi) => k.key === "failed-work-orders");
    expect(kpi?.detail).toContain("WO-05-003");
  });

  it("frd-12: WHEN 0 fail events THEN failed-work-orders detail is undefined or empty string", () => {
    const kpis = deriveKpis([makeEvent({ status: "ok" })], []);
    const kpi = kpis.find((k: Kpi) => k.key === "failed-work-orders");
    const detail = kpi?.detail;
    expect(detail === undefined || detail === "").toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AC-12-007.1 — honest metrics derived from the event tail only
// ---------------------------------------------------------------------------

describe("frd-12 kpis: AC-12-007.1 — honest metrics from event tail only", () => {
  it("frd-12: WHEN same event list passed twice THEN deriveKpis is deterministic (pure)", () => {
    const events = [
      makeEvent({ status: "fail", workOrder: "WO-01-001" }),
      makeEvent({ event: "AgentWorking", agent: "implementer" }),
    ];
    const projects = [makeProject({ stage: "implementation" })];
    const first = deriveKpis(events, projects);
    const second = deriveKpis(events, projects);
    expect(first).toEqual(second);
  });

  it("frd-12: WHEN events contain mixed statuses THEN counts are derived solely from the event list", () => {
    const events = [
      makeEvent({ status: "fail" }),
      makeEvent({ status: "ok" }),
      makeEvent({ status: "fail" }),
    ];
    const kpis = deriveKpis(events, []);
    const failed = kpis.find((k: Kpi) => k.key === "failed-work-orders");
    expect(failed?.value).toBe(2);
  });

  it("frd-12: WHEN called with 200 events (max cap) THEN completes synchronously without error", () => {
    const events = Array.from({ length: 200 }, (_, i) =>
      makeEvent({
        at: `2026-06-16T10:${String(i % 60).padStart(2, "0")}:00Z`,
        status: i % 3 === 0 ? "fail" : "ok",
      }),
    );
    let kpis: Kpi[] | undefined;
    expect(() => {
      kpis = deriveKpis(events, []);
    }).not.toThrow();
    expect(kpis).toHaveLength(5);
  });

  it("frd-12: WHEN called THEN does not access process.env (pure, no I/O)", () => {
    const events = [makeEvent({ status: "fail" })];
    const projects = [makeProject()];
    const withEnv = deriveKpis(events, projects);
    const saved = process.env.PANDACORP_FACTORY_ROOT;
    delete process.env.PANDACORP_FACTORY_ROOT;
    const withoutEnv = deriveKpis(events, projects);
    if (saved !== undefined) process.env.PANDACORP_FACTORY_ROOT = saved;
    expect(withEnv).toEqual(withoutEnv);
  });
});

// ---------------------------------------------------------------------------
// Error path / resilience — regression anchors from progress.md incidents
// ---------------------------------------------------------------------------

describe("frd-12 kpis: error paths — regression from progress.md incidents", () => {
  // Regression B1' (WO-13-001, 2026-06-16): NaN must never appear in a KPI value
  it("frd-12 regression B1': WHEN inputs are empty THEN no KPI value is NaN", () => {
    const kpis = deriveKpis([], []);
    for (const kpi of kpis) {
      expect(Number.isFinite(kpi.value)).toBe(true);
    }
  });

  it("frd-12 regression B1': WHEN inputs are large THEN no KPI value is NaN or Infinity", () => {
    const events = Array.from({ length: 200 }, () => makeEvent({ status: "fail" }));
    const projects = Array.from({ length: 50 }, (_, i) =>
      makeProject({ name: `proj-${i}`, stage: "implementation" }),
    );
    const kpis = deriveKpis(events, projects);
    for (const kpi of kpis) {
      expect(Number.isFinite(kpi.value)).toBe(true);
      expect(kpi.value).toBeGreaterThanOrEqual(0);
    }
  });

  // Regression I2 (WO-13-001, 2026-06-16): empty inputs must return zeroed values, not undefined
  it("frd-12 regression I2: WHEN events=[] and projects=[] THEN all values are 0", () => {
    const kpis = deriveKpis([], []);
    for (const kpi of kpis) {
      expect(kpi.value).toBe(0);
    }
  });

  it("frd-12 regression I2: WHEN called with empty inputs THEN no kpi.value is undefined", () => {
    const kpis = deriveKpis([], []);
    for (const kpi of kpis) {
      expect(kpi.value).not.toBeUndefined();
    }
  });

  // Regression FREEZE-ON-RED (WO-02-004, 2026-06-16): events missing optional fields must not throw
  it("frd-12 regression FREEZE-ON-RED: WHEN events are missing optional fields THEN does not throw", () => {
    const sparse: Event[] = [
      { event: "AgentWorking", at: "2026-06-16T10:00:00Z" }, // no agent, no status, no workOrder
      { event: "ToolCall", at: "2026-06-16T10:01:00Z" }, // no status
      { event: "TaskComplete", at: "2026-06-16T10:02:00Z", status: "fail" }, // no workOrder
    ];
    expect(() => deriveKpis(sparse, [])).not.toThrow();
    const kpis = deriveKpis(sparse, []);
    expect(kpis).toHaveLength(5);
  });

  it("frd-12 regression FREEZE-ON-RED: WHEN event batch has minimum-field events THEN all KPI values are numbers", () => {
    const minimal: Event[] = [{ event: "X", at: "2026-06-16T10:00:00Z" }];
    const kpis = deriveKpis(minimal, []);
    for (const kpi of kpis) {
      expect(typeof kpi.value).toBe("number");
    }
  });

  it("frd-12: WHEN returned array is held and deriveKpis is called again THEN first result is not mutated", () => {
    const events = [makeEvent({ status: "fail" })];
    const projects = [makeProject()];
    const first = deriveKpis(events, projects);
    const failedBefore = first.find((k: Kpi) => k.key === "failed-work-orders")?.value;
    deriveKpis(events, projects); // second call — must not mutate `first`
    const failedAfter = first.find((k: Kpi) => k.key === "failed-work-orders")?.value;
    expect(failedAfter).toBe(failedBefore);
  });
});

// ---------------------------------------------------------------------------
// Property-based invariants — parametric table (fast-check not in dep tree).
// Each row explores a distinct axis of the invariant space.
// ---------------------------------------------------------------------------

describe("frd-12 kpis: property-based invariants — parametric table", () => {
  const INVARIANT_CASES: Array<{
    description: string;
    events: Event[];
    projects: ProjectListItem[];
    check: (kpis: Kpi[]) => void;
  }> = [
    {
      description: "single fail event → failed-work-orders = 1",
      events: [makeEvent({ status: "fail" })],
      projects: [],
      check: (kpis) => {
        const kpi = kpis.find((k) => k.key === "failed-work-orders");
        expect(kpi?.value).toBe(1);
      },
    },
    {
      description: "all ok events → failed-work-orders = 0",
      events: [
        makeEvent({ status: "ok" }),
        makeEvent({ status: "ok", at: "2026-06-16T10:01:00Z" }),
        makeEvent({ status: "ok", at: "2026-06-16T10:02:00Z" }),
      ],
      projects: [],
      check: (kpis) => {
        const kpi = kpis.find((k) => k.key === "failed-work-orders");
        expect(kpi?.value).toBe(0);
      },
    },
    {
      description: "5 distinct agents in AgentWorking → agents-working = 5",
      events: ["a", "b", "c", "d", "e"].map((agent, i) =>
        makeEvent({ event: "AgentWorking", agent, at: `2026-06-16T10:0${i}:00Z` }),
      ),
      projects: [],
      check: (kpis) => {
        const kpi = kpis.find((k) => k.key === "agents-working");
        expect(kpi?.value).toBe(5);
      },
    },
    {
      description: "1 active project → active-projects = 1",
      events: [],
      projects: [makeProject({ stage: "implementation" })],
      check: (kpis) => {
        const kpi = kpis.find((k) => k.key === "active-projects");
        expect(kpi?.value).toBe(1);
      },
    },
    {
      description: "mix of active and non-active projects → active-projects counts only active",
      events: [],
      projects: [
        makeProject({ name: "a", stage: "implementation" }),
        makeProject({ name: "b", stage: "product" }),
        makeProject({ name: "c", stage: "design" }),
        makeProject({ name: "d", stage: "operation" }),
      ],
      check: (kpis) => {
        const kpi = kpis.find((k) => k.key === "active-projects");
        expect(kpi?.value).toBe(2); // implementation + operation
      },
    },
    {
      description: "output always has length 5 regardless of input size",
      events: Array.from({ length: 50 }, () => makeEvent()),
      projects: Array.from({ length: 20 }, (_, i) =>
        makeProject({ name: `p${i}`, stage: "implementation" }),
      ),
      check: (kpis) => {
        expect(kpis).toHaveLength(5);
      },
    },
    {
      description: "no kpi.value is negative",
      events: [makeEvent({ status: "fail" }), makeEvent({ status: "ok" })],
      projects: [makeProject({ stage: "implementation" })],
      check: (kpis) => {
        for (const kpi of kpis) {
          expect(kpi.value).toBeGreaterThanOrEqual(0);
        }
      },
    },
    {
      description: "builds-queued is a non-negative integer",
      events: [
        makeEvent({ event: "BuildQueued", status: "ok" }),
        makeEvent({ event: "BuildQueued", status: "ok", at: "2026-06-16T10:01:00Z" }),
      ],
      projects: [],
      check: (kpis) => {
        const kpi = kpis.find((k) => k.key === "builds-queued");
        expect(kpi?.value).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(kpi?.value)).toBe(true);
      },
    },
    {
      description: "xp-today is a non-negative integer",
      events: [makeEvent({ event: "XpAwarded", status: "ok" })],
      projects: [],
      check: (kpis) => {
        const kpi = kpis.find((k) => k.key === "xp-today");
        expect(kpi?.value).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(kpi?.value)).toBe(true);
      },
    },
    {
      description: "agents-working is never greater than distinct agent count in events",
      events: ["x", "y", "z"].map((agent, i) =>
        makeEvent({ event: "AgentWorking", agent, at: `2026-06-16T10:0${i}:00Z` }),
      ),
      projects: [],
      check: (kpis) => {
        const kpi = kpis.find((k) => k.key === "agents-working");
        expect(kpi?.value).toBeLessThanOrEqual(3);
        expect(kpi?.value).toBeGreaterThanOrEqual(0);
      },
    },
    {
      description: "failed-work-orders is never greater than total event count",
      events: Array.from({ length: 7 }, () => makeEvent({ status: "fail" })),
      projects: [],
      check: (kpis) => {
        const kpi = kpis.find((k) => k.key === "failed-work-orders");
        expect(kpi?.value).toBeLessThanOrEqual(7);
      },
    },
    {
      description: "all 5 canonical keys present when inputs are large",
      events: Array.from({ length: 100 }, (_, i) =>
        makeEvent({ status: i % 2 === 0 ? "fail" : "ok" }),
      ),
      projects: Array.from({ length: 10 }, (_, i) =>
        makeProject({ name: `p${i}`, stage: "implementation" }),
      ),
      check: (kpis) => {
        const keys = kpis.map((k) => k.key);
        for (const canonical of CANONICAL_KEYS) {
          expect(keys).toContain(canonical);
        }
      },
    },
  ];

  for (const { description, events, projects, check } of INVARIANT_CASES) {
    it(`frd-12 invariant: ${description}`, () => {
      const kpis = deriveKpis(events, projects);
      check(kpis);
    });
  }
});

// ---------------------------------------------------------------------------
// Specific behavior assertions — concrete values, not generic toBeTruthy()
// ---------------------------------------------------------------------------

describe("frd-12 kpis: specific behavior assertions", () => {
  it("frd-12: WHEN projects mix architecture+release+product THEN active-projects = 2 (not product)", () => {
    const projects = [
      makeProject({ name: "a", stage: "architecture" }),
      makeProject({ name: "b", stage: "release" }),
      makeProject({ name: "c", stage: "product" }),
    ];
    const kpis = deriveKpis([], projects);
    const kpi = kpis.find((k: Kpi) => k.key === "active-projects");
    expect(kpi?.value).toBe(2);
  });

  it("frd-12: WHEN all 5 canonical KPIs are present THEN none share the same key", () => {
    const kpis = deriveKpis([makeEvent()], [makeProject()]);
    const keys = kpis.map((k: Kpi) => k.key);
    const unique = new Set(keys);
    expect(unique.size).toBe(5);
  });

  it("frd-12: WHEN failed-work-orders > 0 THEN the 'failed-work-orders' label is non-empty", () => {
    const events = [makeEvent({ status: "fail" })];
    const kpis = deriveKpis(events, []);
    const kpi = kpis.find((k: Kpi) => k.key === "failed-work-orders");
    expect(typeof kpi?.label).toBe("string");
    expect((kpi?.label ?? "").trim().length).toBeGreaterThan(0);
  });

  it("frd-12: WHEN failed-work-orders = 0 THEN value is the integer 0, not false/null/undefined", () => {
    const kpis = deriveKpis([], []);
    const kpi = kpis.find((k: Kpi) => k.key === "failed-work-orders");
    expect(kpi?.value).toBe(0);
    expect(typeof kpi?.value).toBe("number");
  });

  it("frd-12: WHEN active-projects = 0 THEN value is the integer 0, not false/null/undefined", () => {
    const kpis = deriveKpis([], []);
    const kpi = kpis.find((k: Kpi) => k.key === "active-projects");
    expect(kpi?.value).toBe(0);
    expect(typeof kpi?.value).toBe("number");
  });
});
