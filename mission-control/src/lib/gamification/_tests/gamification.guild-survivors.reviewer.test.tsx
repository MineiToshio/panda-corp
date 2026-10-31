/**
 * FRD-09 reviewer integration (DR-015), re-authored at the FRD-13 close.
 *
 * WO-13-013 deleted CelebrationSurface, XpBar, the top-bar GuildBar and the agent XP engine, and with
 * them the suite that exercised this pipeline. The guild engine and its sidebar card survive, so the
 * cases that were about honest guild numbers stay here against the live surface.
 */
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Avatar } from "@/components/core/Avatar/Avatar";
import { GuildCard } from "@/components/modules/GuildBar/GuildCard";
import type { Event, EventsSnapshot } from "@/lib/events/events";
import {
  computeGuildLevel,
  deriveGuildOutcomes,
  type GuildOutcomes,
  RANKS,
} from "@/lib/gamification/gamification";
import type { ProjectStatus, StatusResult } from "@/lib/status/status";

afterEach(cleanup);

function statusPresent(partial: { phase?: string }): StatusResult {
  return { present: true, malformed: false, status: partial as Partial<ProjectStatus> };
}

function snapshot(events: Event[]): EventsSnapshot {
  return { events, lastEventAt: events.at(-1)?.at ?? null, byProject: {} };
}

function ev(partial: Partial<Event>): Event {
  return { event: "message", at: "2026-06-17T00:00:00Z", ...partial };
}

function barValue(): string | null {
  return within(screen.getByRole("link")).getByRole("progressbar").getAttribute("aria-valuenow");
}

describe("honest guild pipeline", () => {
  it("an empty factory renders level 1, the lowest rank and an empty bar", () => {
    const outcomes = deriveGuildOutcomes({ statuses: [], eventsSnapshot: null });
    expect(outcomes.workOrdersDone).toBe(0);
    expect(outcomes.releases).toBe(0);
    render(<GuildCard level={computeGuildLevel(outcomes)} />);
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText(RANKS[0]?.title ?? "")).toBeInTheDocument();
    expect(barValue()).toBe("0");
  });

  it("malformed and absent statuses are skipped and do not inflate XP", () => {
    const statuses: StatusResult[] = [
      { present: false, malformed: false, status: null },
      { present: true, malformed: true, status: {} },
      statusPresent({}),
    ];
    const outcomes = deriveGuildOutcomes({ statuses, eventsSnapshot: null });
    expect(outcomes).toEqual<GuildOutcomes>({
      workOrdersDone: 0,
      phasesCompleted: 0,
      releases: 0,
      greenTestRuns: 0,
      weeklyStreak: 0,
    });
    const guild = computeGuildLevel(outcomes);
    expect(guild.xp).toBe(0);
    expect(guild.pctToNext).toBe(0);
  });

  it.each([
    ["negative", -999, 0],
    ["NaN", Number.NaN, 0],
    ["fractional", 3.9, 3],
  ])("a %s live work-order count stays an honest number", (_, live, expected) => {
    const outcomes = deriveGuildOutcomes({
      statuses: [statusPresent({})],
      eventsSnapshot: null,
      workOrdersDoneLive: live,
    });
    expect(outcomes.workOrdersDone).toBe(expected);
    expect(Number.isFinite(computeGuildLevel(outcomes).xp)).toBe(true);
  });

  it("a NaN count still renders a finite bar", () => {
    const outcomes = deriveGuildOutcomes({
      statuses: [statusPresent({})],
      eventsSnapshot: null,
      workOrdersDoneLive: Number.NaN,
    });
    render(<GuildCard level={computeGuildLevel(outcomes)} />);
    expect(barValue()).toBe("0");
  });

  it("a launched project counts as both a completed phase and a release", () => {
    const outcomes = deriveGuildOutcomes({
      statuses: [statusPresent({ phase: "release" })],
      eventsSnapshot: null,
      workOrdersDoneLive: 0,
    });
    expect(outcomes.phasesCompleted).toBe(1);
    expect(outcomes.releases).toBe(1);
  });

  it("an unknown phase contributes neither a phase nor a release", () => {
    const outcomes = deriveGuildOutcomes({
      statuses: [statusPresent({ phase: "not-a-real-phase" })],
      eventsSnapshot: null,
    });
    expect(outcomes.phasesCompleted).toBe(0);
    expect(outcomes.releases).toBe(0);
  });

  it("activity never turns into guild XP through the event path", () => {
    const stream = snapshot([
      ev({ event: "achievement", agent: "backend-dev", workOrder: "WO-09-001", status: "ok" }),
      ev({ event: "read", agent: "backend-dev" }),
    ]);
    const outcomes = deriveGuildOutcomes({ statuses: [], eventsSnapshot: stream });
    expect(outcomes.greenTestRuns).toBe(0);
    expect(computeGuildLevel(outcomes).xp).toBe(0);
  });

  it("test_ok drives green runs while failures and activity do not", () => {
    const stream = snapshot([
      ev({ event: "test_ok", workOrder: "WO-1" }),
      ev({ event: "test_ok" }),
      ev({ event: "test_fail", workOrder: "WO-2" }),
      ev({ event: "read" }),
    ]);
    expect(deriveGuildOutcomes({ statuses: [], eventsSnapshot: stream }).greenTestRuns).toBe(2);
  });

  it("extreme XP stays in the top rank and invents no higher one", () => {
    const outcomes: GuildOutcomes = {
      workOrdersDone: 0,
      phasesCompleted: 0,
      releases: 5000,
      greenTestRuns: 0,
    };
    const guild = computeGuildLevel(outcomes);
    expect(guild.title).toBe(RANKS.at(-1)?.title);
    expect(guild.level).toBeGreaterThan(RANKS.length);
    expect(guild.pctToNext).toBeGreaterThanOrEqual(0);
    expect(guild.pctToNext).toBeLessThanOrEqual(100);
    render(<GuildCard level={guild} />);
    expect(screen.getByText(RANKS.at(-1)?.title ?? "")).toBeInTheDocument();
  });
});

describe("agent identity without a sprite", () => {
  it("an unknown agent id renders initials and a Spanish name", () => {
    render(<Avatar agentId={"mystery-agent" as never} />);
    expect(screen.queryByTestId("agent-avatar-img")).toBeNull();
    expect(screen.getByTestId("agent-avatar-placeholder")).toHaveTextContent("MA");
    expect(screen.getByRole("img", { name: "Avatar de agente mystery-agent" })).toBeDefined();
  });
});
