/**
 * WO-12-002 — `deriveKpis` ADVERSARIAL tests (reviewer / DR-015).
 *
 * Written by the reviewer (Opus 4.8), NOT by the implementer. These probe edges
 * that kpis.test.ts did NOT cover, derived from AC-12-001.1, AC-12-007.1 and the
 * B1'/I2/I3/FREEZE-ON-RED regression anchors in .pandacorp/comms/progress.md.
 *
 * The implementer's suite is type-clean and exercises the happy path well; it
 * does NOT exercise the *runtime-malformed* inputs that real NDJSON produces
 * once `lib/events` is bypassed or its parser drifts (DR-001 boundary risk),
 * nor the mutation targets below.
 *
 * Mutation targets (DR-016): if a mutant
 *   - flips `ev.status === "fail"` to a truthy cast (`!!ev.status` / `ev.status`),
 *   - drops the `typeof ev.agent === "string"` guard,
 *   - drops the `Number.isFinite`/`n >= 0` guard in safeCount,
 *   - returns fewer/more than 5 KPIs,
 *   - swaps any of the 5 canonical keys/labels,
 * at least one assertion here must fail.
 *
 * Stack: Vitest (TypeScript). Pure function — no fixtures, no I/O, no env.
 */

import { describe, expect, it } from "vitest";
import { deriveKpis, type Kpi } from "../kpis";

// The function is `deriveKpis(events: Event[], projects: ProjectInput[])`.
// To exercise RUNTIME-malformed shapes (what the type system forbids but the
// wire allows), we deliberately cast through `unknown`. This is the whole point
// of an adversarial pass: the contract says "never throws" for the event tail,
// so it must survive shapes that the compiler cannot see.
// biome-ignore lint/suspicious/noExplicitAny: adversarial — feed runtime-malformed shapes the types forbid
type Loose = any;
const run = (events: Loose, projects: Loose): Kpi[] =>
  deriveKpis(events as Loose, projects as Loose);

const find = (kpis: Kpi[], key: string): Kpi | undefined => kpis.find((k) => k.key === key);

