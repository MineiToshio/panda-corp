import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import perfSchema from "../../../../plugin/runtime/build/schemas/perf-record.schema.json" with {
  type: "json",
};
import { schemaError } from "./schema";
import { parseJson, readBoundedTail } from "./sources";
import type { BuildSourceError, PerformanceRecord } from "./types";

/** Producer-compatible, server-only host location; injectable for tests without changing HOME. */
export function performanceJournalPath(hostDir?: string): string {
  return path.join(
    hostDir ?? (process.env.PANDACORP_HOST_DIR || path.join(os.homedir(), ".pandacorp/host")),
    "perf/journal.jsonl",
  );
}
/** Bounded tail retaining valid sibling lines and null metrics; attribution is only by basename. */
export function readPerformance(
  project: string,
  file: string,
  errors: BuildSourceError[],
): PerformanceRecord[] {
  let raw: string;
  try {
    raw = readBoundedTail(file);
    if (raw === "" && fs.statSync(file).size > 0) throw new Error("truncated record");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return [];
    errors.push({ path: file, reason: "No se puede leer el historial de rendimiento" });
    return [];
  }
  const rows: PerformanceRecord[] = [];
  for (const [index, line] of raw.split("\n").entries()) {
    if (!line.trim()) continue;
    const linePath = `${file}:cola:${index + 1}`;
    const value = parseJson(line, linePath, errors);
    if (value === undefined) continue;
    const reason = schemaError(value, perfSchema);
    if (reason) {
      errors.push({ path: linePath, reason });
      continue;
    }
    const record = value as PerformanceRecord;
    if (record.project === path.basename(path.resolve(project))) rows.push(record);
  }
  return rows.sort((a, b) => a.start.localeCompare(b.start) || a.run_id.localeCompare(b.run_id));
}
