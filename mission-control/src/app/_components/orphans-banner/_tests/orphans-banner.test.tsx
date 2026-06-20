/**
 * WO-16-004 — OrphansBanner (CMP-16-banner) — RED phase tests
 *
 * Written BEFORE the implementation. Every test is expected to fail until
 * `components/orphans-banner.tsx` exists and satisfies these contracts.
 *
 * Traceability:
 *   AC-16-004.1 (REQ-16-001) — orphan → shows name, path, /pandacorp:adopt steps
 *   AC-16-004.2 (REQ-16-003) — unlisted → shows /pandacorp:sync-portfolio (NOT adopt)
 *   AC-16-004.3 (REQ-16-002) — path + command shown as copyable text (CopyButton)
 *   AC-16-004.4 (REQ-16-004) — dismiss hides banner + persists across refresh (localStorage by path)
 *                               a candidate that disappears from the probe is gone on next poll
 *   AC-16-004.5 (REQ-16-005) — read-only: no non-GET fetch, no exec
 *   AC-16-004.6               — Spanish copy + aria-labels (DR-009); state not by color alone (FRD-13)
 *   AC-16-004.7               — empty candidate list → renders nothing (no empty shell)
 *
 * Timer strategy: vi.useFakeTimers() + vi.advanceTimersByTimeAsync(0) flushes the
 * initial mount poll (same pattern as PluginSyncBanner tests, WO-15-004).
 * Self-clear test: vi.advanceTimersByTimeAsync(POLL_INTERVAL) to fire the interval.
 *
 * Stack: Vitest + @testing-library/react + jsdom; fake timers; global.fetch mocked.
 */

import { act, cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OrphansBanner } from "@/app/_components/orphans-banner/orphans-banner";
import type { Candidate } from "@/lib/orphans/orphans";

// ---------------------------------------------------------------------------
// Fixtures — Candidate shapes
// ---------------------------------------------------------------------------

const ORPHAN_A: Candidate = {
  name: "my-app",
  path: "/Users/dev/projects/my-app",
  kind: "orphan",
  hasMarker: false,
  inPortfolio: false,
};

const ORPHAN_B: Candidate = {
  name: "another-project",
  path: "/Users/dev/projects/another-project",
  kind: "orphan",
  hasMarker: false,
  inPortfolio: false,
};

const UNLISTED_A: Candidate = {
  name: "known-project",
  path: "/Users/dev/projects/known-project",
  kind: "unlisted",
  hasMarker: true,
  inPortfolio: false,
};

// ---------------------------------------------------------------------------
// Fetch mock helpers
// ---------------------------------------------------------------------------

function mockFetch(candidates: Candidate[]): void {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => candidates,
  });
}

function mockFetchSequence(sequences: Candidate[][]): void {
  let call = 0;
  global.fetch = vi.fn().mockImplementation(() => {
    const candidates = sequences[call] ?? sequences[sequences.length - 1];
    call++;
    return Promise.resolve({
      ok: true,
      json: async () => candidates,
    });
  });
}

// ---------------------------------------------------------------------------
// Helper: flush the mount fetch (initial poll) without triggering the interval.
//
// See plugin-sync-banner.test.tsx for the rationale: the async poll is a chain
// of microtasks, and vi.advanceTimersByTimeAsync(0) flushes them all.
// ---------------------------------------------------------------------------

async function flushInitialPoll(): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}

// Poll interval must match the implementation (30 s per blueprint design;
// test uses a constant so it stays in sync if we change the implementation).
const POLL_INTERVAL_MS = 30_000;

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
  // Clear localStorage between tests so dismiss state does not bleed
  localStorage.clear();
});

// ---------------------------------------------------------------------------
// AC-16-004.1 — orphan candidate → shows name, path, /pandacorp:adopt steps
// ---------------------------------------------------------------------------

