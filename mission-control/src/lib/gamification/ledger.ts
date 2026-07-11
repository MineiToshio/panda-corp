/**
 * Canonical durable gamification/accounting ledger (FRD-09, DR-033, DR-092).
 *
 * Live event transports are presentation telemetry: they rotate and any local
 * process can append to them.  This ledger records only outcomes corroborated by
 * canonical project files.  The sole writer is snapshotGamificationLedger.
 */

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { resolveFactoryRoot, resolveProjectPath } from "@/lib/config/config";
import { normalizeEventName, UNKNOWN_ACCOUNTING_AT } from "@/lib/events/event-contract";
import type { Event } from "@/lib/events/events";
import { readPortfolio } from "@/lib/portfolio/portfolio";
import { readStatusWithLiveInboxCounts } from "@/lib/status/status";
import { listWorkOrders } from "@/lib/work-orders/work-orders";
import type { GuildOutcomes } from "./gamification";

export type DurableEventFact = {
  readonly key: string;
  readonly event: Event;
  readonly oracle: {
    readonly kind: "work-order" | "frd-gate" | "project-complete" | "hardening-artifact";
    readonly ref: string;
  };
  readonly recordedAt: string;
};

export type GamificationLedgerV2 = {
  readonly version: 2;
  readonly updatedAt: string;
  readonly totals: {
    readonly workOrdersDone: number;
    readonly phasesCompleted: number;
    readonly releases: number;
    readonly greenTestRuns: number;
  };
  /** Monotonic set: facts are added, never removed or counted twice. */
  readonly facts: Readonly<Record<string, DurableEventFact>>;
  readonly migration: { readonly v1ImportedAt?: string };
};

/** Read-only compatibility type for v1 fixtures; all writes are v2. */
export type GamificationLedger =
  | GamificationLedgerV2
  | {
      readonly version: 1;
      readonly updatedAt: string;
      readonly totals: {
        readonly workOrdersDone: number;
        readonly phasesCompleted: number;
        readonly releases: number;
      };
    };

export type LedgerReadResult =
  | { readonly ok: true; readonly ledger: GamificationLedgerV2; readonly migrated: boolean }
  | { readonly ok: false; readonly reason: "corrupt"; readonly ledger: GamificationLedgerV2 };

export function zeroLedger(): GamificationLedgerV2 {
  return {
    version: 2,
    updatedAt: new Date(0).toISOString(),
    totals: { workOrdersDone: 0, phasesCompleted: 0, releases: 0, greenTestRuns: 0 },
    facts: {},
    migration: {},
  };
}

