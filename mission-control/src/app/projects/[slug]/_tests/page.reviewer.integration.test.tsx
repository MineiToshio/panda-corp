/**
 * FRD-04 REVIEWER — adversarial integration over the REAL data layer (DR-015).
 *
 * Unlike page.reviewer.test.tsx (which mocks lib/docs, lib/status, lib/portfolio),
 * this suite wires the workspace page to the REAL `lib/docs` readers against a
 * fixture project tree on disk. Only `lib/portfolio` (slug → path) and
 * `lib/status` (status.yaml shape) are mocked, because the reviewer's intent is
 * to exercise WO-04-001 (docs/tree/activity readers) + WO-04-004/005/006/007
 * (shell + tabs) TOGETHER, through `page.tsx`, the way a real navigation would.
 *
 * Edge cases the implementers' isolated tests did not cover:
 *   - `?doc=` traversal / unlisted path through the page must NOT leak file
 *     content (security boundary of readDoc, surfaced end-to-end).
 *   - `?doc=` to a node that exists in the tree but is a SYMLINK must not be read.
 *   - progress = 0 must still render ("0% completado"), not be dropped as falsy.
 *   - objectives bar omitted when total absent; rendered + clamped when done>total.
 *   - all-resolved decisions (pendingDecisions === 0) → no warning treatment.
 *   - unknown phase string survives to the Commands tab without throwing and
 *     yields the safe fallback command, never a misleading building command.
 *
 * Anchored in: AC-04-002.1/.2, AC-04-004.1, AC-04-005.1, AC-04-006.2/.3 + the
 * readDoc no-traversal security contract (blueprint §2, IF-04-docs).
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { render, screen } from "@testing-library/react";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Mock Next.js router — TabBar uses useRouter for URL-driven tab navigation.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/projects/demo",
  useSearchParams: () => new URLSearchParams(),
}));

// ---------------------------------------------------------------------------
// Fixture project tree on disk (real fs; real lib/docs reads it)
// ---------------------------------------------------------------------------

let fixtureRoot: string;
let secretPath: string;

const statusState = {
  project: "Fixture",
  phase: "implementation" as string,
  version: "1.0.0",
  progress: 0 as number | undefined,
  workOrdersTotal: 4 as number | undefined,
  workOrdersDone: 2,
};

vi.mock("@/lib/portfolio/portfolio", () => ({
  activeProjects: () => [{ name: "demo", path: fixtureRoot, stage: "implementation" }],
}));

vi.mock("@/lib/status/status", () => ({
  readStatus: () => ({
    present: true,
    malformed: false,
    status: {
      project: statusState.project,
      phase: statusState.phase,
      version: statusState.version,
      progress: statusState.progress,
      workOrdersTotal: statusState.workOrdersTotal,
      workOrdersDone: statusState.workOrdersDone,
    },
  }),
}));

vi.mock("@/lib/work-orders/work-orders", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/work-orders/work-orders")>()),
  listWorkOrders: () => [],
  readWorkOrderDoc: () => null,
}));

import { ObjectivesBar } from "../_components/objectives-bar";
// Imported AFTER the mocks above so the page picks them up.
import ProjectWorkspacePage from "../page";

beforeAll(() => {
  fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "frd04-int-"));
  fs.mkdirSync(path.join(fixtureRoot, "docs", "product"), { recursive: true });
  fs.writeFileSync(
    path.join(fixtureRoot, "docs", "product", "prd.md"),
    "# PRD\n\nReal product doc body MARKER-PRD.",
  );
  fs.writeFileSync(
    path.join(fixtureRoot, "docs", "product", "architecture.md"),
    "# Architecture\n\nMARKER-ARCH.",
  );

  // Comms layer (Spanish, owner-facing) — read as-is by readActivityLog/readDecisions.
  fs.mkdirSync(path.join(fixtureRoot, ".pandacorp", "comms"), { recursive: true });
  fs.mkdirSync(path.join(fixtureRoot, ".pandacorp", "inbox"), { recursive: true });
  fs.writeFileSync(
    path.join(fixtureRoot, ".pandacorp", "comms", "progress.md"),
    "# Progreso\n\n- Primera entrada MARKER-LOG\n- Segunda entrada\n",
  );
  fs.writeFileSync(
    path.join(fixtureRoot, ".pandacorp", "inbox", "decisions.md"),
    "## CLOSED: Elegir base de datos MARKER-DEC\n- **Recommendation:** usar SQLite\n",
  );

  // A secret OUTSIDE the docs tree the page must never surface or read via ?doc=.
  secretPath = path.join(fixtureRoot, "secret.env");
  fs.writeFileSync(secretPath, "API_KEY=THIS_MUST_NOT_LEAK");
});

afterAll(() => {
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
});

beforeEach(() => {
  statusState.project = "Fixture";
  statusState.phase = "implementation";
  statusState.version = "1.0.0";
  statusState.progress = 0;
  statusState.workOrdersTotal = 4;
  statusState.workOrdersDone = 2;
});

function renderPage(searchParams: Record<string, string> = {}) {
  return ProjectWorkspacePage({
    params: Promise.resolve({ slug: "demo" }),
    searchParams: Promise.resolve(searchParams),
  });
}

// ---------------------------------------------------------------------------
// Security — readDoc no-traversal boundary, surfaced end-to-end through the page
// ---------------------------------------------------------------------------

describe("FRD-04 reviewer — Documents tab security boundary (real fs)", () => {
  it("renders the real PRD body by default (readDoc wired to the real tree)", async () => {
    render(await renderPage({ tab: "documents" }));
    expect(screen.getByTestId("documents-body").textContent).toContain("MARKER-PRD");
  });

  it("?doc= traversal id ('../../secret') does NOT leak out-of-tree content", async () => {
    render(await renderPage({ tab: "documents", doc: "../../secret" }));
    const body = screen.queryByTestId("documents-body");
    // Either falls back to the first valid doc or shows nothing — but NEVER the secret.
    const text = body?.textContent ?? "";
    expect(text).not.toContain("THIS_MUST_NOT_LEAK");
    expect(text).not.toContain("API_KEY");
    // Falls back to a valid, listed doc (first node), not a crash / blank.
    expect(text).toContain("MARKER-PRD");
  });

  it("?doc= absolute path to the secret file does NOT leak it", async () => {
    render(await renderPage({ tab: "documents", doc: secretPath }));
    const text = screen.queryByTestId("documents-body")?.textContent ?? "";
    expect(text).not.toContain("THIS_MUST_NOT_LEAK");
  });

  it("?doc= unlisted-but-existing id (.pandacorp comms) is NOT surfaced as a doc", async () => {
    // decisions.md exists on disk but is a comms file, never a DocNode.
    render(await renderPage({ tab: "documents", doc: ".pandacorp/inbox/decisions" }));
    const text = screen.queryByTestId("documents-body")?.textContent ?? "";
    expect(text).not.toContain("MARKER-DEC");
    // and the nav must not list it
    const navItems = screen.getAllByTestId("doc-nav-item").map((n) => n.textContent ?? "");
    expect(navItems.some((l) => l.includes("decisions"))).toBe(false);
  });

  it("a SYMLINK doc node pointing out of tree is rejected (not read)", async () => {
    // Plant a symlink inside docs/product that resolves to the secret file.
    const linkPath = path.join(fixtureRoot, "docs", "product", "leak.md");
    let symlinkOk = true;
    try {
      fs.symlinkSync(secretPath, linkPath);
    } catch {
      symlinkOk = false; // platform without symlink permission — skip assertion below
    }
    if (symlinkOk) {
      render(await renderPage({ tab: "documents", doc: "docs/product/leak" }));
      const text = screen.queryByTestId("documents-body")?.textContent ?? "";
      expect(text).not.toContain("THIS_MUST_NOT_LEAK");
      fs.rmSync(linkPath, { force: true });
    }
    expect(true).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Summary tab — real comms readers wired through the page
// ---------------------------------------------------------------------------

describe("FRD-04 reviewer — Summary tab real comms integration", () => {
  it("activity log + decisions come from the real files on disk", async () => {
    render(await renderPage({}));
    expect(screen.getByText(/MARKER-LOG/)).toBeTruthy();
    expect(screen.getByText(/MARKER-DEC/)).toBeTruthy();
  });

  it("a CLOSED-only decisions file → no pending warning treatment (AC-04-004.1 'otherwise')", async () => {
    render(await renderPage({}));
    const section = screen.getByTestId("decisions-section");
    // The single decision is CLOSED → resolved → pendingDecisions === 0 → not pending.
    expect(section.getAttribute("data-pending")).toBe("false");
    expect(screen.queryByTestId("decisions-count-badge")).toBeNull();
    // No unresolved warning icon rendered for a resolved decision.
    expect(screen.queryByTestId("decision-warning-icon")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Header / objectives — numeric edge cases (0, absent, overflow)
// ---------------------------------------------------------------------------

describe("FRD-04 reviewer — header + objectives numeric edges", () => {
  it("progress = 0 still renders '0% completado' (0 is finite, not dropped as falsy)", async () => {
    statusState.progress = 0;
    render(await renderPage({ tab: "commands" }));
    expect(screen.getByTestId("workspace-header-progress").textContent).toContain("0%");
  });

  it("objectives bar is OMITTED when total is absent (AC-04-002.2)", async () => {
    statusState.workOrdersTotal = undefined;
    render(await renderPage({ tab: "commands" }));
    expect(screen.queryByTestId("objectives-bar")).toBeNull();
  });

  it("objectives bar clamps to 100% when done > total (defensive — the page can't produce this now)", () => {
    // The page derives done/total from aggregateProgress() where done ≤ total always, so done > total
    // is no longer reachable through it (FRD-21). The clamp stays as a defensive guarantee in
    // ObjectivesBar, tested here directly at the component level.
    render(<ObjectivesBar done={9} total={4} />);
    const pct = screen.getByTestId("objectives-bar-pct").textContent ?? "";
    expect(pct).toContain("100%");
    // aria-label must not claim a >100% completion
    expect(screen.getByTestId("objectives-bar").getAttribute("aria-label")).toContain("100%");
  });
});

// ---------------------------------------------------------------------------
// Commands tab — phase robustness through the real page wiring
// ---------------------------------------------------------------------------

describe("FRD-04 reviewer — Commands tab phase robustness", () => {
  it("release phase shows iterate + new-version (implement lives in ModeSelector, not CommandsBox)", async () => {
    statusState.phase = "release";
    render(await renderPage({ tab: "commands" }));
    const commands = screen.getAllByTestId("command-row-command").map((n) => n.textContent ?? "");
    expect(commands.some((c) => c.includes("/pandacorp:new-version"))).toBe(true);
    expect(commands.some((c) => c.includes("/pandacorp:iterate"))).toBe(true);
    expect(commands.some((c) => c.includes("/pandacorp:implement"))).toBe(false);
  });

  it("an UNKNOWN phase string survives to the Commands tab → safe fallback, never a building command", async () => {
    statusState.phase = "totally-bogus-phase";
    let el: React.JSX.Element | undefined;
    await expect(
      (async () => {
        el = await renderPage({ tab: "commands" });
      })(),
    ).resolves.toBeUndefined();
    if (el !== undefined) {
      render(el);
      const commands = screen.getAllByTestId("command-row-command").map((n) => n.textContent ?? "");
      // Fallback row is the safe spec command — never a misleading implement/release.
      expect(commands.some((c) => c.includes("/pandacorp:spec"))).toBe(true);
      expect(commands.some((c) => c.includes("/pandacorp:implement"))).toBe(false);
    }
  });
});