describe("AC-16-004.1: orphan candidate — shows name, path, adopt recall", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("renders the banner container when there is an orphan candidate", async () => {
    mockFetch([ORPHAN_A]);
    render(<OrphansBanner />);
    await flushInitialPoll();
    expect(screen.getByTestId("orphans-banner")).toBeInTheDocument();
  });

  it("shows the project name for an orphan", async () => {
    mockFetch([ORPHAN_A]);
    render(<OrphansBanner />);
    await flushInitialPoll();
    expect(screen.getByTestId("orphans-banner")).toHaveTextContent("my-app");
  });

  it("shows the project path for an orphan", async () => {
    mockFetch([ORPHAN_A]);
    render(<OrphansBanner />);
    await flushInitialPoll();
    expect(screen.getByTestId("orphan-path-my-app")).toBeInTheDocument();
    expect(screen.getByTestId("orphan-path-my-app")).toHaveTextContent(ORPHAN_A.path);
  });

  it("shows /pandacorp:adopt in the recall for an orphan", async () => {
    mockFetch([ORPHAN_A]);
    render(<OrphansBanner />);
    await flushInitialPoll();
    const banner = screen.getByTestId("orphan-item-my-app");
    expect(banner).toHaveTextContent("/pandacorp:adopt");
  });

  it("does NOT show /pandacorp:sync-portfolio for an orphan", async () => {
    mockFetch([ORPHAN_A]);
    render(<OrphansBanner />);
    await flushInitialPoll();
    const banner = screen.getByTestId("orphan-item-my-app");
    expect(banner).not.toHaveTextContent("/pandacorp:sync-portfolio");
  });

  it("renders one item per orphan candidate", async () => {
    mockFetch([ORPHAN_A, ORPHAN_B]);
    render(<OrphansBanner />);
    await flushInitialPoll();
    expect(screen.getByTestId("orphan-item-my-app")).toBeInTheDocument();
    expect(screen.getByTestId("orphan-item-another-project")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AC-16-004.2 — unlisted candidate → shows /pandacorp:sync-portfolio (NOT adopt)
// ---------------------------------------------------------------------------

describe("AC-16-004.2: unlisted candidate — shows sync-portfolio recall, NOT adopt", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("renders a banner for an unlisted candidate", async () => {
    mockFetch([UNLISTED_A]);
    render(<OrphansBanner />);
    await flushInitialPoll();
    expect(screen.getByTestId("orphans-banner")).toBeInTheDocument();
  });

  it("shows /pandacorp:sync-portfolio for an unlisted candidate", async () => {
    mockFetch([UNLISTED_A]);
    render(<OrphansBanner />);
    await flushInitialPoll();
    const item = screen.getByTestId("orphan-item-known-project");
    expect(item).toHaveTextContent("/pandacorp:sync-portfolio");
  });

  it("does NOT show /pandacorp:adopt for an unlisted candidate", async () => {
    mockFetch([UNLISTED_A]);
    render(<OrphansBanner />);
    await flushInitialPoll();
    const item = screen.getByTestId("orphan-item-known-project");
    expect(item).not.toHaveTextContent("/pandacorp:adopt");
  });

  it("shows the project path for an unlisted candidate", async () => {
    mockFetch([UNLISTED_A]);
    render(<OrphansBanner />);
    await flushInitialPoll();
    const item = screen.getByTestId("orphan-item-known-project");
    expect(item).toHaveTextContent(UNLISTED_A.path);
  });
});

// ---------------------------------------------------------------------------
// AC-16-004.3 — path and command shown as copyable text (CopyButton copies the command)
// ---------------------------------------------------------------------------

describe("AC-16-004.3: path + command as copyable text", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      writable: true,
      configurable: true,
    });
  });

  it("shows the path as selectable text for an orphan", async () => {
    mockFetch([ORPHAN_A]);
    render(<OrphansBanner />);
    await flushInitialPoll();
    expect(screen.getByTestId("orphan-path-my-app")).toHaveTextContent(ORPHAN_A.path);
  });

  it("renders a copy button for the adopt command", async () => {
    mockFetch([ORPHAN_A]);
    render(<OrphansBanner />);
    await flushInitialPoll();
    expect(screen.getByTestId("orphan-copy-cmd-my-app")).toBeInTheDocument();
  });

  it("copy button inside orphan item writes /pandacorp:adopt to clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      writable: true,
      configurable: true,
    });

    mockFetch([ORPHAN_A]);
    render(<OrphansBanner />);
    await flushInitialPoll();

    const wrapper = screen.getByTestId("orphan-copy-cmd-my-app");
    const copyBtn = within(wrapper).getByTestId("copy-button");
    await act(async () => {
      copyBtn.click();
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(writeText).toHaveBeenCalledWith("/pandacorp:adopt");
  });

  it("copy button inside unlisted item writes /pandacorp:sync-portfolio to clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      writable: true,
      configurable: true,
    });

    mockFetch([UNLISTED_A]);
    render(<OrphansBanner />);
    await flushInitialPoll();

    const wrapper = screen.getByTestId("orphan-copy-cmd-known-project");
    const copyBtn = within(wrapper).getByTestId("copy-button");
    await act(async () => {
      copyBtn.click();
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(writeText).toHaveBeenCalledWith("/pandacorp:sync-portfolio");
  });
});

