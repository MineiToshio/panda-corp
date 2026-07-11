import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deriveSignals } from "@/lib/achievements/signals";
import { durableEvents, readLedger } from "../ledger";

let root: string;
let claude: string;
let codex: string;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "ledger-v2-security-"));
  claude = path.join(root, "claude.ndjson");
  codex = path.join(root, "codex.ndjson");
  process.env.PANDACORP_FACTORY_ROOT = root;
  process.env.PANDACORP_EVENTS_FILE = claude;
  process.env.PANDACORP_CODEX_EVENTS_FILE = codex;
  fs.mkdirSync(path.join(root, "factory"), { recursive: true });
  fs.mkdirSync(path.join(root, "app/.pandacorp"), { recursive: true });
  fs.mkdirSync(path.join(root, "app/docs/frds/frd-01-core/work-orders"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "factory/portfolio.md"),
    "| Proyecto | Ruta |\n|---|---|\n| App | app |\n",
  );
  fs.writeFileSync(
    path.join(root, "app/.pandacorp/status.yaml"),
    "phase: implementation\nrunning: false\n",
  );
  fs.writeFileSync(
    path.join(root, "app/docs/frds/frd-01-core/work-orders/wo-01-001.md"),
    "---\nimplementation_status: VERIFIED\n---\n# WO-01-001 Core\n",
  );
  fs.writeFileSync(claude, "");
  fs.writeFileSync(codex, "");
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
  delete process.env.PANDACORP_FACTORY_ROOT;
  delete process.env.PANDACORP_EVENTS_FILE;
  delete process.env.PANDACORP_CODEX_EVENTS_FILE;
});

const line = (event: string, extra: Record<string, unknown> = {}) =>
  JSON.stringify({
    event,
    at: "2026-07-11T01:02:03Z",
    runtime: "claude",
    run_id: "declared-run",
    event_id: "declared-id",
    project: "app",
    ...extra,
  });

