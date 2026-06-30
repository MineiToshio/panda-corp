/**
 * PartyLiveShell — a stale SSE replay must not re-activate a powered-off scene.
 *
 * The `/api/live` SSE emits the current event tail on connect, even when the build
 * is OFF. Without care, that frame re-derives an ACTIVE snapshot (ignoring the
 * authoritative `running:false`), undoing the server's factory-off render after
 * hydration. PartyLiveShell keeps the scene off for a mere replay, and reactivates
 * only on a genuinely NEWER event (the build resumed) — AC-06-013 / AC-06-013.3.
 */

import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Event as DashboardEvent } from "@/lib/events/events";
import { toFraguaSnapshot } from "../../fragua-snapshot/fragua-snapshot";
import { PartyLiveShell } from "../PartyLiveShell";

const useLiveSnapshotMock = vi.fn();
vi.mock("@/hooks/useLiveSnapshot", () => ({
  useLiveSnapshot: () => useLiveSnapshotMock(),
}));

beforeEach(() => {
  vi.stubGlobal("requestAnimationFrame", (_cb: FrameRequestCallback) => 0);
  vi.stubGlobal("cancelAnimationFrame", (_id: number) => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  useLiveSnapshotMock.mockReset();
});

const FRD = "frd-10-achievements-hall";
const STALE_AT = "2026-06-30T02:00:00Z";

function ev(wo: string, at: string): DashboardEvent {
  return { event: "AgentWorking", at, workOrder: wo, frd: FRD, phase: "build" };
}

const STALE_TAIL = [ev("WO-10-014", STALE_AT)];
// The server-derived initial snapshot is already powered-off (running:false).
const OFF_INITIAL = toFraguaSnapshot(STALE_TAIL, { lastEventAt: STALE_AT, running: false });

describe("PartyLiveShell — factory-off survives a stale SSE replay (AC-06-013)", () => {
  it("a replay of the same stale tail does NOT re-activate the off scene", () => {
    useLiveSnapshotMock.mockReturnValue({
      snapshot: { events: STALE_TAIL, lastEventAt: STALE_AT },
      connected: true,
      lastEventAt: STALE_AT,
    });
    render(<PartyLiveShell initialSnapshot={OFF_INITIAL} running={false} />);
    expect(screen.queryByTestId("fragua-wo-WO-10-014")).toBeNull();
  });

  it("a genuinely NEWER SSE event reactivates the scene (build resumed)", () => {
    const fresherAt = "2026-06-30T03:00:00Z";
    useLiveSnapshotMock.mockReturnValue({
      snapshot: { events: [ev("WO-10-099", fresherAt)], lastEventAt: fresherAt },
      connected: true,
      lastEventAt: fresherAt,
    });
    render(<PartyLiveShell initialSnapshot={OFF_INITIAL} running={false} />);
    expect(screen.queryByTestId("fragua-wo-WO-10-099")).not.toBeNull();
  });
});