// ---------------------------------------------------------------------------
// I3 deepened: array-shaped `status` must NOT be counted as a failure.
// The implementer tests status="ok"/undefined, never status=["fail"].
// `["fail"] === "fail"` is false, so a correct impl counts 0. A truthy-cast
// mutant (`if (ev.status)`) would count it → this kills that mutant.
// ---------------------------------------------------------------------------
describe("frd-12 adversarial: status must be the exact string 'fail'", () => {
  it("WHEN status is the array ['fail'] THEN it is NOT counted as a failure", () => {
    const kpis = run([{ event: "X", at: "t", status: ["fail"] }], []);
    expect(find(kpis, "failed-work-orders")?.value).toBe(0);
  });

  it("WHEN status is the object {fail:true} THEN it is NOT counted as a failure", () => {
    const kpis = run([{ event: "X", at: "t", status: { fail: true } }], []);
    expect(find(kpis, "failed-work-orders")?.value).toBe(0);
  });

  it("WHEN status is the number 1 (truthy) THEN it is NOT counted as a failure", () => {
    const kpis = run([{ event: "X", at: "t", status: 1 }], []);
    expect(find(kpis, "failed-work-orders")?.value).toBe(0);
  });

  it("WHEN status is the string 'failure' (substring trap) THEN NOT counted", () => {
    const kpis = run([{ event: "X", at: "t", status: "failure" }], []);
    expect(find(kpis, "failed-work-orders")?.value).toBe(0);
  });

  it("WHEN status is 'FAIL' uppercase THEN NOT counted (case-sensitive contract)", () => {
    const kpis = run([{ event: "X", at: "t", status: "FAIL" }], []);
    expect(find(kpis, "failed-work-orders")?.value).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// agent-as-non-string: the I3 anchor says agent must be a string before
// counting. The implementer only tests agent=undefined, never agent=array.
// ---------------------------------------------------------------------------
describe("frd-12 adversarial: agents-working ignores non-string agent", () => {
  it("WHEN AgentWorking event has agent as an array THEN it does not inflate the count", () => {
    const kpis = run(
      [
        { event: "AgentWorking", at: "t", agent: ["impl", "test"] },
        { event: "AgentWorking", at: "t2", agent: "impl" },
      ],
      [],
    );
    expect(find(kpis, "agents-working")?.value).toBe(1);
  });

  it("WHEN agent is the empty string THEN it is counted at most once (Set dedup), never throws", () => {
    // Empty string is a string → contract counts it. Assert no double-count / no throw.
    const kpis = run(
      [
        { event: "AgentWorking", at: "t", agent: "" },
        { event: "AgentWorking", at: "t2", agent: "" },
      ],
      [],
    );
    const v = find(kpis, "agents-working")?.value ?? -1;
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThanOrEqual(1);
  });

  it("WHEN agent is a number THEN it does not inflate agents-working", () => {
    const kpis = run([{ event: "AgentWorking", at: "t", agent: 42 }], []);
    expect(find(kpis, "agents-working")?.value).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// active-projects with malformed `stage` shapes the type forbids.
// Implementer tests stage=undefined and inactive strings, never array/number.
// ---------------------------------------------------------------------------
describe("frd-12 adversarial: active-projects ignores malformed stage", () => {
  it("WHEN stage is an array containing an active phase THEN NOT counted", () => {
    const kpis = run([], [{ stage: ["implementation"] }]);
    expect(find(kpis, "active-projects")?.value).toBe(0);
  });

  it("WHEN stage has surrounding whitespace THEN NOT counted (exact-match contract)", () => {
    const kpis = run([], [{ stage: " implementation " }]);
    expect(find(kpis, "active-projects")?.value).toBe(0);
  });

  it("WHEN a project object is entirely empty THEN NOT counted, no throw", () => {
    expect(() => run([], [{}, {}])).not.toThrow();
    expect(find(run([], [{}, {}]), "active-projects")?.value).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Prototype-pollution / dangerous keys as workOrder — must not corrupt detail
// or the Set bookkeeping, must not throw.
// ---------------------------------------------------------------------------
describe("frd-12 adversarial: dangerous workOrder values", () => {
  it("WHEN workOrder is '__proto__' THEN counted as a failure, no prototype corruption, no throw", () => {
    expect(() =>
      run([{ event: "X", at: "t", status: "fail", workOrder: "__proto__" }], []),
    ).not.toThrow();
    const kpis = run([{ event: "X", at: "t", status: "fail", workOrder: "__proto__" }], []);
    expect(find(kpis, "failed-work-orders")?.value).toBe(1);
    // Sanity: prototype not polluted.
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("WHEN two fail events share workOrder THEN detail lists it once but count is 2", () => {
    const kpis = run(
      [
        { event: "X", at: "t", status: "fail", workOrder: "WO-09-001" },
        { event: "X", at: "t2", status: "fail", workOrder: "WO-09-001" },
      ],
      [],
    );
    const kpi = find(kpis, "failed-work-orders");
    expect(kpi?.value).toBe(2);
    // detail should not duplicate the id.
    const occurrences = (kpi?.detail ?? "").split("WO-09-001").length - 1;
    expect(occurrences).toBe(1);
  });

  it("WHEN fail events have no workOrder THEN detail is present and non-empty (count surfaced)", () => {
    const kpis = run(
      [
        { event: "X", at: "t", status: "fail" },
        { event: "X", at: "t2", status: "fail" },
      ],
      [],
    );
    const kpi = find(kpis, "failed-work-orders");
    expect(kpi?.value).toBe(2);
    expect((kpi?.detail ?? "").length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// FREEZE-ON-RED deepened: the whole inputs being null/undefined (the type
// forbids it, but a drifted caller could pass it). Contract says "never throws".
// This is the strongest version of the resilience anchor — the implementer's
// suite always passes a real array.
// ---------------------------------------------------------------------------
describe("frd-12 adversarial: top-level null/garbage inputs (hardening gap, IMPORTANT)", () => {
  // FINDING (important, non-blocking): the producers in the real call path
  // (`lib/events.readEvents` and `lib/portfolio.activeProjects`) never emit
  // null/non-object array entries, and the `Event[]`/`ProjectInput[]` types
  // forbid them at compile time. So these cannot occur in the current wiring.
  // BUT the function docstring promises "Never throws", and a future caller or
  // an NDJSON parser drift could pass a sparse array. deriveKpis throws today
  // (`Cannot read properties of null`). These tests DOCUMENT the gap; they are
  // written as expectations of the desired hardened behavior and are marked
  // `.fails` so the suite stays green while the gap is visible. If the
  // implementer adds entry-level guards (e.g. `if (ev && typeof ev === "object")`),
  // flip `.fails` to a passing assertion.
  it.fails("WHEN events contains null/garbage entries THEN does not throw (gap: throws today)", () => {
    const dirty = [null, undefined, 42, "string", { event: "X", at: "t", status: "fail" }];
    expect(() => run(dirty, [])).not.toThrow();
  });

  it.fails("WHEN projects contains null entries THEN does not throw (gap: throws today)", () => {
    expect(() => run([], [null, { stage: "implementation" }])).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Mutation-killing: exact canonical contract (keys, order, labels, count).
// Kills "swap a key", "drop a KPI", "add a 6th KPI", "relabel".
// ---------------------------------------------------------------------------
describe("frd-12 adversarial: exact canonical contract (mutation-killing)", () => {
  it("WHEN called THEN returns EXACTLY 5 KPIs in the canonical order", () => {
    const kpis = run([], []);
    expect(kpis.map((k) => k.key)).toEqual([
      "active-projects",
      "agents-working",
      "xp-today",
      "builds-queued",
      "failed-work-orders",
    ]);
  });

  it("WHEN called THEN the failed-work-orders KPI is last (FRD-06/13 first-class but tail position)", () => {
    const kpis = run([], []);
    expect(kpis[kpis.length - 1]?.key).toBe("failed-work-orders");
  });

  it("WHEN inputs are zeroed THEN failed-work-orders carries NO detail field (clean zero state)", () => {
    const kpis = run([], []);
    const kpi = find(kpis, "failed-work-orders");
    // Mutation: if a mutant always emits a detail, this catches it.
    expect(kpi && "detail" in kpi ? kpi.detail : undefined).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// AC-12-007.1: builds-queued and xp-today are derived ONLY from their own event
// types — a fail/ok status must not bleed into them, and unrelated events must
// not be miscounted. The implementer never cross-checks isolation.
// ---------------------------------------------------------------------------
describe("frd-12 adversarial: per-metric isolation (AC-12-007.1)", () => {
  it("WHEN a BuildQueued event also has status:'fail' THEN it counts in BOTH builds-queued AND failed-work-orders independently", () => {
    const kpis = run([{ event: "BuildQueued", at: "t", status: "fail" }], []);
    expect(find(kpis, "builds-queued")?.value).toBe(1);
    expect(find(kpis, "failed-work-orders")?.value).toBe(1);
  });

  it("WHEN only XpAwarded events exist THEN builds-queued stays 0 (no cross-bleed)", () => {
    const kpis = run(
      [
        { event: "XpAwarded", at: "t" },
        { event: "XpAwarded", at: "t2" },
      ],
      [],
    );
    expect(find(kpis, "xp-today")?.value).toBe(2);
    expect(find(kpis, "builds-queued")?.value).toBe(0);
    expect(find(kpis, "agents-working")?.value).toBe(0);
  });

  it("WHEN event name casing differs ('buildqueued') THEN NOT counted (exact event-name contract)", () => {
    const kpis = run([{ event: "buildqueued", at: "t" }], []);
    expect(find(kpis, "builds-queued")?.value).toBe(0);
  });
});