function nat(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function validEvent(value: unknown): value is Event {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const event = value as Record<string, unknown>;
  return (
    typeof event.event === "string" &&
    typeof event.at === "string" &&
    Number.isFinite(Date.parse(event.at))
  );
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: strict schema parsing enumerates each fail-closed branch.
function parseV2(value: unknown): GamificationLedgerV2 | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const obj = value as Record<string, unknown>;
  if (
    obj.version !== 2 ||
    typeof obj.updatedAt !== "string" ||
    !Number.isFinite(Date.parse(obj.updatedAt))
  )
    return null;
  if (obj.totals === null || typeof obj.totals !== "object" || Array.isArray(obj.totals))
    return null;
  const totals = obj.totals as Record<string, unknown>;
  const workOrdersDone = nat(totals.workOrdersDone);
  const phasesCompleted = nat(totals.phasesCompleted);
  const releases = nat(totals.releases);
  const greenTestRuns = nat(totals.greenTestRuns);
  if (
    workOrdersDone === null ||
    phasesCompleted === null ||
    releases === null ||
    greenTestRuns === null
  )
    return null;
  if (obj.facts === null || typeof obj.facts !== "object" || Array.isArray(obj.facts)) return null;
  const facts: Record<string, DurableEventFact> = {};
  for (const [key, raw] of Object.entries(obj.facts as Record<string, unknown>)) {
    if (
      !/^[a-f0-9]{64}$/.test(key) ||
      raw === null ||
      typeof raw !== "object" ||
      Array.isArray(raw)
    )
      return null;
    const fact = raw as Record<string, unknown>;
    const oracle = fact.oracle;
    if (
      fact.key !== key ||
      !validEvent(fact.event) ||
      typeof fact.recordedAt !== "string" ||
      oracle === null ||
      typeof oracle !== "object" ||
      Array.isArray(oracle)
    )
      return null;
    const o = oracle as Record<string, unknown>;
    if (
      !["work-order", "frd-gate", "project-complete", "hardening-artifact"].includes(
        String(o.kind),
      ) ||
      typeof o.ref !== "string"
    )
      return null;
    const candidate = fact as unknown as DurableEventFact;
    if (factKey(candidate.event, candidate.oracle) !== key) return null;
    if (
      JSON.stringify(canonicalFactEvent(candidate.event, candidate.oracle)) !==
      JSON.stringify(candidate.event)
    )
      return null;
    facts[key] = candidate;
  }
  const migration = obj.migration;
  if (migration === null || typeof migration !== "object" || Array.isArray(migration)) return null;
  const migrationRecord = migration as Record<string, unknown>;
  if (
    migrationRecord.v1ImportedAt !== undefined &&
    typeof migrationRecord.v1ImportedAt !== "string"
  )
    return null;
  return {
    version: 2,
    updatedAt: obj.updatedAt,
    totals: { workOrdersDone, phasesCompleted, releases, greenTestRuns },
    facts,
    migration: migration as GamificationLedgerV2["migration"],
  };
}

function migrateV1(value: unknown): GamificationLedgerV2 | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const obj = value as Record<string, unknown>;
  if (
    obj.version !== 1 ||
    obj.totals === null ||
    typeof obj.totals !== "object" ||
    Array.isArray(obj.totals)
  )
    return null;
  const t = obj.totals as Record<string, unknown>;
  const workOrdersDone = nat(t.workOrdersDone);
  const phasesCompleted = nat(t.phasesCompleted);
  const releases = nat(t.releases);
  if (workOrdersDone === null || phasesCompleted === null || releases === null) return null;
  const now = new Date().toISOString();
  return {
    ...zeroLedger(),
    updatedAt: now,
    totals: { workOrdersDone, phasesCompleted, releases, greenTestRuns: 0 },
    migration: { v1ImportedAt: now },
  };
}

export function readLedgerResult(
  ledgerPath = path.join(resolveFactoryRoot(), "factory", "gamification-ledger.json"),
): LedgerReadResult {
  let raw: string;
  try {
    raw = fs.readFileSync(ledgerPath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT")
      return { ok: true, ledger: zeroLedger(), migrated: false };
    return { ok: false, reason: "corrupt", ledger: zeroLedger() };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "corrupt", ledger: zeroLedger() };
  }
  const v2 = parseV2(parsed);
  if (v2) return { ok: true, ledger: v2, migrated: false };
  const migrated = migrateV1(parsed);
  if (migrated) return { ok: true, ledger: migrated, migrated: true };
  return { ok: false, reason: "corrupt", ledger: zeroLedger() };
}

/** Fail-soft UI reader. The writer uses readLedgerResult and never overwrites corruption. */
export function readLedger(ledgerPath?: string): GamificationLedgerV2 {
  return readLedgerResult(ledgerPath).ledger;
}

export function mergeLedgerOutcomes(
  live: GuildOutcomes,
  ledger: GamificationLedger,
): GuildOutcomes {
  const green = ledger.version === 2 ? ledger.totals.greenTestRuns : 0;
  return {
    workOrdersDone: Math.max(live.workOrdersDone, ledger.totals.workOrdersDone),
    phasesCompleted: Math.max(live.phasesCompleted, ledger.totals.phasesCompleted),
    releases: Math.max(live.releases, ledger.totals.releases),
    greenTestRuns: Math.max(live.greenTestRuns, green),
    weeklyStreak: live.weeklyStreak,
  };
}

export function needsSnapshot(live: GuildOutcomes, ledger: GamificationLedger): boolean {
  return (
    live.workOrdersDone > ledger.totals.workOrdersDone ||
    live.phasesCompleted > ledger.totals.phasesCompleted ||
    live.releases > ledger.totals.releases ||
    live.greenTestRuns > (ledger.version === 2 ? ledger.totals.greenTestRuns : 0)
  );
}

type ProjectOracle = {
  root: string;
  workOrders: ReturnType<typeof listWorkOrders>;
  phase: string;
  running: boolean;
};

