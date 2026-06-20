/**
 * FRD-16 review gate — reviewer-authored edge/abuse tests (DR-015/DR-050).
 *
 * Edges the WO-16-004 suite + the first adversarial file did NOT anchor, exercising
 * CMP-16-banner (OrphansBanner) against the contract CMP-16-route emits:
 *   - the collapse BOUNDARY (AC-16-004.5): exactly 2 → no toggle; 3 → "1 más" (singular);
 *     4 → "2 más" (plural); expanding shows all then "Ver menos";
 *   - dismissal PERSISTS across an unmount/remount (AC-16-004.4 — localStorage, not
 *     only in-memory state; a refresh must not resurrect a dismissed candidate);
 *   - whole-banner dismiss persists ALL paths across remount (AC-16-004.4);
 *   - resilience to a malformed/non-2xx probe (AC-16-004.7 / FDD "error" state):
 *     a non-ok response leaves the banner hidden; the component does not crash.
 *
 * These exercise the refactored kind="orphan" consumer TOGETHER with the VERIFIED
 * lib/orphans Candidate shape and the shared Banner/Chip/CmdRow primitives (real
 * integration of the FRD-16 work orders).
 */

import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OrphansBanner } from "@/app/_components/orphans-banner/orphans-banner";
import type { Candidate } from "@/lib/orphans/orphans";

const POLL_INTERVAL_MS = 30_000;

function orphan(name: string): Candidate {
  return {
    name,
    path: `/Users/dev/projects/${name}`,
    kind: "orphan",
    hasMarker: false,
    inPortfolio: false,
  };
}

function mockOkSequence(sequences: Candidate[][]): void {
  let call = 0;
  global.fetch = vi.fn().mockImplementation(() => {
    const candidates = sequences[call] ?? sequences[sequences.length - 1];
    call++;
    return Promise.resolve({ ok: true, json: async () => candidates });
  });
}

async function flushInitialPoll(): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
  localStorage.clear();
});

describe("FRD-16 review gate — collapse boundary (AC-16-004.5)", () => {
  it("exactly TWO candidates → no overflow toggle (boundary, not >2)", async () => {
    mockOkSequence([[orphan("a"), orphan("b")]]);
    render(<OrphansBanner />);
    await flushInitialPoll();

    expect(screen.getByTestId("orphan-item-a")).toBeInTheDocument();
    expect(screen.getByTestId("orphan-item-b")).toBeInTheDocument();
    expect(screen.queryByTestId("orphans-toggle")).not.toBeInTheDocument();
  });

  it("THREE candidates → toggle reads singular '1 ... más' and hides the third", async () => {
    mockOkSequence([[orphan("a"), orphan("b"), orphan("c")]]);
    render(<OrphansBanner />);
    await flushInitialPoll();

    expect(screen.getByTestId("orphan-item-a")).toBeInTheDocument();
    expect(screen.getByTestId("orphan-item-b")).toBeInTheDocument();
    // Third is collapsed away until expanded.
    expect(screen.queryByTestId("orphan-item-c")).not.toBeInTheDocument();

    const toggle = screen.getByTestId("orphans-toggle");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    // Singular wording for exactly one hidden item (no "1 proyectos").
    expect(toggle).toHaveTextContent("1 proyecto más");
    expect(toggle.textContent).not.toContain("1 proyectos");
  });

  it("FOUR candidates → plural '2 ... más'; expanding reveals all then 'Ver menos'", async () => {
    mockOkSequence([[orphan("a"), orphan("b"), orphan("c"), orphan("d")]]);
    render(<OrphansBanner />);
    await flushInitialPoll();

    const toggle = screen.getByTestId("orphans-toggle");
    expect(toggle).toHaveTextContent("2 proyectos más");

    act(() => {
      toggle.click();
    });

    // All four now visible; toggle flips to "Ver menos".
    expect(screen.getByTestId("orphan-item-c")).toBeInTheDocument();
    expect(screen.getByTestId("orphan-item-d")).toBeInTheDocument();
    const reToggle = screen.getByTestId("orphans-toggle");
    expect(reToggle).toHaveAttribute("aria-expanded", "true");
    expect(reToggle).toHaveTextContent("Ver menos");
  });
});

describe("FRD-16 review gate — dismissal persists across remount (AC-16-004.4)", () => {
  it("a per-item dismissal survives an unmount/remount (localStorage, not in-memory only)", async () => {
    mockOkSequence([[orphan("ghost")]]);
    const { unmount } = render(<OrphansBanner />);
    await flushInitialPoll();

    const dismiss = screen.getByTestId("orphan-dismiss-ghost");
    act(() => {
      dismiss.click();
    });
    expect(screen.queryByTestId("orphans-banner")).not.toBeInTheDocument();
    expect(localStorage.getItem("mc:orphan-dismissed:/Users/dev/projects/ghost")).toBe("1");

    // Simulate a full page refresh: unmount, remount, same orphan still returned.
    unmount();
    mockOkSequence([[orphan("ghost")]]);
    render(<OrphansBanner />);
    await flushInitialPoll();

    // The dismissed candidate must NOT resurrect after the refresh.
    expect(screen.queryByTestId("orphans-banner")).not.toBeInTheDocument();
  });

  it("whole-banner dismiss persists every visible path across remount", async () => {
    mockOkSequence([[orphan("one"), orphan("two")]]);
    const { unmount } = render(<OrphansBanner />);
    await flushInitialPoll();

    const bannerDismiss = screen.getByTestId("banner-dismiss");
    act(() => {
      bannerDismiss.click();
    });
    expect(screen.queryByTestId("orphans-banner")).not.toBeInTheDocument();
    expect(localStorage.getItem("mc:orphan-dismissed:/Users/dev/projects/one")).toBe("1");
    expect(localStorage.getItem("mc:orphan-dismissed:/Users/dev/projects/two")).toBe("1");

    unmount();
    mockOkSequence([[orphan("one"), orphan("two")]]);
    render(<OrphansBanner />);
    await flushInitialPoll();

    expect(screen.queryByTestId("orphans-banner")).not.toBeInTheDocument();
  });
});

describe("FRD-16 review gate — resilient to a failing probe (FDD error state)", () => {
  it("a non-ok response keeps the banner hidden and does not crash", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, json: async () => [] });
    render(<OrphansBanner />);
    await flushInitialPoll();

    // No state update on a non-2xx → renders nothing (no false alarm, no throw).
    expect(screen.queryByTestId("orphans-banner")).not.toBeInTheDocument();
  });

  it("a rejected fetch (network error) keeps the banner hidden and does not crash", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("network down"));
    render(<OrphansBanner />);
    await flushInitialPoll();

    expect(screen.queryByTestId("orphans-banner")).not.toBeInTheDocument();

    // A later successful poll still works (the loop is not broken by one failure).
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => [orphan("late")] });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    });
    expect(screen.getByTestId("orphan-item-late")).toBeInTheDocument();
  });
});
