import fs from "node:fs";
import path from "node:path";
import { parseStatsPortada, type StatsPortada } from "./statsSchema";

/** A parsed snapshot without a freshness judgement; joins deliberately retain stale entries. */
export type ParsedPortadaResult =
  | { readonly ok: true; readonly value: StatsPortada }
  | { readonly ok: false; readonly reason: "missing" | "unparseable" };

/** Absolute location shared by the reader, writer and aggregate join. */
export function portadaPath(projectPath: string): string {
  return path.join(projectPath, ".pandacorp", "stats.json");
}

/** Read and parse a portada; only absence is missing, unexpected filesystem errors propagate. */
export function readParsedPortada(projectPath: string): ParsedPortadaResult {
  let raw: string;
  try {
    raw = fs.readFileSync(portadaPath(projectPath), "utf-8");
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") {
      return { ok: false, reason: "missing" };
    }
    throw error;
  }
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "unparseable" };
  }
  const value = parseStatsPortada(json);
  return value === null ? { ok: false, reason: "unparseable" } : { ok: true, value };
}
