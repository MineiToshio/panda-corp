import fs from "node:fs";
import path from "node:path";
import { readBuildTimeline } from "@/lib/build-track/build-track";
import { readChangeQueue } from "@/lib/changes/changes";
import { readActivityLog, readDecisionSource } from "@/lib/docs/activity";
import { readArtifact, readDigestWorkOrders } from "@/lib/spec/read-artifacts";
import type { WorkOrderReadError } from "@/lib/work-orders/published";

type PartialSource<T> = { value: T; error?: string; fileErrors?: readonly WorkOrderReadError[] };

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
  return queue;
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
  const changeSource = readArtifact(() => readChanges(projectPath), { items: [], errors: [] });
  const changes: PartialSource<typeof changeSource.value.items> = {
    value: changeSource.value.items,
    error: changeSource.error,
    fileErrors: changeSource.value.errors.map((issue) => ({
      ...issue,
      file: `.pandacorp/inbox/changes/${issue.file}`,
    })),
  };
  const orderSource = readArtifact(() => readDigestWorkOrders(projectPath), {
    items: [],
    errors: [],
  });
  const orders: PartialSource<typeof orderSource.value.items> = {
    value: orderSource.value.items,
    error: orderSource.error,
    fileErrors: orderSource.value.errors,
  };
  const timeline = readArtifact(() => readBuildTimeline(projectPath, orders.value), null);
  return { decisions, changes, orders, timeline, activityLog: readActivityLog(projectPath) };
}