// ---------------------------------------------------------------------------
// AC-16-004.4 — dismiss hides + persists; self-clears when candidate disappears
// ---------------------------------------------------------------------------

describe("AC-16-004.4: dismiss + self-clear", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("clicking dismiss hides that banner item", async () => {
    mockFetch([ORPHAN_A]);
    render(<OrphansBanner />);
    await flushInitialPoll();

    const dismissBtn = screen.getByTestId("orphan-dismiss-my-app");
    await act(async () => {
      dismissBtn.click();
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(screen.queryByTestId("orphan-item-my-app")).not.toBeInTheDocument();
  });

  it("dismissal is persisted in localStorage keyed by path", async () => {
    mockFetch([ORPHAN_A]);
    render(<OrphansBanner />);
    await flushInitialPoll();

    const dismissBtn = screen.getByTestId("orphan-dismiss-my-app");
    await act(async () => {
      dismissBtn.click();
      await vi.advanceTimersByTimeAsync(0);
    });

    // Some localStorage key containing the path must exist
    const keys = Object.keys(localStorage);
    const found = keys.some(
      (k) =>
        localStorage.getItem(k) !== null &&
        (k.includes(ORPHAN_A.path) || localStorage.getItem(k)?.includes(ORPHAN_A.path)),
    );
    expect(found).toBe(true);
  });

  it("dismissed banner stays hidden after re-mount (localStorage persists)", async () => {
    mockFetch([ORPHAN_A]);
    const { unmount } = render(<OrphansBanner />);
    await flushInitialPoll();

    const dismissBtn = screen.getByTestId("orphan-dismiss-my-app");
    await act(async () => {
      dismissBtn.click();
      await vi.advanceTimersByTimeAsync(0);
    });

    unmount();

    // Re-mount with the same candidate still returned from the API
    mockFetch([ORPHAN_A]);
    render(<OrphansBanner />);
    await flushInitialPoll();

    // Still hidden — dismissal was persisted
    expect(screen.queryByTestId("orphan-item-my-app")).not.toBeInTheDocument();
  });

  it("dismissing one candidate does not hide other candidates", async () => {
    mockFetch([ORPHAN_A, ORPHAN_B]);
    render(<OrphansBanner />);
    await flushInitialPoll();

    const dismissBtn = screen.getByTestId("orphan-dismiss-my-app");
    await act(async () => {
      dismissBtn.click();
      await vi.advanceTimersByTimeAsync(0);
    });

    // ORPHAN_A hidden, ORPHAN_B still visible
    expect(screen.queryByTestId("orphan-item-my-app")).not.toBeInTheDocument();
    expect(screen.getByTestId("orphan-item-another-project")).toBeInTheDocument();
  });

  it("self-clears: candidate that disappears from probe is gone on next poll", async () => {
    // First poll returns [ORPHAN_A]; second poll returns []
    mockFetchSequence([[ORPHAN_A], []]);
    render(<OrphansBanner />);

    await flushInitialPoll();
    expect(screen.getByTestId("orphan-item-my-app")).toBeInTheDocument();

    // Advance past the poll interval
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS + 1_000);
    });

    expect(screen.queryByTestId("orphan-item-my-app")).not.toBeInTheDocument();
  });

  it("re-appeared candidate (not dismissed) shows again on next poll", async () => {
    // First poll returns []; second poll returns [ORPHAN_A] (re-appeared somehow)
    mockFetchSequence([[], [ORPHAN_A]]);
    render(<OrphansBanner />);

    await flushInitialPoll();
    expect(screen.queryByTestId("orphan-item-my-app")).not.toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS + 1_000);
    });

    expect(screen.getByTestId("orphan-item-my-app")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AC-16-004.5 — read-only: no non-GET fetch, no exec
// ---------------------------------------------------------------------------

describe("AC-16-004.5: read-only — only GET /api/orphans, no writes", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("fetches only /api/orphans with GET", async () => {
    mockFetch([ORPHAN_A]);
    render(<OrphansBanner />);
    await flushInitialPoll();
    const calls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls as [string, RequestInit?][];
    expect(calls.length).toBeGreaterThan(0);
    for (const [url, init] of calls) {
      expect(url).toContain("/api/orphans");
      const method = init?.method?.toUpperCase() ?? "GET";
      expect(method).toBe("GET");
    }
  });

  it("does not call fetch with POST/PUT/DELETE/PATCH", async () => {
    mockFetch([ORPHAN_A]);
    render(<OrphansBanner />);
    await flushInitialPoll();
    const calls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls as [string, RequestInit?][];
    for (const [, init] of calls) {
      const method = (init?.method ?? "GET").toUpperCase();
      expect(["GET"]).toContain(method);
    }
  });
});

