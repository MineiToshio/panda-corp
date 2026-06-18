/**
 * WO-15-004 — PluginSyncBanner (CMP-15-banner) — RED phase tests
 *
 * Written BEFORE the implementation. Every test is expected to fail until
 * `components/plugin-sync-banner.tsx` exists and satisfies these contracts.
 *
 * Traceability:
 *   AC-15-004.1 (REQ-15-001/002) — renders on drift=true with reason-appropriate copy
 *   AC-15-004.2 (REQ-15-004)     — renders nothing when drift=false or unknown; self-clears on re-poll
 *   AC-15-004.3 (REQ-15-003)     — shows copyable `claude plugin update pandacorp@panda-corp`
 *   AC-15-004.4 (REQ-15-005)     — read-only: no non-GET fetch, no exec
 *   AC-15-004.5                   — all copy is Spanish; state NOT conveyed by color alone (icon+text)
 *
 * Blueprint §3: component polls `/api/plugin-sync` on mount + on an interval;
 * renders nothing unless drift=true; self-clears when re-poll returns drift=false.
 *
 * Timer strategy: vi.useFakeTimers() + vi.runOnlyPendingTimersAsync() flushes only
 * the currently queued microtasks/timers without triggering the setInterval loop again.
 * This avoids the "10 000 timers infinite loop" error that vi.runAllTimersAsync() causes
 * when a setInterval keeps re-scheduling itself.
 *
 * Stack: Vitest + @testing-library/react + jsdom; fake timers; global.fetch mocked.
 */

import { act, cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PluginSyncBanner } from "@/app/_components/plugin-sync-banner/plugin-sync-banner";
import type { PluginSyncState } from "@/lib/plugin-sync/plugin-sync";

// ---------------------------------------------------------------------------
// Fixtures — PluginSyncState shapes
// ---------------------------------------------------------------------------

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

const UNCOMMITTED: PluginSyncState = makeState({
  dirty: true,
  drift: true,
  reason: "uncommitted",
  detail: "instalado abc1234 · hay cambios sin commitear",
});

const BEHIND: PluginSyncState = makeState({
  installedSha: "abc1234",
  pluginHeadSha: "def5678",
  dirty: false,
  drift: true,
  reason: "behind",
  detail: "instalado abc1234 · el plugin instalado está atrás del HEAD (def5678)",
});

const BOTH: PluginSyncState = makeState({
  installedSha: "abc1234",
  pluginHeadSha: "def5678",
  dirty: true,
  drift: true,
  reason: "both",
  detail: "instalado abc1234 · atrás del HEAD y hay cambios sin commitear",
});

const IN_SYNC: PluginSyncState = makeState({
  drift: false,
  reason: "in-sync",
  detail: "plugin al día",
});

const UNKNOWN: PluginSyncState = makeState({
  installedSha: null,
  pluginHeadSha: null,
  dirty: false,
  drift: false,
  reason: "unknown",
  detail: "estado desconocido (plugin no instalado o repo no disponible)",
});

// ---------------------------------------------------------------------------
// Fetch mock helpers
// ---------------------------------------------------------------------------

const POLL_CMD = "claude plugin update pandacorp@panda-corp";

function mockFetch(state: PluginSyncState): void {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => state,
  });
}

function mockFetchSequence(states: PluginSyncState[]): void {
  let call = 0;
  global.fetch = vi.fn().mockImplementation(() => {
    const state = states[call] ?? states[states.length - 1];
    call++;
    return Promise.resolve({
      ok: true,
      json: async () => state,
    });
  });
}

// ---------------------------------------------------------------------------
// Helper: flush the mount fetch (initial poll) without triggering the interval.
//
// The initial `poll()` is called via `void poll()` inside useEffect — it's an
// async function that chains: fetch → .json() → setState. All three steps are
// microtasks/Promise continuations, not macrotask timers, so runOnlyPendingTimers
// alone won't flush them. vi.advanceTimersByTimeAsync(0) advances fake time by 0ms
// (firing any timers due at t=0) AND flushes all pending microtasks/Promise chains,
// which is exactly what drains the initial poll.
// ---------------------------------------------------------------------------

