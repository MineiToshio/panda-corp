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
 *   - compact header falls back when listWorkOrders() is empty, never showing 0/0.
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
import { t } from "@/lib/copy/copy";

// Mock Next.js router — TabBar uses useRouter for URL-driven tab navigation.
vi.mock("next/navigation", async (actual) => ({
  ...(await actual<typeof import("next/navigation")>()),
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
};

/** Work orders returned by the mocked listWorkOrders(), the header progress source (DR-115). */
let mockWorkOrders: { id: string; title: string; frd: string; state: string; relPath: string }[] =
  [];

vi.mock("@/lib/portfolio/portfolio", () => {
  const projects = () => [
    {
      name: "demo",
      path: fixtureRoot,
      exists: true,
      stage: statusState.phase,
      status: { present: true, malformed: false, status: { ...statusState } },
    },
  ];
  return { allProjects: projects, readPortfolio: projects };
});

vi.mock("@/lib/status/status", () => ({
  readStatus: () => ({
    present: true,
    malformed: false,
    status: {
      project: statusState.project,
      phase: statusState.phase,
      version: statusState.version,
    },
  }),
}));

vi.mock("@/lib/work-orders/work-orders", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/work-orders/work-orders")>()),
  listWorkOrders: () => mockWorkOrders,
  readWorkOrderDoc: () => null,
}));

/** Build N "done" + M "todo" work orders for the header progress edge-case tests. */
function buildWorkOrders(done: number, total: number) {
  const orders: { id: string; title: string; frd: string; state: string; relPath: string }[] = [];
  for (let i = 0; i < total; i++) {
    orders.push({
      id: `WO-01-${String(i).padStart(3, "0")}`,
      title: `WO ${i}`,
      frd: "frd-01-x",
      state: i < done ? "done" : "todo",
      relPath: `docs/frds/frd-01-x/work-orders/wo-01-${String(i).padStart(3, "0")}.md`,
    });
  }
  return orders;
}

// Imported AFTER the mocks above so the page picks them up.
import { openStandalone } from "./standaloneRoute";

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
  mockWorkOrders = buildWorkOrders(2, 4);
});

function renderPage(searchParams: Record<string, string> = {}) {
  const query = new URLSearchParams(searchParams);
  return openStandalone(`/projects/demo${query.size ? `?${query}` : ""}`);
}

// ---------------------------------------------------------------------------
// Security — readDoc no-traversal boundary, surfaced end-to-end through the page
// ---------------------------------------------------------------------------

describe("FRD-04 reviewer — Documents tab security boundary (real fs)", () => {
  it("renders the real PRD body by default (readDoc wired to the real tree)", async () => {
    render(await renderPage({ tab: "documents" }));
    expect(screen.getByTestId("documents-body").textContent).toContain("MARKER-PRD");
  });

  it("rejects a traversal document id without opening an out-of-tree document", async () => {
    const ui = await renderPage({ tab: "documents", doc: "../../secret" });
    expect(() => render(ui)).toThrow("404");
  });

  it("rejects an absolute document path", async () => {
    const ui = await renderPage({ tab: "documents", doc: secretPath });
    expect(() => render(ui)).toThrow("404");
  });

  it("rejects an unlisted-but-existing comms file", async () => {
    const ui = await renderPage({ tab: "documents", doc: ".pandacorp/inbox/decisions" });
    expect(() => render(ui)).toThrow("404");
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
      const ui = await renderPage({ tab: "documents", doc: "docs/product/leak" });
      expect(() => render(ui)).toThrow("404");
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
    // The single decision is CLOSED → resolved → it is not pending anywhere on Resumen.
    expect(screen.getByRole("button", { name: /MARKER-DEC/ })).toHaveTextContent("Resuelta");
    expect(screen.getByText(t("workspace.resumen.turn.empty"))).toBeVisible();
    expect(screen.queryByRole("button", { name: /Copiar \/pandacorp:decide/ })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Compact header: numeric edges (no orders, and real progress)
// ---------------------------------------------------------------------------

describe("FRD-04 reviewer: compact header numeric edges", () => {
  it("shows the no-orders fallback, never 0/0, when no work order exists (AC-04-014.1)", async () => {
    mockWorkOrders = [];
    render(await renderPage({ tab: "commands" }));
    const header = screen.getByTestId("project-hero-compact");
    expect(header.textContent).not.toContain("0/0");
    expect(header).toHaveTextContent("Sin work orders");
  });

  it("derives n/m WO and pct from the real orders (AC-04-014.1)", async () => {
    render(await renderPage({ tab: "commands" }));
    expect(screen.getByTestId("project-hero-compact").textContent).toMatch(/2\/4 WO . 50\s?%/);
  });
});

// ---------------------------------------------------------------------------
// Commands tab — phase robustness through the real page wiring
// ---------------------------------------------------------------------------

function nextStepCard(): HTMLElement {
  const heading = screen.getByRole("heading", { name: t("workspace.comandos.nextStep.title") });
  const card = heading.closest("section");
  if (!card) throw new Error("Next-step heading sits outside its card");
  return card;
}

describe("FRD-04 reviewer — Commands tab phase robustness", () => {
  it("release phase shows iterate + new-version (implement lives in ModeSelector, not CommandsBox)", async () => {
    statusState.phase = "release";
    render(await renderPage({ tab: "commands" }));
    const body = nextStepCard();
    expect(body).toHaveTextContent("/pandacorp:new-version");
    expect(body).toHaveTextContent("/pandacorp:iterate");
    expect(body).not.toHaveTextContent("/pandacorp:implement");
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
      const body = nextStepCard();
      // Fallback row is the safe spec command — never a misleading implement/release.
      expect(body).toHaveTextContent("/pandacorp:spec");
      expect(body).not.toHaveTextContent("/pandacorp:implement");
    }
  });
});
