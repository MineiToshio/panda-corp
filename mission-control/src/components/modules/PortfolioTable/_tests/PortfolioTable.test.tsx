/**
 * PortfolioTable — Component tests (TDD: RED → GREEN → refactor).
 *
 * Traceability:
 *   CMP-03-rail   — PortfolioTable outer section
 *   CMP-03-row    — ProjectRow per entry
 *   CMP-03-snapshot — BusinessSnapshot chips (shipped projects)
 *   CMP-03-empty  — EmptyState / LoadingState / ErrorState
 *   CMP-03-recovery — RecoveryHint (path-not-found)
 *   IF-01-readPortfolio (docs/api.md WO-01-004): PortfolioEntry shape consumed by the component
 *
 * Tests cover:
 *   1. Loading, error, empty states
 *   2. Basic row rendering (name, path, phase, indicator)
 *   3. Path-not-found badge + recovery hint (repo present / absent)
 *   4. Business snapshot chips (shipped projects, present / absent fields)
 *   5. Running indicator variants (building / stopped)
 *   6. a11y: aria-labels, role attributes, aria-live
 *   7. data-testid presence on every significant element
 *   8. Zero hardcoded colors — CSS custom properties only (checked via style inspection)
 *
 * Stack: Vitest + @testing-library/react (jsdom).
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { PortfolioTableEntry } from "@/components/modules/PortfolioTable/PortfolioTable";
import { PortfolioTable } from "@/components/modules/PortfolioTable/PortfolioTable";

// ---------------------------------------------------------------------------
// Fixture builders
// ---------------------------------------------------------------------------

const makeEntry = (overrides: Partial<PortfolioTableEntry> = {}): PortfolioTableEntry => ({
  name: "proj-a",
  path: "projects/proj-a",
  exists: true,
  ...overrides,
});

const FULL_ENTRY: PortfolioTableEntry = {
  name: "proj-a",
  path: "projects/proj-a",
  repo: "https://github.com/ada/proj-a",
  originIdea: "Mission Control dashboard",
  phase: "implementation",
  users: undefined,
  returnMetric: "personal",
  verdict: "active",
  lastSync: "2026-06-15",
  exists: true,
  isRunning: true,
};

const MISSING_REPO_ENTRY: PortfolioTableEntry = {
  name: "proj-missing-repo",
  path: "projects/proj-missing-repo",
  repo: undefined,
  phase: "operation",
  users: "12",
  returnMetric: "$240 MRR",
  verdict: "building",
  exists: true,
  isRunning: false,
};

const BROKEN_PATH_WITH_REPO: PortfolioTableEntry = {
  name: "proj-broken-path",
  path: "/nonexistent/path/does/not/exist",
  repo: "https://github.com/ada/broken",
  phase: "shipped",
  users: "340",
  returnMetric: "OSS stars",
  verdict: "shipped",
  exists: false,
  isRunning: false,
};

const BROKEN_PATH_NO_REPO: PortfolioTableEntry = {
  name: "proj-no-repo",
  path: "/also/gone",
  repo: undefined,
  phase: "shipped",
  exists: false,
};

// ---------------------------------------------------------------------------
// 1. Loading state
// ---------------------------------------------------------------------------

describe("PortfolioTable — loading state", () => {
  it("renders portfolio-table section", () => {
    render(<PortfolioTable entries={[]} isLoading />);
    expect(screen.getByTestId("portfolio-table")).toBeDefined();
  });

  it("renders portfolio-loading-state when isLoading=true", () => {
    render(<PortfolioTable entries={[]} isLoading />);
    expect(screen.getByTestId("portfolio-loading-state")).toBeDefined();
  });

  it("does NOT render empty state when isLoading=true", () => {
    render(<PortfolioTable entries={[]} isLoading />);
    expect(screen.queryByTestId("portfolio-empty-state")).toBeNull();
  });

  it("does NOT render error state when isLoading=true (loading takes priority)", () => {
    render(<PortfolioTable entries={[]} isLoading error="boom" />);
    expect(screen.queryByTestId("portfolio-error-state")).toBeNull();
    expect(screen.getByTestId("portfolio-loading-state")).toBeDefined();
  });

  it("loading state has aria-live=polite", () => {
    render(<PortfolioTable entries={[]} isLoading />);
    const el = screen.getByTestId("portfolio-loading-state");
    expect(el.getAttribute("aria-live")).toBe("polite");
  });
});

// ---------------------------------------------------------------------------
// 2. Error state
// ---------------------------------------------------------------------------

describe("PortfolioTable — error state", () => {
  it("renders portfolio-error-state when error is set", () => {
    render(<PortfolioTable entries={[]} error="No se pudo leer el portafolio." />);
    expect(screen.getByTestId("portfolio-error-state")).toBeDefined();
  });

  it("shows the error message text", () => {
    render(<PortfolioTable entries={[]} error="Archivo no encontrado." />);
    expect(screen.getByText("Archivo no encontrado.")).toBeDefined();
  });

  it("does NOT render empty state when error is set", () => {
    render(<PortfolioTable entries={[]} error="boom" />);
    expect(screen.queryByTestId("portfolio-empty-state")).toBeNull();
  });

  it("error state has role=alert", () => {
    render(<PortfolioTable entries={[]} error="boom" />);
    const el = screen.getByTestId("portfolio-error-state");
    expect(el.getAttribute("role")).toBe("alert");
  });

  it("error state has aria-live=assertive", () => {
    render(<PortfolioTable entries={[]} error="boom" />);
    const el = screen.getByTestId("portfolio-error-state");
    expect(el.getAttribute("aria-live")).toBe("assertive");
  });
});

// ---------------------------------------------------------------------------
// 3. Empty state
// ---------------------------------------------------------------------------

describe("PortfolioTable — empty state", () => {
  it("renders portfolio-empty-state when entries=[]", () => {
    render(<PortfolioTable entries={[]} />);
    expect(screen.getByTestId("portfolio-empty-state")).toBeDefined();
  });

  it("does NOT render any rows when entries=[]", () => {
    render(<PortfolioTable entries={[]} />);
    expect(screen.queryAllByTestId("portfolio-row")).toHaveLength(0);
  });

  it("empty state has aria-live=polite", () => {
    render(<PortfolioTable entries={[]} />);
    const el = screen.getByTestId("portfolio-empty-state");
    expect(el.getAttribute("aria-live")).toBe("polite");
  });
});

// ---------------------------------------------------------------------------
// 4. Basic row rendering
// ---------------------------------------------------------------------------

describe("PortfolioTable — basic row rendering", () => {
  it("renders one portfolio-row per entry", () => {
    render(<PortfolioTable entries={[FULL_ENTRY, MISSING_REPO_ENTRY]} />);
    expect(screen.getAllByTestId("portfolio-row")).toHaveLength(2);
  });

  it("renders the project name", () => {
    render(<PortfolioTable entries={[FULL_ENTRY]} />);
    expect(screen.getByTestId("portfolio-row-name").textContent).toBe("proj-a");
  });

  it("renders the project path", () => {
    render(<PortfolioTable entries={[FULL_ENTRY]} />);
    expect(screen.getByTestId("portfolio-row-path").textContent).toBe("projects/proj-a");
  });

  it("renders the phase chip when phase is present", () => {
    render(<PortfolioTable entries={[FULL_ENTRY]} />);
    expect(screen.getByTestId("portfolio-row-phase").textContent).toBe("implementation");
  });

  it("does NOT render phase chip when phase is absent", () => {
    render(<PortfolioTable entries={[makeEntry({ phase: undefined })]} />);
    expect(screen.queryByTestId("portfolio-row-phase")).toBeNull();
  });

  it("portfolio-table section has correct aria-label", () => {
    render(<PortfolioTable entries={[FULL_ENTRY]} />);
    expect(screen.getByTestId("portfolio-table").getAttribute("aria-label")).toBe(
      "Portafolio de proyectos",
    );
  });

  it("each row has an aria-label with the project name", () => {
    render(<PortfolioTable entries={[FULL_ENTRY]} />);
    const row = screen.getByTestId("portfolio-row");
    expect(row.getAttribute("aria-label")).toBe("Proyecto: proj-a");
  });
});

// ---------------------------------------------------------------------------
// 5. Running indicator (REQ-03-002)
// ---------------------------------------------------------------------------

describe("PortfolioTable — running indicator", () => {
  it("shows 'Construyendo' when isRunning=true and path exists", () => {
    render(<PortfolioTable entries={[makeEntry({ isRunning: true, exists: true })]} />);
    const indicator = screen.getByTestId("portfolio-row-indicator");
    expect(indicator.textContent).toBe("Construyendo");
  });

  it("shows 'Parado' when isRunning=false and path exists", () => {
    render(<PortfolioTable entries={[makeEntry({ isRunning: false, exists: true })]} />);
    const indicator = screen.getByTestId("portfolio-row-indicator");
    expect(indicator.textContent).toBe("Parado");
  });

  it("shows 'Parado' when isRunning is absent and path exists", () => {
    render(<PortfolioTable entries={[makeEntry({ isRunning: undefined, exists: true })]} />);
    const indicator = screen.getByTestId("portfolio-row-indicator");
    expect(indicator.textContent).toBe("Parado");
  });

  it("does NOT render indicator when path does not exist", () => {
    render(<PortfolioTable entries={[makeEntry({ exists: false })]} />);
    expect(screen.queryByTestId("portfolio-row-indicator")).toBeNull();
  });

  it("indicator has role=status", () => {
    render(<PortfolioTable entries={[makeEntry({ isRunning: true, exists: true })]} />);
    expect(screen.getByTestId("portfolio-row-indicator").getAttribute("role")).toBe("status");
  });

  it("running indicator aria-label is 'Construcción activa' when building", () => {
    render(<PortfolioTable entries={[makeEntry({ isRunning: true, exists: true })]} />);
    expect(screen.getByTestId("portfolio-row-indicator").getAttribute("aria-label")).toBe(
      "Construcción activa",
    );
  });

  it("stopped indicator aria-label is 'Parado'", () => {
    render(<PortfolioTable entries={[makeEntry({ isRunning: false, exists: true })]} />);
    expect(screen.getByTestId("portfolio-row-indicator").getAttribute("aria-label")).toBe("Parado");
  });
});

// ---------------------------------------------------------------------------
// 6. Path-not-found badge + recovery (REQ-03-006)
// ---------------------------------------------------------------------------

describe("PortfolioTable — path-not-found badge", () => {
  it("renders not-found badge when exists=false", () => {
    render(<PortfolioTable entries={[BROKEN_PATH_WITH_REPO]} />);
    expect(screen.getByTestId("portfolio-row-not-found-badge")).toBeDefined();
  });

  it("does NOT render not-found badge when exists=true", () => {
    render(<PortfolioTable entries={[FULL_ENTRY]} />);
    expect(screen.queryByTestId("portfolio-row-not-found-badge")).toBeNull();
  });

  it("not-found badge has role=status", () => {
    render(<PortfolioTable entries={[BROKEN_PATH_WITH_REPO]} />);
    expect(screen.getByTestId("portfolio-row-not-found-badge").getAttribute("role")).toBe("status");
  });
});

describe("PortfolioTable — recovery hint with repo", () => {
  it("renders recovery hint when exists=false", () => {
    render(<PortfolioTable entries={[BROKEN_PATH_WITH_REPO]} />);
    expect(screen.getByTestId("portfolio-recovery-hint")).toBeDefined();
  });

  it("does NOT render recovery hint when exists=true", () => {
    render(<PortfolioTable entries={[FULL_ENTRY]} />);
    expect(screen.queryByTestId("portfolio-recovery-hint")).toBeNull();
  });

  it("renders clone + sync command when repo is present", () => {
    render(<PortfolioTable entries={[BROKEN_PATH_WITH_REPO]} />);
    const cmd = screen.getByTestId("portfolio-recovery-command");
    expect(cmd.textContent).toContain("git clone https://github.com/ada/broken");
    expect(cmd.textContent).toContain("/pandacorp:sync-portfolio");
    expect(cmd.textContent).toContain("/nonexistent/path/does/not/exist");
  });
});

describe("PortfolioTable — recovery hint without repo", () => {
  it("renders no-repo warning when repo is absent", () => {
    render(<PortfolioTable entries={[BROKEN_PATH_NO_REPO]} />);
    expect(screen.getByTestId("portfolio-recovery-no-repo")).toBeDefined();
  });

  it("does NOT render clone command when repo is absent", () => {
    render(<PortfolioTable entries={[BROKEN_PATH_NO_REPO]} />);
    expect(screen.queryByTestId("portfolio-recovery-command")).toBeNull();
  });

  it("no-repo warning text mentions /pandacorp:spec", () => {
    render(<PortfolioTable entries={[BROKEN_PATH_NO_REPO]} />);
    expect(screen.getByTestId("portfolio-recovery-no-repo").textContent).toContain(
      "/pandacorp:spec",
    );
  });
});

// ---------------------------------------------------------------------------
// 7. Business snapshot (REQ-03-003) — shipped projects only
// ---------------------------------------------------------------------------

describe("PortfolioTable — business snapshot", () => {
  it("renders snapshot section for shipped (phase=operation) entry with data", () => {
    render(<PortfolioTable entries={[MISSING_REPO_ENTRY]} />);
    expect(screen.getByTestId("portfolio-snapshot")).toBeDefined();
  });

  it("renders snapshot section for entry with phase=shipped", () => {
    const shipped: PortfolioTableEntry = {
      ...FULL_ENTRY,
      phase: "shipped",
      users: "99",
      exists: true,
    };
    render(<PortfolioTable entries={[shipped]} />);
    expect(screen.getByTestId("portfolio-snapshot")).toBeDefined();
  });

  it("does NOT render snapshot section for non-shipped phases", () => {
    render(<PortfolioTable entries={[FULL_ENTRY]} />); // phase=implementation
    expect(screen.queryByTestId("portfolio-snapshot")).toBeNull();
  });

  it("does NOT render snapshot section when all snapshot fields are absent", () => {
    const noSnapshot: PortfolioTableEntry = {
      ...makeEntry({ phase: "operation" }),
      users: undefined,
      returnMetric: undefined,
      verdict: undefined,
    };
    render(<PortfolioTable entries={[noSnapshot]} />);
    expect(screen.queryByTestId("portfolio-snapshot")).toBeNull();
  });

  it("renders users chip when users is present", () => {
    render(<PortfolioTable entries={[MISSING_REPO_ENTRY]} />);
    expect(screen.getByTestId("portfolio-snapshot-users").textContent).toContain("12");
  });

  it("renders returnMetric chip when returnMetric is present", () => {
    render(<PortfolioTable entries={[MISSING_REPO_ENTRY]} />);
    expect(screen.getByTestId("portfolio-snapshot-return").textContent).toContain("$240 MRR");
  });

  it("renders verdict chip when verdict is present", () => {
    render(<PortfolioTable entries={[MISSING_REPO_ENTRY]} />);
    expect(screen.getByTestId("portfolio-snapshot-verdict").textContent).toContain("building");
  });

  it("does NOT render users chip when users is absent", () => {
    const noUsers: PortfolioTableEntry = {
      ...makeEntry({ phase: "operation" }),
      users: undefined,
      returnMetric: "big bucks",
    };
    render(<PortfolioTable entries={[noUsers]} />);
    expect(screen.queryByTestId("portfolio-snapshot-users")).toBeNull();
  });

  it("does NOT render returnMetric chip when returnMetric is absent", () => {
    const noReturn: PortfolioTableEntry = {
      ...makeEntry({ phase: "operation" }),
      users: "5",
      returnMetric: undefined,
    };
    render(<PortfolioTable entries={[noReturn]} />);
    expect(screen.queryByTestId("portfolio-snapshot-return")).toBeNull();
  });

  it("snapshot has tabular-nums font variant", () => {
    render(<PortfolioTable entries={[MISSING_REPO_ENTRY]} />);
    const snapshot = screen.getByTestId("portfolio-snapshot");
    // fontVariantNumeric is set via inline style
    expect((snapshot as HTMLElement).style.fontVariantNumeric).toBe("tabular-nums");
  });
});

// ---------------------------------------------------------------------------
// 8. Multiple entries + ordering
// ---------------------------------------------------------------------------

describe("PortfolioTable — multiple entries", () => {
  it("renders all three entries", () => {
    render(<PortfolioTable entries={[FULL_ENTRY, MISSING_REPO_ENTRY, BROKEN_PATH_WITH_REPO]} />);
    expect(screen.getAllByTestId("portfolio-row")).toHaveLength(3);
  });

  it("entries appear in the order provided (first entry name is first)", () => {
    render(<PortfolioTable entries={[FULL_ENTRY, MISSING_REPO_ENTRY]} />);
    const rows = screen.getAllByTestId("portfolio-row-name");
    expect(rows[0]?.textContent).toBe("proj-a");
    expect(rows[1]?.textContent).toBe("proj-missing-repo");
  });
});

// ---------------------------------------------------------------------------
// 9. Read-only invariant: recovery command is copyable text, not a button
//    The recovery action is ONLY via CopyButton — MC never clones, never writes.
// ---------------------------------------------------------------------------

describe("PortfolioTable — read-only recovery invariant", () => {
  it("recovery command is rendered as code text (not an anchor or form)", () => {
    render(<PortfolioTable entries={[BROKEN_PATH_WITH_REPO]} />);
    const cmd = screen.getByTestId("portfolio-recovery-command");
    expect(cmd.tagName.toLowerCase()).toBe("code");
  });
});

// ---------------------------------------------------------------------------
// 10. CSS custom property guard — zero hardcoded colors
//     Spot-check that key elements do NOT have hard-coded hex/rgb values in
//     their inline styles. (Token refs use var(--...); fallbacks use system
//     values like 'Canvas' or 'currentColor'.)
// ---------------------------------------------------------------------------

describe("PortfolioTable — zero hardcoded color values in inline styles", () => {
  const hasHardcodedColor = (el: HTMLElement): boolean => {
    const style = el.getAttribute("style") ?? "";
    // Match hex (#rgb / #rrggbb), rgb(), hsl(), or oklch() literals
    return /(?:#[0-9a-fA-F]{3,8}|rgb\(|hsl\(|oklch\()/.test(style);
  };

  it("portfolio-row has no hardcoded color in inline style", () => {
    render(<PortfolioTable entries={[FULL_ENTRY]} />);
    const row = screen.getByTestId("portfolio-row");
    expect(hasHardcodedColor(row as HTMLElement)).toBe(false);
  });

  it("portfolio-row-name has no hardcoded color in inline style", () => {
    render(<PortfolioTable entries={[FULL_ENTRY]} />);
    expect(hasHardcodedColor(screen.getByTestId("portfolio-row-name") as HTMLElement)).toBe(false);
  });

  it("portfolio-row-phase chip has no hardcoded color in inline style", () => {
    render(<PortfolioTable entries={[FULL_ENTRY]} />);
    expect(hasHardcodedColor(screen.getByTestId("portfolio-row-phase") as HTMLElement)).toBe(false);
  });

  it("portfolio-snapshot has no hardcoded color in inline style", () => {
    render(<PortfolioTable entries={[MISSING_REPO_ENTRY]} />);
    expect(hasHardcodedColor(screen.getByTestId("portfolio-snapshot") as HTMLElement)).toBe(false);
  });
});
