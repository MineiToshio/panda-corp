/**
 * FRD-16 review gate — ADVERSARIAL banner tests (reviewer-authored, DR-015/DR-050).
 *
 * Edges the WO-16-004 suite did not anchor, exercising CMP-16-banner against the
 * shape CMP-16-route really emits:
 *   - self-clear via the POLLING INTERVAL (orphan present → adopted between polls,
 *     not merely absent on first poll) — AC-16-004.4 "gone on next poll";
 *   - the read-only invariant at the wire level: the only fetch is a bare GET
 *     with no method override and no body (AC-16-004.5 / REQ-16-005);
 *   - two distinct candidates that share the same basename must both render and
 *     each dismiss independently (React keys/dismissal are by absolute path, not
 *     by name — guards a real collision the by-name data-testids could mask).
 */

import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Candidate } from "@/lib/orphans";
import { OrphansBanner } from "./orphans-banner";

const POLL_INTERVAL_MS = 30_000;

function mockFetchSequence(sequences: Candidate[][]): void {
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

const ORPHAN: Candidate = {
  name: "stray-repo",
  path: "/Users/dev/projects/stray-repo",
  kind: "orphan",
  hasMarker: false,
  inPortfolio: false,
};

describe("FRD-16 review gate — banner self-clears on the polling interval after adoption", () => {
  it("shows the orphan, then disappears once a later poll no longer returns it", async () => {
    // Poll 1: orphan present. Poll 2 (after interval): adopted → empty list.
    mockFetchSequence([[ORPHAN], []]);
    render(<OrphansBanner />);
    await flushInitialPoll();

    expect(screen.getByTestId("orphans-banner")).toBeInTheDocument();
    expect(screen.getByTestId("orphan-item-stray-repo")).toBeInTheDocument();

    // Advance past the poll interval → second poll returns [] → self-clear.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    });

    expect(screen.queryByTestId("orphans-banner")).not.toBeInTheDocument();
  });
});

describe("FRD-16 review gate — read-only invariant at the wire level", () => {
  it("polls with a bare GET: no method override, no body", async () => {
    mockFetchSequence([[ORPHAN]]);
    render(<OrphansBanner />);
    await flushInitialPoll();

    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    expect(fetchMock).toHaveBeenCalled();
    for (const callArgs of fetchMock.mock.calls) {
      const init = callArgs[1] as RequestInit | undefined;
      // A bare GET is either no init at all, or an init that does not declare a
      // mutating method / body.
      if (init) {
        const method = (init.method ?? "GET").toUpperCase();
        expect(method).toBe("GET");
        expect(init.body ?? null).toBeNull();
      }
    }
  });
});

describe("FRD-16 review gate — two candidates sharing a basename are independent", () => {
  const A: Candidate = {
    name: "app",
    path: "/Users/dev/work/app",
    kind: "orphan",
    hasMarker: false,
    inPortfolio: false,
  };
  const B: Candidate = {
    name: "app",
    path: "/Users/dev/clients/app",
    kind: "orphan",
    hasMarker: false,
    inPortfolio: false,
  };

  it("renders BOTH same-basename candidates (keyed by absolute path, not name)", async () => {
    mockFetchSequence([[A, B]]);
    render(<OrphansBanner />);
    await flushInitialPoll();

    // Both absolute paths must be visible even though the basenames collide.
    const banner = screen.getByTestId("orphans-banner");
    expect(banner).toHaveTextContent(A.path);
    expect(banner).toHaveTextContent(B.path);
  });

  it("dismissing one (by its button) silences only that path; the same-basename sibling stays", async () => {
    // Fresh array references each poll (mirrors production: no-store fetch →
    // new JSON.parse), so React actually re-renders on each poll.
    let call = 0;
    global.fetch = vi.fn().mockImplementation(() => {
      call++;
      return Promise.resolve({ ok: true, json: async () => [{ ...A }, { ...B }] });
    });
    render(<OrphansBanner />);
    await flushInitialPoll();

    // Dismiss A via its own button (the real user mechanism, keyed by abs path).
    // Two items share the data-testid `orphan-item-app`; pick A's by its path.
    const items = screen.getAllByTestId(`orphan-item-${A.name}`);
    const aItem = items.find((el) => el.textContent?.includes(A.path));
    expect(aItem).toBeDefined();
    // Target the dismiss button specifically (its aria-label), NOT the CopyButton
    // which also renders a <button> earlier in the item.
    const aDismiss = aItem?.querySelector<HTMLButtonElement>(
      `[data-testid="orphan-dismiss-${A.name}"]`,
    );
    expect(aDismiss).toBeTruthy();
    act(() => {
      (aDismiss as HTMLButtonElement).click();
    });

    // localStorage records A's path only.
    expect(localStorage.getItem(`mc:orphan-dismissed:${A.path}`)).toBe("1");
    expect(localStorage.getItem(`mc:orphan-dismissed:${B.path}`)).toBeNull();

    // After the next poll (new references) A stays hidden, B remains.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    });

    const banner = screen.getByTestId("orphans-banner");
    expect(banner).not.toHaveTextContent(A.path);
    expect(banner).toHaveTextContent(B.path);
    expect(call).toBeGreaterThanOrEqual(2);
  });
});
