#!/usr/bin/env node
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRuntimeEventEmitter, normalizeRuntimeEvent } from "../runtime/event-transport.mjs";

const root = await mkdtemp(path.join(os.tmpdir(), "pandacorp-event-transport-"));
try {
  const journal = path.join(root, "journal.ndjson");
  const transport = path.join(root, "codex.ndjson");
  const emit = createRuntimeEventEmitter({ runtime: "codex", runId: "run-1", project: path.join(root, "demo"), journalFile: journal, transportFile: transport, idFactory: () => "event-1", now: () => "2026-07-11T03:00:00Z" });
  const payload = await emit("dispatch_started", { dispatch_id: "WO-1", tier: "STANDARD" });
  assert.deepEqual(payload, { at: "2026-07-11T03:00:00Z", runtime: "codex", run_id: "run-1", event_id: "event-1", event: "AgentWorking", semantic_name: "agent.working", project: "demo", subject: "WO-1", data: { dispatch_id: "WO-1", tier: "STANDARD" } });
  assert.equal(await readFile(journal, "utf8"), `${JSON.stringify(payload)}\n`);
  assert.equal(await readFile(transport, "utf8"), `${JSON.stringify(payload)}\n`);
  const fail = await emit("verify_finished", { code: 1, label: "gate" });
  assert.equal(fail.semantic_name, "test.failed");
  assert.equal(fail.event, "test_fail");
  const failSoft = createRuntimeEventEmitter({ runtime: "codex", runId: "run-2", project: path.join(root, "demo"), journalFile: journal, transportFile: root, idFactory: () => "event-transport-red", now: () => "2026-07-11T03:00:01Z" });
  const survived = await failSoft("lease_released", { reason: "complete" });
  assert.equal(survived.semantic_name, "lease.released");
  assert.match(await readFile(journal, "utf8"), /event-transport-red/);
  assert.equal(normalizeRuntimeEvent("dispatch_finished").semanticName, "dispatch.finished");
  assert.equal(normalizeRuntimeEvent("change_reconciled").semanticName, "change.reconciled");
  console.log("event transport: 12/12 checks passed");
} finally {
  await rm(root, { recursive: true, force: true });
}
