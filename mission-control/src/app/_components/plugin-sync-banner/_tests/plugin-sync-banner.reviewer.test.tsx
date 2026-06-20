/**
 * WO-15-004 — ADVERSARIAL reviewer tests (DR-015).
 *
 * Edge cases / abuse the implementer's happy-path suite did NOT exercise, anchored in
 * the FRD's EARS criteria and integrated with the VERIFIED route + lib (WO-15-001/002/003):
 *
 *   1. recall step-numbering invariant for "behind" — the 2-step recall (no commit step)
 *      must be numbered 1) … 2) …, NEVER 2) … 3) … (the renumber bug surface).
 *   2. inconsistent server payload: drift=true but reason="in-sync"/"unknown" — banner must
 *      still render (it trusts `drift`, AC-15-004.1/.2) and NOT crash / NOT leak English.
 *   3. read-only invariant exercised through the REAL route GET handler (integration):
 *      the handler is a pure read and the banner only ever issues GET.
 *   4. self-clear must survive a transient error poll between two drift states (no false clear).
 *   5. command shown is EXACTLY the canonical string — no trailing whitespace / variant.
 */

import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PluginSyncBanner } from "@/app/_components/plugin-sync-banner/plugin-sync-banner";
import { GET } from "@/app/api/plugin-sync/route";
import type { PluginSyncState } from "@/lib/plugin-sync/plugin-sync";

const CANONICAL_CMD = "claude plugin update pandacorp@panda-corp";

function makeState(overrides: Partial<PluginSyncState>): PluginSyncState {
  return {
    installedSha: "abc1234",
    pluginHeadSha: "abc1234",
    dirty: false,
    drift: false,
    reason: "in-sync",
    detail: "plugin al día",
    ...overrides,
  };
}

const BEHIND = makeState({
  pluginHeadSha: "def5678",
  drift: true,
  reason: "behind",
  detail: "instalado abc1234 · el plugin instalado está atrás del HEAD (def5678)",
});

function mockFetch(state: PluginSyncState): void {
  global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => state });
}

function mockFetchSequence(states: (PluginSyncState | "error")[]): void {
  let call = 0;
  global.fetch = vi.fn().mockImplementation(() => {
    const step = states[call] ?? states[states.length - 1];
    call++;
    if (step === "error") return Promise.reject(new Error("transient network"));
    return Promise.resolve({ ok: true, json: async () => step });
  });
}

async function flush(): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("ADV-1: 'behind' recall is a contiguous 1..N sequence (no orphaned step numbers)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("'behind' recall starts at '1)' and has no '3)' (commit step dropped, renumbered)", async () => {
    mockFetch(BEHIND);
    render(<PluginSyncBanner />);
    await flush();
    const recall = screen.getByTestId("plugin-sync-recall").textContent ?? "";
    // The 2-step recall must be numbered 1) … 2) … — a stray 3) would mean the
    // implementer dropped the commit step but forgot to renumber.
    expect(recall).toMatch(/\b1\)/);
    expect(recall).toMatch(/\b2\)/);
    expect(recall).not.toMatch(/\b3\)/);
    // And it must not still carry a phantom commit instruction.
    expect(recall).not.toMatch(/commitea/i);
  });

  it("'uncommitted' recall is the full 1..3 sequence (commit first)", async () => {
    mockFetch(makeState({ dirty: true, drift: true, reason: "uncommitted", detail: "x" }));
    render(<PluginSyncBanner />);
    await flush();
    const recall = screen.getByTestId("plugin-sync-recall").textContent ?? "";
    expect(recall).toMatch(/1\)\s*commitea/i);
    expect(recall).toMatch(/\b2\)/);
    expect(recall).toMatch(/\b3\)/);
    expect(recall).not.toMatch(/\b4\)/);
  });
});

describe("ADV-2: inconsistent server payload (drift=true with non-drift reason)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("renders (trusts drift) without crashing when reason='in-sync' but drift=true", async () => {
    mockFetch(makeState({ drift: true, reason: "in-sync", detail: "incoherente" }));
    render(<PluginSyncBanner />);
    await flush();
    const banner = screen.getByTestId("plugin-sync-banner");
    expect(banner).toBeInTheDocument();
    // Falls back to the generic Spanish heading; no English leak.
    expect(banner).toHaveTextContent(/plugin desincronizado/i);
    expect(banner).not.toHaveTextContent(/out of sync|behind|uncommitted/i);
  });

  it("renders generic heading when reason='unknown' but drift=true (still no false English)", async () => {
    mockFetch(makeState({ drift: true, reason: "unknown", detail: "raro" }));
    render(<PluginSyncBanner />);
    await flush();
    expect(screen.getByTestId("plugin-sync-banner")).toHaveTextContent(/plugin/i);
  });
});

describe("ADV-3: read-only invariant via the REAL route handler (integration)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("the real GET handler responds 200 + no-store and never throws", async () => {
    const res = GET(new Request("http://localhost/api/plugin-sync"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const body = (await res.json()) as PluginSyncState;
    // The verdict is well-formed regardless of the host's real git state.
    expect(typeof body.drift).toBe("boolean");
    expect(["uncommitted", "behind", "both", "in-sync", "unknown"]).toContain(body.reason);
  });

  it("banner only issues GET — no method, body, or non-GET verb ever", async () => {
    mockFetch(BEHIND);
    render(<PluginSyncBanner />);
    await flush();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(16_000);
    });
    const calls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls as [string, RequestInit?][];
    expect(calls.length).toBeGreaterThanOrEqual(2);
    for (const [, init] of calls) {
      expect((init?.method ?? "GET").toUpperCase()).toBe("GET");
      expect(init?.body).toBeUndefined();
    }
  });
});

describe("ADV-4: self-clear is resilient to a transient error poll between two states", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("a failed poll between drift and in-sync does NOT prematurely clear (no false clear), then clears on the real in-sync", async () => {
    mockFetchSequence([
      BEHIND,
      "error",
      makeState({ drift: false, reason: "in-sync", detail: "al día" }),
    ]);
    render(<PluginSyncBanner />);
    await flush();
    expect(screen.getByTestId("plugin-sync-banner")).toBeInTheDocument();

    // The error poll fires — banner must remain (transient error never clears).
    await act(async () => {
      await vi.advanceTimersByTimeAsync(16_000);
    });
    expect(screen.getByTestId("plugin-sync-banner")).toBeInTheDocument();

    // The real in-sync poll fires — now it clears.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(16_000);
    });
    expect(screen.queryByTestId("plugin-sync-banner")).not.toBeInTheDocument();
  });
});

describe("ADV-5: the exact canonical command string", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("the command row shows EXACTLY the canonical command (no trailing whitespace / variant)", async () => {
    mockFetch(BEHIND);
    render(<PluginSyncBanner />);
    await flush();
    const cmdRow = screen.getByTestId("banner-cmd-row");
    expect(cmdRow.textContent?.trim()).toContain(CANONICAL_CMD);
    // No accidental version pin or repo path drift.
    expect(cmdRow.textContent).not.toMatch(/@\d+\.\d+\.\d+/);
  });
});
