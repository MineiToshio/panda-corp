// review-record probes: the per-FRD budget, which probes are kept, and the content hash that pins them.
import { readJournal } from "../journal.mjs";
import { sha256Hex } from "../fsx.mjs";
import { err, frdKey } from "./common.mjs";

/** At most this many probes per FRD beyond one per finding. The number is stated once, in build-engine.md BUILD-10. */
export const PROBE_EXTRA_PER_FRD = 3;

export async function extraProbesUsed(paths, frd, deps) {
  const { events } = await readJournal(paths.journalFile, { fs: deps.fs });
  return events
    .filter((e) => e.type === "review_recorded" && frdKey(e.data?.frd) === frdKey(frd))
    .reduce((sum, e) => sum + Math.max(0, (e.data.probes_committed?.length ?? 0) - Object.values(e.data.findings ?? {}).reduce((a, b) => a + b, 0)), 0);
}

/** Probes to keep: failed-first only, finding-referenced first, capped at one per finding plus the FRD's remaining extras. */
export function selectProbes(report, extraUsed) {
  const referenced = new Set(report.findings.map((f) => f.probe).filter(Boolean));
  const candidates = report.probes.filter((p) => p.failed_first).map((p) => p.path);
  const ordered = [...candidates.filter((p) => referenced.has(p)), ...candidates.filter((p) => !referenced.has(p))];
  const cap = report.findings.length + Math.max(0, PROBE_EXTRA_PER_FRD - extraUsed);
  const skipped = report.probes.filter((p) => !p.failed_first).map((p) => ({ path: p.path, reason: "not_failed_first" }));
  return { kept: ordered.slice(0, cap), skipped: [...skipped, ...ordered.slice(cap).map((p) => ({ path: p, reason: "budget" }))] };
}

export async function hashFile(fs, abs) {
  let data;
  try { data = await fs.readFile(abs); } catch { throw err("INVALID_INPUT", `probe file is missing: ${abs}`); }
  return sha256Hex(data);
}