async function flushInitialPoll(): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// AC-15-004.1 — renders banner on drift=true with reason-appropriate copy
// ---------------------------------------------------------------------------

describe("AC-15-004.1: renders on drift === true", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("renders the banner when reason is 'uncommitted'", async () => {
    mockFetch(UNCOMMITTED);
    render(<PluginSyncBanner />);
    await flushInitialPoll();
    expect(screen.getByTestId("plugin-sync-banner")).toBeInTheDocument();
  });

  it("renders the banner when reason is 'behind'", async () => {
    mockFetch(BEHIND);
    render(<PluginSyncBanner />);
    await flushInitialPoll();
    expect(screen.getByTestId("plugin-sync-banner")).toBeInTheDocument();
  });

  it("renders the banner when reason is 'both'", async () => {
    mockFetch(BOTH);
    render(<PluginSyncBanner />);
    await flushInitialPoll();
    expect(screen.getByTestId("plugin-sync-banner")).toBeInTheDocument();
  });

  it("shows 'uncommitted' copy when reason is 'uncommitted'", async () => {
    mockFetch(UNCOMMITTED);
    render(<PluginSyncBanner />);
    await flushInitialPoll();
    const banner = screen.getByTestId("plugin-sync-banner");
    expect(banner).toHaveTextContent(/sin commitear/i);
  });

  it("shows 'behind' copy when reason is 'behind'", async () => {
    mockFetch(BEHIND);
    render(<PluginSyncBanner />);
    await flushInitialPoll();
    const banner = screen.getByTestId("plugin-sync-banner");
    expect(banner).toHaveTextContent(/atrás/i);
  });

  it("shows 'both' copy when reason is 'both' (dirty+behind)", async () => {
    mockFetch(BOTH);
    render(<PluginSyncBanner />);
    await flushInitialPoll();
    const banner = screen.getByTestId("plugin-sync-banner");
    // "both" is dirty + behind → recall must mention commitear
    expect(banner).toHaveTextContent(/commitea/i);
  });

  it("shows the detail string from the state", async () => {
    mockFetch(UNCOMMITTED);
    render(<PluginSyncBanner />);
    await flushInitialPoll();
    const banner = screen.getByTestId("plugin-sync-banner");
    expect(banner).toHaveTextContent(UNCOMMITTED.detail);
  });
});

// ---------------------------------------------------------------------------
// AC-15-004.2 — renders nothing when drift=false or unknown; self-clears
// ---------------------------------------------------------------------------