// ---------------------------------------------------------------------------
// AC-16-004.6 — Spanish copy + aria-labels (DR-009); state not by color alone (FRD-13)
// ---------------------------------------------------------------------------

describe("AC-16-004.6: Spanish copy + a11y", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("banner has an aria-label in Spanish", async () => {
    mockFetch([ORPHAN_A]);
    render(<OrphansBanner />);
    await flushInitialPoll();
    const banner = screen.getByTestId("orphans-banner");
    const ariaLabel = banner.getAttribute("aria-label");
    expect(ariaLabel).toBeTruthy();
    // Should be in Spanish (not empty)
    expect(ariaLabel?.length).toBeGreaterThan(0);
  });

  it("dismiss button has an accessible aria-label in Spanish", async () => {
    mockFetch([ORPHAN_A]);
    render(<OrphansBanner />);
    await flushInitialPoll();
    const dismissBtn = screen.getByTestId("orphan-dismiss-my-app");
    const ariaLabel = dismissBtn.getAttribute("aria-label");
    expect(ariaLabel).toBeTruthy();
    expect(ariaLabel?.length).toBeGreaterThan(0);
  });

  it("orphan banner copy mentions 'adoptar' or 'adopt' or 'registrar' (Spanish descriptive text)", async () => {
    mockFetch([ORPHAN_A]);
    render(<OrphansBanner />);
    await flushInitialPoll();
    const item = screen.getByTestId("orphan-item-my-app");
    // Should have some Spanish descriptive copy about the action
    expect(item).toHaveTextContent(/adopt|registr|project/i);
  });

  it("unlisted banner copy mentions 'portfolio' or 'sync' or 'marcador'", async () => {
    mockFetch([UNLISTED_A]);
    render(<OrphansBanner />);
    await flushInitialPoll();
    const item = screen.getByTestId("orphan-item-known-project");
    expect(item).toHaveTextContent(/portfolio|sync|marcador/i);
  });

  it("banner has an icon or non-color indicator (state not by color alone)", async () => {
    mockFetch([ORPHAN_A]);
    render(<OrphansBanner />);
    await flushInitialPoll();
    // Icon element must exist to convey state without relying solely on color (FRD-13)
    expect(screen.getByTestId("orphan-icon")).toBeInTheDocument();
  });

  it("renders nothing before the first fetch resolves", () => {
    global.fetch = vi.fn().mockReturnValue(new Promise(() => {}));
    render(<OrphansBanner />);
    // Synchronously: nothing rendered
    expect(screen.queryByTestId("orphans-banner")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AC-16-004.7 — empty candidate list → renders nothing (no empty shell)
// ---------------------------------------------------------------------------

describe("AC-16-004.7: empty candidate list → renders nothing", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("renders nothing when API returns an empty array", async () => {
    mockFetch([]);
    render(<OrphansBanner />);
    await flushInitialPoll();
    expect(screen.queryByTestId("orphans-banner")).not.toBeInTheDocument();
  });

  it("renders nothing when all candidates are dismissed", async () => {
    mockFetch([ORPHAN_A]);
    render(<OrphansBanner />);
    await flushInitialPoll();

    const dismissBtn = screen.getByTestId("orphan-dismiss-my-app");
    await act(async () => {
      dismissBtn.click();
      await vi.advanceTimersByTimeAsync(0);
    });

    // Root wrapper should be gone (AC-16-004.7: no empty shell)
    expect(screen.queryByTestId("orphans-banner")).not.toBeInTheDocument();
  });

  it("renders nothing before first fetch completes", () => {
    global.fetch = vi.fn().mockReturnValue(new Promise(() => {}));
    render(<OrphansBanner />);
    expect(screen.queryByTestId("orphans-banner")).not.toBeInTheDocument();
  });

  it("renders nothing when fetch fails (network error — no false alarm)", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));
    render(<OrphansBanner />);
    await flushInitialPoll();
    expect(screen.queryByTestId("orphans-banner")).not.toBeInTheDocument();
  });

  it("renders nothing when fetch returns non-ok status", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => [],
    });
    render(<OrphansBanner />);
    await flushInitialPoll();
    expect(screen.queryByTestId("orphans-banner")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AC-16-004.7 (DR-057) — Banner consumer contract: uses the shared Banner primitive
// The component must NOT re-declare BANNER_STYLE/ICON_STYLE/CMD_ROW_STYLE/RECALL_STYLE.
// Verified structurally: the shared Banner's data-testid="banner" must be present inside
// the orphans-banner wrapper (proves delegation, not re-implementation).
// ---------------------------------------------------------------------------

describe("AC-16-004.7 (DR-057): is a consumer of the shared Banner, not a re-implementation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("renders the shared Banner primitive (data-testid='banner' present inside orphans-banner)", async () => {
    mockFetch([ORPHAN_A]);
    render(<OrphansBanner />);
    await flushInitialPoll();
    const wrapper = screen.getByTestId("orphans-banner");
    // The shared Banner component renders data-testid="banner" — must be inside our wrapper
    expect(wrapper.querySelector('[data-testid="banner"]')).not.toBeNull();
  });

  it("renders a warning icon via the shared Banner (data-testid='banner-icon' present)", async () => {
    mockFetch([ORPHAN_A]);
    render(<OrphansBanner />);
    await flushInitialPoll();
    // Banner renders data-testid="banner-icon" on the ToneIcon SVG
    expect(screen.getByTestId("banner-icon")).toBeInTheDocument();
  });

  it("has data-kind='orphan' on the Banner element (kind prop passed)", async () => {
    mockFetch([ORPHAN_A]);
    render(<OrphansBanner />);
    await flushInitialPoll();
    const bannerEl = screen.getByTestId("banner");
    expect(bannerEl).toHaveAttribute("data-kind", "orphan");
  });

  it("has data-tone='warn' on the Banner element (warn tone passed)", async () => {
    mockFetch([ORPHAN_A]);
    render(<OrphansBanner />);
    await flushInitialPoll();
    const bannerEl = screen.getByTestId("banner");
    expect(bannerEl).toHaveAttribute("data-tone", "warn");
  });
});

