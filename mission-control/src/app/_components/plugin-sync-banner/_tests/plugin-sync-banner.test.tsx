/**
 * WO-15-004 (Phase 2) — PluginSyncBanner refactored onto shared Banner (kind="drift")
 *
 * These tests verify the DR-057 refactor: PluginSyncBanner must be a *consumer* of
 * the shared Banner primitive, not a re-implementation with its own style blocks.
 *
 * AC coverage:
 *   AC-15-004.1 (REQ-15-001/002) — renders on drift=true with reason-appropriate copy
 *   AC-15-004.2 (REQ-15-004)     — renders nothing when drift=false or unknown; self-clears
 *   AC-15-004.3 (REQ-15-003)     — shows copyable `claude plugin update pandacorp@panda-corp`
 *   AC-15-004.4 (REQ-15-005)     — read-only: no non-GET fetch
 *   AC-15-004.5 (DR-057)         — renders through shared Banner (banner testid present);
 *                                    no own BANNER_STYLE/ICON_STYLE/CMD_ROW_STYLE/RECALL_STYLE
 *   AC-15-004.6                   — Spanish copy; state NOT conveyed by color alone (icon+text)
 *
 * Timer strategy: vi.useFakeTimers() + vi.advanceTimersByTimeAsync(0) drains the initial
 * async poll without triggering re-queued intervals.
 *
 * Stack: Vitest + @testing-library/react + jsdom; fake timers; global.fetch mocked.
 */

import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PluginSyncBanner } from "@/app/_components/plugin-sync-banner/plugin-sync-banner";
import type { PluginSyncState } from "@/lib/plugin-sync/plugin-sync";

// ---------------------------------------------------------------------------
// Fixtures
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
// vi.advanceTimersByTimeAsync(0) drains pending microtasks/Promise chains.
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
    global.fetch = vi.fn().mockReturnValue(new Promise(() => {}));
    render(<PluginSyncBanner />);
    expect(screen.queryByTestId("plugin-sync-banner")).not.toBeInTheDocument();
  });

  it("self-clears: banner disappears when re-poll returns drift=false", async () => {
    mockFetchSequence([UNCOMMITTED, IN_SYNC]);
    render(<PluginSyncBanner />);

    await flushInitialPoll();
    expect(screen.getByTestId("plugin-sync-banner")).toBeInTheDocument();

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
// AC-15-004.3 — command is shown + copyable via shared Banner command row
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

  it("renders the shared Banner command row for the update command", async () => {
    mockFetch(UNCOMMITTED);
    render(<PluginSyncBanner />);
    await flushInitialPoll();
    // The shared Banner renders data-testid="banner-cmd-row"
    expect(screen.getByTestId("banner-cmd-row")).toBeInTheDocument();
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

    // The shared Banner's copy button has data-testid="copy-button"
    const copyBtn = screen.getByTestId("copy-button");
    await act(async () => {
      copyBtn.click();
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(writeText).toHaveBeenCalledWith(POLL_CMD);
  });

  it("shows the recall sequence (commit→run→restart) via data-testid='plugin-sync-recall'", async () => {
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
// AC-15-004.5 — DR-057: renders through shared Banner; no own banner style blocks
// ---------------------------------------------------------------------------

describe("AC-15-004.5: DR-057 reuse — shared Banner consumer (no own style blocks)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("renders the shared Banner primitive (data-testid='banner' present)", async () => {
    mockFetch(UNCOMMITTED);
    render(<PluginSyncBanner />);
    await flushInitialPoll();
    // The shared Banner component renders data-testid="banner"
    expect(screen.getByTestId("banner")).toBeInTheDocument();
  });

  it("shared Banner has tone='warn' and kind='drift' (data attributes)", async () => {
    mockFetch(UNCOMMITTED);
    render(<PluginSyncBanner />);
    await flushInitialPoll();
    const banner = screen.getByTestId("banner");
    expect(banner).toHaveAttribute("data-tone", "warn");
    expect(banner).toHaveAttribute("data-kind", "drift");
  });

  it("banner wrapper has role=alert or aria-label in Spanish", async () => {
    mockFetch(UNCOMMITTED);
    render(<PluginSyncBanner />);
    await flushInitialPoll();
    const wrapper = screen.getByTestId("plugin-sync-banner");
    const hasAlert = wrapper.getAttribute("role") === "alert";
    const hasLabel = wrapper.getAttribute("aria-label") !== null;
    expect(hasAlert || hasLabel).toBe(true);
  });

  it("banner wrapper has no hardcoded hex/rgb/hsl color values (tokens only)", async () => {
    mockFetch(UNCOMMITTED);
    render(<PluginSyncBanner />);
    await flushInitialPoll();
    const wrapper = screen.getByTestId("plugin-sync-banner");
    const inlineStyle = wrapper.getAttribute("style") ?? "";
    expect(inlineStyle).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(inlineStyle).not.toMatch(/\brgb\(/);
    expect(inlineStyle).not.toMatch(/\bhsl\(/);
  });

  it("renders a warning icon via the shared Banner (data-testid='banner-icon')", async () => {
    mockFetch(UNCOMMITTED);
    render(<PluginSyncBanner />);
    await flushInitialPoll();
    expect(screen.getByTestId("banner-icon")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AC-15-004.6 — Spanish copy + state not by color alone
// ---------------------------------------------------------------------------

describe("AC-15-004.6: Spanish copy + a11y", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("banner heading/content is in Spanish — no bare English reason words", async () => {
    mockFetch(UNCOMMITTED);
    render(<PluginSyncBanner />);
    await flushInitialPoll();
    const banner = screen.getByTestId("plugin-sync-banner");
    expect(banner).toHaveTextContent(/plugin/i);
    expect(banner).not.toHaveTextContent(/out of sync/i);
    expect(banner).not.toHaveTextContent(/\buncommitted\b/i);
    expect(banner).not.toHaveTextContent(/\bbehind\b/i);
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
