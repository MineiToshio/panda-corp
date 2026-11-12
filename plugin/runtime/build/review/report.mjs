// review-record report validation: the report file, the schema plus the cross-field rules, probe path rules.
import * as fsp from "node:fs/promises";
import path from "node:path";
import { assertValid, loadSchema } from "../fsx.mjs";
import { BLOCKING_SEVERITIES, err, unique } from "./common.mjs";

const MAX_REPORT_BYTES = 4 * 1024 * 1024;

/**
 * Is `rel` a path a review may add as a probe (A2: the test globs only, repo-relative, no traversal)?
 * @param {string} rel
 * @returns {boolean}
 */
export function isProbePath(rel) {
  if (typeof rel !== "string" || rel === "" || rel.includes("\\") || rel.includes("\0") || path.posix.isAbsolute(rel) || path.posix.normalize(rel) !== rel) return false;
  const segments = rel.split("/");
  if (segments.includes("..")) return false;
  const dir = segments.slice(0, -1);
  return dir.includes("_tests") || /\.(test|spec)\.[^/]+$/.test(rel) || (rel.startsWith("e2e/") && dir.length > 0) || rel.startsWith("src/test/");
}

/** Counts of findings by severity (the `review_recorded` shape). */
export const countFindings = (findings) => findings.reduce((acc, f) => ({ ...acc, [f.severity]: acc[f.severity] + 1 }), { critical: 0, high: 0, medium: 0, low: 0 });

export async function loadReport({ file, report }, fs) {
  if (report !== undefined) return report;
  if (typeof file !== "string" || !file) throw err("USAGE", "review-record needs --file <review.json>");
  let text;
  try {
    if ((await fs.stat(file)).size > MAX_REPORT_BYTES) throw new Error("too large");
    text = await fs.readFile(file, "utf8");
  } catch { throw err("INVALID_INPUT", `review file is unreadable or too large: ${file}`); }
  try { return JSON.parse(text); } catch { throw err("INVALID_INPUT", `review file is not valid JSON: ${file}`); }
}

/**
 * Validate a review report: the schema plus the cross-field rules the schema cannot state. Exit 6 on any failure.
 * @param {object} report parsed review.json
 * @param {{unit: string, token: string}} expect the unit and token the CLI was called with (the report echoes both)
 * @param {{fs?: object}} [deps]
 * @returns {Promise<object>} the report
 * @throws INVALID_INPUT
 */
export async function validateReviewReport(report, expect, deps = {}) {
  assertValid(await loadSchema("review-report", { fs: deps.fs ?? fsp }), report, { label: "review report", code: "INVALID_INPUT" });
  if (report.unit !== expect.unit) throw err("INVALID_INPUT", `review report is for unit ${report.unit}, not ${expect.unit}`);
  if (report.token !== expect.token) throw err("INVALID_INPUT", "review report does not echo the unit token");
  const { verdict, findings, probes, traceability, doubt } = report;
  if ((verdict === "doubt") !== (doubt !== null)) throw err("INVALID_INPUT", 'a review report carries `doubt` exactly when its verdict is "doubt"');
  if ((verdict === "reopen" || verdict === "blocked") && findings.length === 0) throw err("INVALID_INPUT", `verdict "${verdict}" needs at least one finding (it is the reason)`);
  if (verdict === "pass" && findings.some((f) => BLOCKING_SEVERITIES.includes(f.severity))) throw err("INVALID_INPUT", 'verdict "pass" cannot carry a critical or high finding');
  if (verdict === "pass" && traceability.some((t) => t.status === "fail")) throw err("INVALID_INPUT", 'verdict "pass" cannot carry a failing traceability entry');
  const paths = probes.map((p) => p.path);
  const bad = paths.find((p) => !isProbePath(p));
  if (bad !== undefined) throw err("INVALID_INPUT", `probe path is not an allowed test path: ${bad}`);
  if (unique(paths).length !== paths.length) throw err("INVALID_INPUT", "a probe path is listed twice");
  const stray = findings.find((f) => f.probe !== null && !paths.includes(f.probe));
  if (stray) throw err("INVALID_INPUT", `finding ${stray.id} names a probe that is not in probes[]: ${stray.probe}`);
  return report;
}