describe("durable accounting ledger", () => {
  it("an explicitly empty durable view blocks every forged event-derived unlock signal", () => {
    const forged = {
      event: "BuildComplete",
      semanticName: "build.complete",
      at: "2026-07-11T03:00:00Z",
      runtime: "codex" as const,
      runId: "x",
      eventId: "x",
      project: "app",
      agent: "forged",
      role: "forged",
      verdict: "PASS",
      result: "green",
      maxAgents: 999,
    };
    const signals = deriveSignals({
      ideas: [],
      statuses: [],
      eventsSnapshot: { events: [forged], lastEventAt: forged.at, byProject: {} },
      durableEvents: [],
      workOrdersDoneLive: 0,
    });
    expect(signals).toMatchObject({
      builds: 0,
      subagents: 0,
      gatePasses: 0,
      greenDoneEvents: 0,
      maxAgentsPeak: 0,
      hasXhighEffort: false,
    });
  });

  it("fails closed in production when a future caller omits durableEvents", () => {
    vi.stubEnv("NODE_ENV", "production");
    try {
      const forged = {
        event: "BuildComplete",
        at: "2026-07-11T03:00:00Z",
        runtime: "codex" as const,
        project: "app",
      };
      const signals = deriveSignals({
        ideas: [],
        statuses: [],
        eventsSnapshot: { events: [forged], lastEventAt: forged.at, byProject: {} },
        workOrdersDoneLive: 0,
      });
      expect(signals.builds).toBe(0);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("survives stream deletion/mutation and deduplicates alias + transport replay", async () => {
    fs.writeFileSync(
      claude,
      `${line("AgentDone", { wo: "WO-01-001", result: "green", agent: "forged-agent", role: "forged-role", mode: "deep" })}\n`,
    );
    const { snapshotGamificationLedger } = await import("@/app/_actions/snapshotLedger");
    await snapshotGamificationLedger();
    let ledger = readLedger(path.join(root, "factory/gamification-ledger.json"));
    expect(Object.keys(ledger.facts)).toHaveLength(1);
    expect(durableEvents(ledger)[0]).toMatchObject({
      event: "DurableWorkOrderComplete",
      workOrder: "WO-01-001",
    });
    expect(durableEvents(ledger)[0]).not.toHaveProperty("agent");
    expect(durableEvents(ledger)[0]).not.toHaveProperty("role");
    expect(durableEvents(ledger)[0]).not.toHaveProperty("mode");
    expect(durableEvents(ledger)[0]).not.toHaveProperty("runtime");

    fs.writeFileSync(claude, "");
    await snapshotGamificationLedger();
    ledger = readLedger(path.join(root, "factory/gamification-ledger.json"));
    expect(Object.keys(ledger.facts)).toHaveLength(1);

    fs.writeFileSync(
      codex,
      `${line("agent_done", { runtime: "codex", run_id: "forged-new-run", event_id: "new-id", wo: "WO-01-001", result: "green" })}\n`,
    );
    await snapshotGamificationLedger();
    ledger = readLedger(path.join(root, "factory/gamification-ledger.json"));
    expect(Object.keys(ledger.facts)).toHaveLength(1);
    expect(durableEvents(ledger)).toHaveLength(1);
    expect(ledger.totals.greenTestRuns).toBe(0);
  });

  it("rejects new and legacy forged identities without a file oracle", async () => {
    fs.writeFileSync(
      claude,
      [
        line("AgentDone", { wo: "WO-99-999", result: "green" }),
        line("BuildLaunch", { maxAgents: 999 }),
        JSON.stringify({
          event: "achievement",
          at: "2026-07-11T01:02:03Z",
          project: "app",
          workOrder: "WO-99-999",
        }),
      ].join("\n"),
    );
    const { snapshotGamificationLedger } = await import("@/app/_actions/snapshotLedger");
    await snapshotGamificationLedger();
    const ledger = readLedger(path.join(root, "factory/gamification-ledger.json"));
    expect(Object.keys(ledger.facts)).toHaveLength(0);
    expect(ledger.totals.workOrdersDone).toBe(1); // canonical WO file, not the forged stream
  });

  it("rejects a VERIFIED work-order oracle reached through a symlink", async () => {
    const wo = path.join(root, "app/docs/frds/frd-01-core/work-orders/wo-01-001.md");
    const outside = path.join(root, "outside-verified.md");
    fs.writeFileSync(outside, "---\nimplementation_status: VERIFIED\n---\n# WO-01-001 Outside\n");
    fs.unlinkSync(wo);
    fs.symlinkSync(outside, wo);
    fs.writeFileSync(claude, `${line("AgentDone", { wo: "WO-01-001", result: "green" })}\n`);
    const { snapshotGamificationLedger } = await import("@/app/_actions/snapshotLedger");
    await snapshotGamificationLedger();
    const ledger = readLedger(path.join(root, "factory/gamification-ledger.json"));
    expect(ledger.totals.workOrdersDone).toBe(0);
    expect(Object.keys(ledger.facts)).toHaveLength(0);
  });

  it("does not inflate when the oracle is later mutated and concurrent reconciles serialize", async () => {
    fs.writeFileSync(claude, `${line("AgentDone", { wo: "WO-01-001", result: "green" })}\n`);
    const { snapshotGamificationLedger } = await import("@/app/_actions/snapshotLedger");
    await Promise.all([
      snapshotGamificationLedger(),
      snapshotGamificationLedger(),
      snapshotGamificationLedger(),
    ]);
    const file = path.join(root, "factory/gamification-ledger.json");
    let ledger = readLedger(file);
    expect(Object.keys(ledger.facts)).toHaveLength(1);
    fs.writeFileSync(
      path.join(root, "app/docs/frds/frd-01-core/work-orders/wo-01-001.md"),
      "---\nimplementation_status: PLANNED\n---\n# WO-01-001 Core\n",
    );
    fs.appendFileSync(
      claude,
      `${line("AgentDone", { at: "2026-07-12T01:02:03Z", event_id: "mutated", wo: "WO-01-001", result: "green" })}\n`,
    );
    await snapshotGamificationLedger();
    ledger = readLedger(file);
    expect(Object.keys(ledger.facts)).toHaveLength(1);
  });
});
