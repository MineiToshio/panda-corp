import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readLedger, readLedgerResult } from "@/lib/gamification/ledger";

let root: string;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "ledger-v2-action-"));
  fs.mkdirSync(path.join(root, "factory"), { recursive: true });
  process.env.PANDACORP_FACTORY_ROOT = root;
});
afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
  delete process.env.PANDACORP_FACTORY_ROOT;
  delete process.env.PANDACORP_EVENTS_FILE;
});

function fixture(): void {
  const project = path.join(root, "app");
  fs.mkdirSync(path.join(project, ".pandacorp"), { recursive: true });
  fs.mkdirSync(path.join(project, "docs/frds/frd-01-core/work-orders"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "factory/portfolio.md"),
    "| Proyecto | Ruta |\n|---|---|\n| App | app |\n",
  );
  fs.writeFileSync(
    path.join(project, ".pandacorp/status.yaml"),
    "phase: implementation\nrunning: false\n",
  );
  fs.writeFileSync(
    path.join(project, "docs/frds/frd-01-core/work-orders/wo-01-001.md"),
    "---\nimplementation_status: VERIFIED\n---\n# WO-01-001 Core\n",
  );
}

describe("snapshotGamificationLedger v2 trust boundary", () => {
  it("derives totals on the server and ignores forged client aggregates", async () => {
    fixture();
    const { snapshotGamificationLedger } = await import("@/app/_actions/snapshotLedger");
    await snapshotGamificationLedger({ workOrdersDone: 999_999, releases: 999_999 });
    const ledger = readLedger(path.join(root, "factory/gamification-ledger.json"));
    expect(ledger.version).toBe(2);
    expect(ledger.totals.workOrdersDone).toBe(1);
    expect(ledger.totals.releases).toBe(0);
  });

  it("migrates v1 maxima without inventing event facts", async () => {
    fs.writeFileSync(
      path.join(root, "factory/gamification-ledger.json"),
      JSON.stringify({
        version: 1,
        updatedAt: "2026-01-01T00:00:00Z",
        totals: { workOrdersDone: 4, phasesCompleted: 2, releases: 1 },
      }),
    );
    const { snapshotGamificationLedger } = await import("@/app/_actions/snapshotLedger");
    await snapshotGamificationLedger();
    const ledger = readLedger(path.join(root, "factory/gamification-ledger.json"));
    expect(ledger.totals).toMatchObject({
      workOrdersDone: 4,
      phasesCompleted: 2,
      releases: 1,
      greenTestRuns: 0,
    });
    expect(ledger.facts).toEqual({});
    expect(ledger.migration.v1ImportedAt).toBeTruthy();
  });

  it("fails closed and preserves a corrupt ledger", async () => {
    const ledgerPath = path.join(root, "factory/gamification-ledger.json");
    fs.writeFileSync(ledgerPath, "{broken");
    const { snapshotGamificationLedger } = await import("@/app/_actions/snapshotLedger");
    await expect(snapshotGamificationLedger()).rejects.toThrow(/corrupt/);
    expect(fs.readFileSync(ledgerPath, "utf8")).toBe("{broken");
    expect(readLedgerResult(ledgerPath).ok).toBe(false);
  });

  it("reclaims a crashed stale lock but never steals a live owner lock", async () => {
    fixture();
    const lock = path.join(root, "factory/gamification-ledger.json.lock");
    fs.mkdirSync(lock);
    fs.writeFileSync(
      path.join(lock, "owner.json"),
      JSON.stringify({ token: "dead", pid: 999_999_999, acquiredAt: "2020-01-01T00:00:00Z" }),
    );
    const { snapshotGamificationLedger } = await import("@/app/_actions/snapshotLedger");
    await snapshotGamificationLedger();
    expect(
      readLedger(path.join(root, "factory/gamification-ledger.json")).totals.workOrdersDone,
    ).toBe(1);

    fs.mkdirSync(lock);
    fs.writeFileSync(
      path.join(lock, "owner.json"),
      JSON.stringify({ token: "live", pid: process.pid, acquiredAt: new Date().toISOString() }),
    );
    const before = fs.readFileSync(path.join(root, "factory/gamification-ledger.json"), "utf8");
    await snapshotGamificationLedger();
    expect(fs.readFileSync(path.join(root, "factory/gamification-ledger.json"), "utf8")).toBe(
      before,
    );
  });

  it("detects post-write fact tampering and refuses to bless it", async () => {
    fixture();
    process.env.PANDACORP_EVENTS_FILE = path.join(root, "events.ndjson");
    fs.writeFileSync(
      process.env.PANDACORP_EVENTS_FILE,
      `${JSON.stringify({ event: "AgentDone", at: "2026-07-11T01:00:00Z", project: "app", wo: "WO-01-001", result: "green" })}\n`,
    );
    const { snapshotGamificationLedger } = await import("@/app/_actions/snapshotLedger");
    await snapshotGamificationLedger();
    const ledgerPath = path.join(root, "factory/gamification-ledger.json");
    const parsed = JSON.parse(fs.readFileSync(ledgerPath, "utf8")) as {
      facts: Record<string, { event: Record<string, unknown> }>;
    };
    const first = Object.values(parsed.facts)[0];
    expect(first).toBeTruthy();
    if (first) first.event.agent = "forged-after-reconcile";
    const tampered = `${JSON.stringify(parsed, null, 2)}\n`;
    fs.writeFileSync(ledgerPath, tampered);
    expect(readLedgerResult(ledgerPath).ok).toBe(false);
    await expect(snapshotGamificationLedger()).rejects.toThrow(/corrupt/);
    expect(fs.readFileSync(ledgerPath, "utf8")).toBe(tampered);
    delete process.env.PANDACORP_EVENTS_FILE;
  });

  it("refuses a symlinked ledger target without writing through it", async () => {
    fixture();
    const ledgerPath = path.join(root, "factory/gamification-ledger.json");
    const outside = path.join(root, "outside-ledger.json");
    const sentinel = `${JSON.stringify({ version: 2, updatedAt: "1970-01-01T00:00:00.000Z", totals: { workOrdersDone: 0, phasesCompleted: 0, releases: 0, greenTestRuns: 0 }, facts: {}, migration: {} })}\n`;
    fs.writeFileSync(outside, sentinel);
    fs.symlinkSync(outside, ledgerPath);
    const { snapshotGamificationLedger } = await import("@/app/_actions/snapshotLedger");
    await expect(snapshotGamificationLedger()).rejects.toThrow(/symlink/);
    expect(fs.readFileSync(outside, "utf8")).toBe(sentinel);
  });
});