// ---------------------------------------------------------------------------
// FRD-16 collapse criterion — >2 candidates collapse behind a toggle
// (the wall-of-banners regression: several orphans must not dominate the dashboard)
// ---------------------------------------------------------------------------

const ORPHAN_C: Candidate = {
  name: "third-project",
  path: "/Users/dev/projects/third-project",
  kind: "orphan",
  hasMarker: false,
  inPortfolio: false,
};

describe("FRD-16 collapse: more than two candidates collapse behind a toggle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("shows only the first two items and a toggle when there are three candidates", async () => {
    mockFetch([ORPHAN_A, ORPHAN_B, ORPHAN_C]);
    render(<OrphansBanner />);
    await flushInitialPoll();
    expect(screen.getByTestId("orphan-item-my-app")).toBeInTheDocument();
    expect(screen.getByTestId("orphan-item-another-project")).toBeInTheDocument();
    expect(screen.queryByTestId("orphan-item-third-project")).not.toBeInTheDocument();
    expect(screen.getByTestId("orphans-toggle")).toHaveTextContent("1");
  });

  it("expands to show every candidate when the toggle is activated", async () => {
    mockFetch([ORPHAN_A, ORPHAN_B, ORPHAN_C]);
    render(<OrphansBanner />);
    await flushInitialPoll();
    await act(async () => {
      screen.getByTestId("orphans-toggle").click();
    });
    expect(screen.getByTestId("orphan-item-third-project")).toBeInTheDocument();
    expect(screen.getByTestId("orphans-toggle")).toHaveTextContent("Ver menos");
  });

  it("does NOT render a toggle when there are two or fewer candidates", async () => {
    mockFetch([ORPHAN_A, ORPHAN_B]);
    render(<OrphansBanner />);
    await flushInitialPoll();
    expect(screen.queryByTestId("orphans-toggle")).not.toBeInTheDocument();
  });
});