describe("AC-15-004.2: renders nothing when drift === false / unknown", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("renders nothing when reason is 'in-sync'", async () => {
    mockFetch(IN_SYNC);
    render(<PluginSyncBanner />);
    await flushInitialPoll();
    expect(screen.queryByTestId("plugin-sync-banner")).not.toBeInTheDocument();
  });

  it("renders nothing when reason is 'unknown'", async () => {
    mockFetch(UNKNOWN);
    render(<PluginSyncBanner />);
    await flushInitialPoll();
    expect(screen.queryByTestId("plugin-sync-banner")).not.toBeInTheDocument();
  });

  it("renders nothing before the first fetch resolves", () => {
    // fetch never resolves (pending promise)
    global.fetch = vi.fn().mockReturnValue(new Promise(() => {}));
    render(<PluginSyncBanner />);
    // Synchronously check — no banner until we know the state
    expect(screen.queryByTestId("plugin-sync-banner")).not.toBeInTheDocument();
  });

  it("self-clears: banner disappears when re-poll returns drift=false", async () => {
    // Sequence: first call → drift=true; second call → in-sync
    mockFetchSequence([UNCOMMITTED, IN_SYNC]);
    render(<PluginSyncBanner />);

    // First poll resolves — banner should appear
    await flushInitialPoll();
    expect(screen.getByTestId("plugin-sync-banner")).toBeInTheDocument();

    // Advance past the poll interval (15 s) so the second fetch fires + drain microtasks
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });
    expect(screen.queryByTestId("plugin-sync-banner")).not.toBeInTheDocument();
  });

  it("self-clears: banner disappears when re-poll returns unknown (no false alarm)", async () => {
    mockFetchSequence([BEHIND, UNKNOWN]);
    render(<PluginSyncBanner />);

    await flushInitialPoll();
    expect(screen.getByTestId("plugin-sync-banner")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });
    expect(screen.queryByTestId("plugin-sync-banner")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AC-15-004.3 — command is shown + copyable via CopyButton
// ---------------------------------------------------------------------------

describe("AC-15-004.3: copyable update command present", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      writable: true,
      configurable: true,
    });
  });

  it("shows the exact update command in the banner", async () => {
    mockFetch(UNCOMMITTED);
    render(<PluginSyncBanner />);
    await flushInitialPoll();
    const banner = screen.getByTestId("plugin-sync-banner");
    expect(banner).toHaveTextContent(POLL_CMD);
  });

  it("renders a copy button for the update command", async () => {
    mockFetch(UNCOMMITTED);
    render(<PluginSyncBanner />);
    await flushInitialPoll();
    expect(screen.getByTestId("plugin-sync-copy-cmd")).toBeInTheDocument();
  });

  it("clicking the copy button writes the command to the clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      writable: true,
      configurable: true,
    });

    mockFetch(UNCOMMITTED);
    render(<PluginSyncBanner />);
    await flushInitialPoll();

    // plugin-sync-copy-cmd is a wrapper span; the actual <button> is inside it.
    // Use fireEvent (synchronous) so we stay within fake-timer context — userEvent
    // uses real async timers internally which conflict with vi.useFakeTimers().
    const wrapper = screen.getByTestId("plugin-sync-copy-cmd");
    const copyBtn = within(wrapper).getByTestId("copy-button");
    await act(async () => {
      copyBtn.click();
      // Drain the clipboard writeText Promise microtask
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(writeText).toHaveBeenCalledWith(POLL_CMD);
  });

  it("shows the 3-step recall sequence (commit→run→restart)", async () => {
    mockFetch(UNCOMMITTED);
    render(<PluginSyncBanner />);
    await flushInitialPoll();
    expect(screen.getByTestId("plugin-sync-recall")).toBeInTheDocument();
  });

  it("recall mentions 'commitea' when reason is uncommitted", async () => {
    mockFetch(UNCOMMITTED);
    render(<PluginSyncBanner />);
    await flushInitialPoll();
    const recall = screen.getByTestId("plugin-sync-recall");
    expect(recall).toHaveTextContent(/commitea/i);
  });

  it("recall mentions 'commitea' when reason is both", async () => {
    mockFetch(BOTH);
    render(<PluginSyncBanner />);
    await flushInitialPoll();
    const recall = screen.getByTestId("plugin-sync-recall");
    expect(recall).toHaveTextContent(/commitea/i);
  });

  it("recall does NOT mention 'commitea' when reason is 'behind'", async () => {
    mockFetch(BEHIND);
    render(<PluginSyncBanner />);
    await flushInitialPoll();
    const recall = screen.getByTestId("plugin-sync-recall");
    expect(recall).not.toHaveTextContent(/commitea/i);
  });
});

// ---------------------------------------------------------------------------
// AC-15-004.4 — read-only: no writes, no execution
// ---------------------------------------------------------------------------

describe("AC-15-004.4: read-only — only GET, no writes", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("fetches only /api/plugin-sync with GET", async () => {
    mockFetch(UNCOMMITTED);
    render(<PluginSyncBanner />);
    await flushInitialPoll();
    const calls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls as [string, RequestInit?][];
    expect(calls.length).toBeGreaterThan(0);
    for (const [url, init] of calls) {
      expect(url).toContain("/api/plugin-sync");
      // No method override (defaults to GET) or explicit GET only
      const method = init?.method?.toUpperCase() ?? "GET";
      expect(method).toBe("GET");
    }
  });

  it("does not call fetch with POST/PUT/DELETE/PATCH", async () => {
    mockFetch(UNCOMMITTED);
    render(<PluginSyncBanner />);
    await flushInitialPoll();
    const calls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls as [string, RequestInit?][];
    for (const [, init] of calls) {
      const method = (init?.method ?? "GET").toUpperCase();
      expect(["GET"]).toContain(method);
    }
  });
});