export function realInProject(root: string, target: string, kind: "file" | "directory"): boolean {
  try {
    const rootEntry = fs.lstatSync(root);
    const entry = fs.lstatSync(target);
    if (rootEntry.isSymbolicLink() || !rootEntry.isDirectory() || entry.isSymbolicLink())
      return false;
    if (kind === "file" ? !entry.isFile() : !entry.isDirectory()) return false;
    return (
      fs.realpathSync(target) ===
      path.join(fs.realpathSync(root), path.relative(path.resolve(root), path.resolve(target)))
    );
  } catch {
    return false;
  }
}

function projectOracles(): Map<string, ProjectOracle> {
  const map = new Map<string, ProjectOracle>();
  for (const entry of readPortfolio(path.join(resolveFactoryRoot(), "factory", "portfolio.md"))) {
    const root = resolveProjectPath(entry.path);
    const status = readStatusWithLiveInboxCounts(root);
    const name = path.basename(root);
    const statusSafe = realInProject(root, path.join(root, ".pandacorp", "status.yaml"), "file");
    map.set(name, {
      root,
      workOrders: listWorkOrders(root),
      phase: statusSafe && status.present && status.status ? (status.status.phase ?? "") : "",
      running: statusSafe ? Boolean(status.present && status.status?.running) : true,
    });
  }
  return map;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: each result kind has a distinct canonical oracle and fails closed.
function eventOracle(
  event: Event,
  projects: Map<string, ProjectOracle>,
): DurableEventFact["oracle"] | null {
  if ((event.runtime !== "claude" && event.runtime !== "codex") || !event.project) return null;
  const project = projects.get(event.project);
  if (!project) return null;
  const semantic = event.semanticName ?? normalizeEventName(event.event).semanticName;
  if (semantic.startsWith("legacy.")) return null;
  const wo = event.workOrder
    ? project.workOrders.find((item) => item.id === event.workOrder && item.state === "done")
    : undefined;
  if (
    (semantic === "agent.done" ||
      semantic === "achievement.recorded" ||
      semantic === "test.green") &&
    wo
  ) {
    if (semantic === "agent.done" && event.result !== "green" && event.status !== "ok") return null;
    return { kind: "work-order", ref: `${event.project}:${wo.id}` };
  }
  const pass =
    event.verdict === "PASS" || event.verdict === "APPROVED" || event.result === "verified";
  if (
    (semantic === "gate.result" || semantic === "gate.verdict" || semantic === "review.verdict") &&
    pass &&
    event.frd
  ) {
    const matching = project.workOrders.filter((item) => item.frd === event.frd);
    if (matching.length > 0 && matching.every((item) => item.state === "done"))
      return { kind: "frd-gate", ref: `${event.project}:${event.frd}` };
  }
  if (
    semantic === "build.complete" &&
    !project.running &&
    (project.phase === "implementation" || project.phase === "release") &&
    project.workOrders.length > 0 &&
    project.workOrders.every((item) => item.state === "done")
  ) {
    return { kind: "project-complete", ref: `${event.project}:${project.phase}` };
  }
  if (semantic === "hardening.stage" && event.status === "ok") {
    const reviewDir = path.join(project.root, "docs", "reviews");
    const analytics = path.join(project.root, "docs", "analytics", "events.md");
    let hasReview = false;
    try {
      hasReview =
        realInProject(project.root, reviewDir, "directory") &&
        fs
          .readdirSync(reviewDir)
          .some(
            (name) =>
              /^security-\d{4}-\d{2}-\d{2}\.md$/.test(name) &&
              realInProject(project.root, path.join(reviewDir, name), "file"),
          );
    } catch {
      /* no oracle */
    }
    if (hasReview && realInProject(project.root, analytics, "file"))
      return { kind: "hardening-artifact", ref: `${event.project}:${event.stage ?? "all"}` };
  }
  return null;
}

function factKey(event: Event, oracle: DurableEventFact["oracle"]): string {
  const semantic = event.semanticName ?? normalizeEventName(event.event).semanticName;
  const accountingAct = oracle.kind === "work-order" ? "work-order.completed" : semantic;
  // Deliberately excludes declared event_id/run_id and alias/display spelling.
  return createHash("sha256")
    .update(JSON.stringify([accountingAct, oracle.kind, oracle.ref]))
    .digest("hex");
}

function canonicalFactEvent(source: Event, oracle: DurableEventFact["oracle"]): Event {
  const project = oracle.ref.split(":", 1)[0] ?? source.project ?? "";
  // Do not preserve source-controlled agent/role/mode/time/verdict fields. The
  // canonical event contains only facts established by the oracle. A WO fact is
  // intentionally not AgentDone: there is no durable oracle for which agent did it.
  if (oracle.kind === "work-order")
    return {
      event: "DurableWorkOrderComplete",
      semanticName: "work-order.completed",
      at: UNKNOWN_ACCOUNTING_AT,
      project,
      workOrder: oracle.ref.slice(project.length + 1),
      subject: oracle.ref,
    };
  if (oracle.kind === "frd-gate")
    return {
      event: "GateVerdict",
      semanticName: "gate.verdict",
      at: UNKNOWN_ACCOUNTING_AT,
      project,
      frd: oracle.ref.slice(project.length + 1),
      subject: oracle.ref,
      verdict: "PASS",
    };
  if (oracle.kind === "project-complete")
    return {
      event: "BuildComplete",
      semanticName: "build.complete",
      at: UNKNOWN_ACCOUNTING_AT,
      project,
      subject: oracle.ref,
    };
  return {
    event: "HardeningStage",
    semanticName: "hardening.stage",
    at: UNKNOWN_ACCOUNTING_AT,
    project,
    subject: oracle.ref,
    status: "ok",
  };
}

/** Returns only events safe to use for durable XP/achievement predicates. */
export function corroborateEvents(
  events: readonly Event[],
  ledger: GamificationLedgerV2,
  now = new Date().toISOString(),
): DurableEventFact[] {
  const projects = projectOracles();
  const out: DurableEventFact[] = [];
  for (const event of events) {
    const oracle = eventOracle(event, projects);
    if (!oracle) continue;
    const canonical = canonicalFactEvent(event, oracle);
    const key = factKey(canonical, oracle);
    if (ledger.facts[key] || out.some((fact) => fact.key === key)) continue;
    out.push({ key, event: canonical, oracle, recordedAt: now });
  }
  return out;
}

export function durableEvents(ledger: GamificationLedger): Event[] {
  if (ledger.version !== 2) return [];
  return Object.values(ledger.facts)
    .map((fact) => fact.event)
    .sort((a, b) => a.at.localeCompare(b.at));
}

export function mergeLedger(
  ledger: GamificationLedgerV2,
  live: GuildOutcomes,
  facts: readonly DurableEventFact[],
  now = new Date().toISOString(),
): GamificationLedgerV2 {
  const nextFacts = { ...ledger.facts };
  for (const fact of facts) nextFacts[fact.key] = fact;
  return {
    ...ledger,
    version: 2,
    updatedAt: now,
    totals: {
      workOrdersDone: Math.max(ledger.totals.workOrdersDone, live.workOrdersDone),
      phasesCompleted: Math.max(ledger.totals.phasesCompleted, live.phasesCompleted),
      releases: Math.max(ledger.totals.releases, live.releases),
      // No durable test-run oracle exists yet. VERIFIED WOs already earn WO XP;
      // counting a transport `test_ok` as well would double-reward one result.
      greenTestRuns: ledger.totals.greenTestRuns,
    },
    facts: nextFacts,
  };
}

/** Atomic, symlink-refusing write. Caller must hold the sibling lock directory. */
export function atomicWriteLedger(ledgerPath: string, ledger: GamificationLedgerV2): void {
  fs.mkdirSync(path.dirname(ledgerPath), { recursive: true });
  const parent = fs.lstatSync(path.dirname(ledgerPath));
  if (parent.isSymbolicLink() || !parent.isDirectory())
    throw new Error("ledger parent must be a real directory");
  try {
    if (fs.lstatSync(ledgerPath).isSymbolicLink()) throw new Error("ledger path is a symlink");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const temp = `${ledgerPath}.tmp-${process.pid}-${Date.now()}`;
  const fd = fs.openSync(temp, "wx", 0o600);
  try {
    fs.writeFileSync(fd, `${JSON.stringify(ledger, null, 2)}\n`, "utf8");
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(temp, ledgerPath);
  const dir = fs.openSync(path.dirname(ledgerPath), "r");
  try {
    fs.fsyncSync(dir);
  } finally {
    fs.closeSync(dir);
  }
}
