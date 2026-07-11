"use server";

import { randomUUID } from "node:crypto";
/** The only writer for factory/gamification-ledger.json. */
import fs from "node:fs";
import path from "node:path";
import { resolveFactoryRoot, resolveProjectPath } from "@/lib/config/config";
import { readEvents } from "@/lib/events/events";
import { deriveGuildOutcomes } from "@/lib/gamification/gamification";
import {
  atomicWriteLedger,
  corroborateEvents,
  mergeLedger,
  readLedgerResult,
  realInProject,
} from "@/lib/gamification/ledger";
import { readPortfolio } from "@/lib/portfolio/portfolio";
import { readStatusWithLiveInboxCounts } from "@/lib/status/status";
import { listWorkOrders } from "@/lib/work-orders/work-orders";

type LockOwner = { readonly token: string; readonly pid: number; readonly acquiredAt: string };

function pidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: lock acquisition enumerates crash/reclaim safety branches.
function acquireLock(lockPath: string): LockOwner | null {
  const owner: LockOwner = {
    token: randomUUID(),
    pid: process.pid,
    acquiredAt: new Date().toISOString(),
  };
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      fs.mkdirSync(lockPath, { mode: 0o700 });
      fs.writeFileSync(path.join(lockPath, "owner.json"), JSON.stringify(owner), {
        mode: 0o600,
        flag: "wx",
      });
      return owner;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      const entry = fs.lstatSync(lockPath);
      if (entry.isSymbolicLink() || !entry.isDirectory())
        throw new Error("ledger lock path is unsafe");
      let prior: LockOwner | null = null;
      try {
        prior = JSON.parse(fs.readFileSync(path.join(lockPath, "owner.json"), "utf8")) as LockOwner;
      } catch {
        /* incomplete acquisition is reclaimable */
      }
      const age = prior ? Date.now() - Date.parse(prior.acquiredAt) : Number.POSITIVE_INFINITY;
      if (prior && pidAlive(prior.pid) && age < 600_000) return null;
      try {
        fs.unlinkSync(path.join(lockPath, "owner.json"));
      } catch {
        /* absent */
      }
      try {
        fs.rmdirSync(lockPath);
      } catch {
        return null;
      }
    }
  }
  return null;
}

function releaseLock(lockPath: string, owner: LockOwner): void {
  try {
    const current = JSON.parse(
      fs.readFileSync(path.join(lockPath, "owner.json"), "utf8"),
    ) as LockOwner;
    if (current.token !== owner.token) return;
    fs.unlinkSync(path.join(lockPath, "owner.json"));
    fs.rmdirSync(lockPath);
  } catch {
    /* retain unexpected evidence for inspection */
  }
}

/**
 * Reconciles from server-side canonical files. No client-provided totals or event
 * identities cross this trust boundary.
 */
export async function snapshotGamificationLedger(_untrustedClientInput?: unknown): Promise<void> {
  const ledgerPath = path.join(resolveFactoryRoot(), "factory", "gamification-ledger.json");
  const lockPath = `${ledgerPath}.lock`;
  const owner = acquireLock(lockPath);
  if (!owner) return;
  try {
    const current = readLedgerResult(ledgerPath);
    if (!current.ok)
      throw new Error("gamification ledger is corrupt; refusing destructive recovery");
    const roots = readPortfolio(path.join(resolveFactoryRoot(), "factory", "portfolio.md")).map(
      (entry) => resolveProjectPath(entry.path),
    );
    const statuses = roots.map((root) =>
      realInProject(root, path.join(root, ".pandacorp", "status.yaml"), "file")
        ? readStatusWithLiveInboxCounts(root)
        : { present: false as const, malformed: false as const, status: null },
    );
    const eventsSnapshot = readEvents({ cap: 100_000 });
    const workOrdersDoneLive = roots.reduce(
      (sum, root) => sum + listWorkOrders(root).filter((wo) => wo.state === "done").length,
      0,
    );
    // Event-derived XP is reconciled separately from corroborated facts; raw
    // transport lines never enter totals.
    const live = deriveGuildOutcomes({ statuses, eventsSnapshot: null, workOrdersDoneLive });
    const facts = corroborateEvents(eventsSnapshot.events, current.ledger);
    const next = mergeLedger(current.ledger, live, facts);
    if (
      current.migrated ||
      facts.length > 0 ||
      JSON.stringify(next.totals) !== JSON.stringify(current.ledger.totals)
    ) {
      atomicWriteLedger(ledgerPath, next);
    }
  } finally {
    releaseLock(lockPath, owner);
  }
}