// ---------------------------------------------------------------------------
// AC-15-004.5 — Spanish copy + state not conveyed by color alone
// ---------------------------------------------------------------------------

describe("AC-15-004.5: Spanish copy + a11y (icon+text, aria-label)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("banner heading/label is in Spanish", async () => {
    mockFetch(UNCOMMITTED);
    render(<PluginSyncBanner />);
    await flushInitialPoll();
    const banner = screen.getByTestId("plugin-sync-banner");
    // Presence of Spanish words (no English alarm words)
    expect(banner).toHaveTextContent(/plugin/i);
    expect(banner).not.toHaveTextContent(/out of sync/i);
    expect(banner).not.toHaveTextContent(/\buncommitted\b/i);
    expect(banner).not.toHaveTextContent(/\bbehind\b/i);
  });

  it("renders an alert icon (not just color) for a11y — icon testid present", async () => {
    mockFetch(UNCOMMITTED);
    render(<PluginSyncBanner />);
    await flushInitialPoll();
    expect(screen.getByTestId("plugin-sync-icon")).toBeInTheDocument();
  });

  it("banner has role=alert or aria-label in Spanish", async () => {
    mockFetch(UNCOMMITTED);
    render(<PluginSyncBanner />);
    await flushInitialPoll();
    const banner = screen.getByTestId("plugin-sync-banner");
    // Either role=alert or aria-label must be present
    const hasAlert = banner.getAttribute("role") === "alert";
    const hasLabel = banner.getAttribute("aria-label") !== null;
    expect(hasAlert || hasLabel).toBe(true);
  });

  it("has no hardcoded color style values (uses CSS vars only)", async () => {
    mockFetch(UNCOMMITTED);
    render(<PluginSyncBanner />);
    await flushInitialPoll();
    const banner = screen.getByTestId("plugin-sync-banner");
    const inlineStyle = banner.getAttribute("style") ?? "";
    // Must not contain a raw hex or bare rgb()/hsl() values
    expect(inlineStyle).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(inlineStyle).not.toMatch(/\brgb\(/);
    expect(inlineStyle).not.toMatch(/\bhsl\(/);
    // oklch() only allowed inside var() fallbacks — any bare oklch is a token value
    // The style string for a CSS var fallback looks like: var(--color-warn, oklch(...))
    // We just verify no hardcoded hex or rgb; oklch fallbacks inside var() are fine
  });
});

// ---------------------------------------------------------------------------
// Polling — mount triggers an immediate fetch, interval keeps polling
// ---------------------------------------------------------------------------

describe("polling behaviour", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("polls /api/plugin-sync immediately on mount", async () => {
    mockFetch(IN_SYNC);
    render(<PluginSyncBanner />);
    await flushInitialPoll();
    expect(global.fetch).toHaveBeenCalledWith("/api/plugin-sync");
  });

  it("polls again after the interval elapses", async () => {
    mockFetch(IN_SYNC);
    render(<PluginSyncBanner />);
    await flushInitialPoll();
    const firstCount = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.length;

    // Advance past 15 s poll interval + drain microtasks
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });
    const secondCount = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.length;
    expect(secondCount).toBeGreaterThan(firstCount);
  });

  it("clears the polling interval on unmount (no fetch after unmount)", async () => {
    mockFetch(IN_SYNC);
    const { unmount } = render(<PluginSyncBanner />);
    await flushInitialPoll();
    unmount();

    const countAtUnmount = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.length;
    // Advance well past multiple intervals — no additional fetches should fire
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    const countAfterUnmount = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.length;
    expect(countAfterUnmount).toBe(countAtUnmount);
  });

  it("does not crash when fetch throws (network error)", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("network error"));
    render(<PluginSyncBanner />);
    await flushInitialPoll();
    // Banner should simply not be shown (no false alarm)
    expect(screen.queryByTestId("plugin-sync-banner")).not.toBeInTheDocument();
  });

  it("does not crash when fetch returns non-ok response", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({}),
    });
    render(<PluginSyncBanner />);
    await flushInitialPoll();
    expect(screen.queryByTestId("plugin-sync-banner")).not.toBeInTheDocument();
  });
});
