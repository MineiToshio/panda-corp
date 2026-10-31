import fs from "node:fs";
import path from "node:path";
import { readBuildTimeline } from "@/lib/build-track/build-track";
import { readChangeQueue } from "@/lib/changes/changes";
import { readActivityLog, readDecisionSource } from "@/lib/docs/activity";
import { readArtifact, readDigestWorkOrders } from "@/lib/spec/read-artifacts";

function readChanges(projectPath: string) {
  for (const relative of [".pandacorp/inbox/changes", ".pandacorp/inbox/changes/done"]) {
    try {
      fs.readdirSync(path.join(projectPath, relative));
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") continue;
      throw error;
    }
  }
  const queue = readChangeQueue(projectPath);
  if (queue.errors.length) throw new Error("Unreadable change queue");
  return queue.items;
}

/** Read each independent source explicitly; a failed card never impersonates an empty one. */
export function readSummary(projectPath: string) {
  const source = readArtifact(() => readDecisionSource(projectPath), {
    decisions: [],
    invalid: false,
  });
  const decisions = {
    value: source.value.decisions,
    ...(source.error || source.value.invalid
      ? { error: source.error ?? "Unrecognized decision heading" }
      : {}),
  };
  const changes = readArtifact(() => readChanges(projectPath), []);
  const orders = readArtifact(() => readDigestWorkOrders(projectPath), []);
  const timeline = readArtifact(() => readBuildTimeline(projectPath, orders.value), null);
  return { decisions, changes, orders, timeline, activityLog: readActivityLog(projectPath) };
}
