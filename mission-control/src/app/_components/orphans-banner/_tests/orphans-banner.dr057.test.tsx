/**
 * WO-16-004 — AC-16-004.7 structural (DR-057) tests
 *
 * Verifies that OrphansBanner is a *consumer* of the shared Banner primitive
 * (kind="orphan"), not a re-implementation with local BANNER_STYLE/ICON_STYLE/
 * CMD_ROW_STYLE/RECALL_STYLE blocks (AC-16-004.7 / DR-057).
 *
 * These tests are RED until the refactor is complete.
 *
 * Traceability:
 *   AC-16-004.7 (DR-057) — no local BANNER_STYLE/ICON_STYLE/CMD_ROW_STYLE/RECALL_STYLE;
 *                           consumer of shared Banner (data-testid="banner", data-kind="orphan");
 *                           icon provided by Banner (data-testid="banner-icon")
 */

import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OrphansBanner } from "@/app/_components/orphans-banner/orphans-banner";
import type { Candidate } from "@/lib/orphans/orphans";

const ORPHAN_A: Candidate = {
  name: "my-app",
  path: "/Users/dev/projects/my-app",
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

function mockFetch(candidates: Candidate[]): void {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => candidates,
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

describe("AC-16-004.7 (DR-057) — Banner consumer structure", () => {
  it("renders the shared Banner (data-testid='banner') as its chrome, not a local re-implementation", async () => {
    mockFetch([ORPHAN_A]);
    render(<OrphansBanner />);
    await flushInitialPoll();
    // The shared Banner primitive MUST be present
    expect(screen.getByTestId("banner")).toBeInTheDocument();
  });

  it("uses kind='orphan' on the shared Banner (identifying this as the CMP-16-banner consumer)", async () => {
    mockFetch([ORPHAN_A]);
    render(<OrphansBanner />);
    await flushInitialPoll();
    const banner = screen.getByTestId("banner");
    expect(banner).toHaveAttribute("data-kind", "orphan");
  });

  it("uses tone='warn' on the shared Banner", async () => {
    mockFetch([ORPHAN_A]);
    render(<OrphansBanner />);
    await flushInitialPoll();
    const banner = screen.getByTestId("banner");
    expect(banner).toHaveAttribute("data-tone", "warn");
  });

  it("the icon is provided by the shared Banner (data-testid='banner-icon'), not a local orphan-icon duplicate", async () => {
    mockFetch([ORPHAN_A]);
    render(<OrphansBanner />);
    await flushInitialPoll();
    // The Banner provides the icon with its own testid
    expect(screen.getByTestId("banner-icon")).toBeInTheDocument();
  });

  it("the dismiss × is provided by the shared Banner (data-testid='banner-dismiss')", async () => {
    mockFetch([ORPHAN_A]);
    render(<OrphansBanner />);
    await flushInitialPoll();
    // shared Banner's dismissible prop renders data-testid="banner-dismiss"
    expect(screen.getByTestId("banner-dismiss")).toBeInTheDocument();
  });

  it("collapse overflow toggle is scoped inside the shared Banner (orphans-toggle within banner)", async () => {
    const ORPHAN_B: Candidate = {
      name: "second-project",
      path: "/Users/dev/projects/second-project",
      kind: "orphan",
      hasMarker: false,
      inPortfolio: false,
    };
    const ORPHAN_C: Candidate = {
      name: "third-project",
      path: "/Users/dev/projects/third-project",
      kind: "orphan",
      hasMarker: false,
      inPortfolio: false,
    };
    mockFetch([ORPHAN_A, ORPHAN_B, ORPHAN_C]);
    render(<OrphansBanner />);
    await flushInitialPoll();
    // The overflow toggle must exist and must be nested inside the shared Banner
    const banner = screen.getByTestId("banner");
    const toggle = screen.getByTestId("orphans-toggle");
    expect(banner).toContainElement(toggle);
  });

  it("renders a Chip (data-testid='chip') for each item to convey orphan vs unlisted case", async () => {
    mockFetch([ORPHAN_A]);
    render(<OrphansBanner />);
    await flushInitialPoll();
    // Per-item Chip: "sin adoptar" for orphan
    const chip = screen.getByTestId("chip");
    expect(chip).toHaveTextContent(/sin adoptar/i);
  });

  it("renders 'falta en portfolio' Chip for unlisted candidates", async () => {
    mockFetch([UNLISTED_A]);
    render(<OrphansBanner />);
    await flushInitialPoll();
    const chip = screen.getByTestId("chip");
    expect(chip).toHaveTextContent(/falta en portfolio/i);
  });
});
