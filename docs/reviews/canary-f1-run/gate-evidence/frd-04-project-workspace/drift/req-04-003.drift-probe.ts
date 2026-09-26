import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { render, screen, within } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * Drift probe — FRD-04 REQ-04-003 / REQ-04-004: "the detailed 'Mission Objectives' bar
 * (work orders done / total + %) lives inside the Summary tab". FAILS while the Summary
 * tab body carries no Mission Objectives progress (only the header's thin bar shows it);
 * PASSES once the Resumen tab renders its own done/total + % objectives progress.
 */

let fixtureRoot = "";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/projects/demo",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/portfolio/portfolio", () => ({
  activeProjects: () => [{ name: "demo", path: fixtureRoot, stage: "implementation" }],
}));

vi.mock("@/lib/status/status", () => ({
  readStatus: () => ({
    present: true,
    malformed: false,
    status: { project: "Fixture", phase: "implementation", version: "1.0.0" },
  }),
}));

vi.mock("@/lib/work-orders/work-orders", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/work-orders/work-orders")>()),
  listWorkOrders: () =>
    [0, 1, 2, 3].map((i) => ({
      id: `WO-01-00${i}`,
      title: `WO ${i}`,
      frd: "frd-01-x",
      state: i < 3 ? "done" : "todo",
      relPath: `docs/frds/frd-01-x/work-orders/wo-01-00${i}.md`,
    })),
  readWorkOrderDoc: () => null,
}));

beforeAll(() => {
  fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "frd04-drift-"));
  fs.mkdirSync(path.join(fixtureRoot, ".pandacorp", "comms"), { recursive: true });
  fs.mkdirSync(path.join(fixtureRoot, ".pandacorp", "inbox"), { recursive: true });
  fs.writeFileSync(path.join(fixtureRoot, ".pandacorp", "comms", "progress.md"), "- entrada\n");
  fs.writeFileSync(path.join(fixtureRoot, ".pandacorp", "inbox", "decisions.md"), "");
});

afterAll(() => {
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
});

describe("REQ-04-003 drift probe — Mission Objectives inside the Summary tab", () => {
  it("the Resumen tab body shows the work-order done/total and % progress", async () => {
    const { default: ProjectWorkspacePage } = await import("@/app/projects/[slug]/page");
    render(
      await ProjectWorkspacePage({
        params: Promise.resolve({ slug: "demo" }),
        searchParams: Promise.resolve({ tab: "summary" }),
      }),
    );
    const tabBody = screen.getByTestId("workspace-tab-body");
    const text = tabBody.textContent ?? "";
    expect(text).toMatch(/75\s*%/);
    expect(text).toMatch(/3\s*(\/|de)\s*4/);
    expect(within(tabBody).getAllByRole("progressbar").length).toBeGreaterThan(0);
  });
});
