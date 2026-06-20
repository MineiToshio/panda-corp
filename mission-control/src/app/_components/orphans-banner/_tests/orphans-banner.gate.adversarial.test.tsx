/**
 * FRD-16 REVIEW GATE — reviewer-authored adversarial edges (DR-015 / DR-050).
 *
 * Edges the WO-16-004 author suite did NOT anchor, all driven through the public
 * component surface (no implementation details):
 *
 *   1. Whole-banner dismiss (Banner's × → onDismiss) must persist EVERY visible
 *      candidate to localStorage and survive a full unmount/remount — not just the
 *      in-memory Set (AC-16-004.4: "persists the dismissal across refresh").
 *   2. Collapse boundary is EXACTLY the threshold: 2 candidates → NO toggle;
 *      3 candidates → toggle with singular "1 proyecto más" copy (REQ-16-003.2).
 *   3. Expand, then a later poll drops the list to ≤ threshold → the toggle goes
 *      away and all remaining items show (the "wall shrinks" path; lifecycle bound).
 *   4. A candidate already dismissed in localStorage on FIRST mount never flashes
 *      (it must be filtered on the very first render, not after a second poll).
 */

import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OrphansBanner } from "@/app/_components/orphans-banner/orphans-banner";
import type { Candidate } from "@/lib/orphans/orphans";

const POLL_INTERVAL_MS = 30_000;

function orphan(name: string, dir: string): Candidate {
  return {
    name,
    path: `/Users/dev/${dir}/${name}`,
    kind: "orphan",
    hasMarker: true,
    inPortfolio: false,
  };
}

function mockFetchSequence(sequences: Candidate[][]): void {
  let call = 0;
  global.fetch = vi.fn().mockImplementation(() => {
    const candidates = sequences[call] ?? sequences[sequences.length - 1] ?? [];
    call++;
    // Fresh references each poll (mirrors production no-store fetch → JSON.parse).
    return Promise.resolve({ ok: true, json: async () => candidates.map((c) => ({ ...c })) });
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

describe("FRD-16 gate — whole-banner dismiss persists ALL candidates across remount", () => {
  it("the Banner × dismisses every visible candidate and they stay gone after a remount", async () => {
    const a = orphan("alpha", "work");
    const b = orphan("beta", "work");
    mockFetchSequence([[a, b]]);

    const { unmount } = render(<OrphansBanner />);
    await flushInitialPoll();

    expect(screen.getByTestId("orphans-banner")).toBeInTheDocument();

    // Click the shared Banner's whole-banner dismiss ×.
    const bannerDismiss = screen.getByTestId("banner-dismiss");
    act(() => {
      bannerDismiss.click();
    });

    // EVERY visible candidate must be persisted (not just the in-memory Set).
    expect(localStorage.getItem(`mc:orphan-dismissed:${a.path}`)).toBe("1");
    expect(localStorage.getItem(`mc:orphan-dismissed:${b.path}`)).toBe("1");

    // Banner is gone now.
    expect(screen.queryByTestId("orphans-banner")).not.toBeInTheDocument();

    // Simulate a refresh: full unmount + fresh mount, same probe result.
    unmount();
    mockFetchSequence([[a, b]]);
    render(<OrphansBanner />);
    await flushInitialPoll();

    // Both were persisted → nothing renders after the refresh.
    expect(screen.queryByTestId("orphans-banner")).not.toBeInTheDocument();
  });
});

describe("FRD-16 gate — collapse boundary is exactly the threshold", () => {
  it("exactly TWO candidates → no overflow toggle (no wall to collapse)", async () => {
    mockFetchSequence([[orphan("a", "x"), orphan("b", "x")]]);
    render(<OrphansBanner />);
    await flushInitialPoll();

    expect(screen.getByTestId("orphans-banner")).toBeInTheDocument();
    expect(screen.queryByTestId("orphans-toggle")).not.toBeInTheDocument();
  });

  it("exactly THREE candidates → toggle with SINGULAR '1 proyecto más' copy", async () => {
    mockFetchSequence([[orphan("a", "x"), orphan("b", "x"), orphan("c", "x")]]);
    render(<OrphansBanner />);
    await flushInitialPoll();

    const toggle = screen.getByTestId("orphans-toggle");
    expect(toggle).toHaveTextContent("Ver 1 proyecto más sin registrar");
    // The hidden third item is not shown until expanded.
    expect(screen.queryByTestId("orphan-item-c")).not.toBeInTheDocument();
  });

  it("FOUR candidates → plural 'proyectos' copy", async () => {
    mockFetchSequence([[orphan("a", "x"), orphan("b", "x"), orphan("c", "x"), orphan("d", "x")]]);
    render(<OrphansBanner />);
    await flushInitialPoll();

    expect(screen.getByTestId("orphans-toggle")).toHaveTextContent(
      "Ver 2 proyectos más sin registrar",
    );
  });
});

describe("FRD-16 gate — expanded list shrinking below threshold drops the toggle", () => {
  it("expand 3 → 1 dismissed by poll leaves 2 → toggle disappears, both show", async () => {
    const a = orphan("a", "x");
    const b = orphan("b", "x");
    const c = orphan("c", "x");
    // Poll 1: three. Poll 2 (after interval): c reconciled → two.
    mockFetchSequence([
      [a, b, c],
      [a, b],
    ]);
    render(<OrphansBanner />);
    await flushInitialPoll();

    // Expand to see all three.
    act(() => {
      screen.getByTestId("orphans-toggle").click();
    });
    expect(screen.getByTestId("orphan-item-c")).toBeInTheDocument();

    // Next poll: only two remain.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    });

    expect(screen.getByTestId("orphan-item-a")).toBeInTheDocument();
    expect(screen.getByTestId("orphan-item-b")).toBeInTheDocument();
    expect(screen.queryByTestId("orphan-item-c")).not.toBeInTheDocument();
    // No overflow with two → the toggle is gone.
    expect(screen.queryByTestId("orphans-toggle")).not.toBeInTheDocument();
  });
});

describe("FRD-16 gate — pre-dismissed candidate never flashes on first mount", () => {
  it("a candidate dismissed in localStorage before mount is filtered on the FIRST render", async () => {
    const a = orphan("ghost", "x");
    const b = orphan("real", "x");
    localStorage.setItem(`mc:orphan-dismissed:${a.path}`, "1");
    mockFetchSequence([[a, b]]);

    render(<OrphansBanner />);
    await flushInitialPoll();

    // 'ghost' was dismissed before mount → must not appear at all.
    expect(screen.queryByTestId("orphan-item-ghost")).not.toBeInTheDocument();
    // 'real' still shows.
    expect(screen.getByTestId("orphan-item-real")).toBeInTheDocument();
  });
});
