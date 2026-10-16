/**
 * The worker pool and the staged (all-or-nothing) writes every browser stage uses.
 * P workers share one browser; each keeps one warm context per width x theme and prefers the units of the context it
 * already holds, so a context is opened about once per worker and key instead of once per capture.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { closeHandle, openHandle } from './lib.mjs';

const keyOf = (k) => `${k.width}x${k.theme}`;
const RETRYABLE = /Timeout|Target (page, context or browser )?closed|has been closed|crash|Navigation failed/i;

/** A batch in which at least one unit failed; `failures` lists them, `results` holds what did finish. */
export class PoolError extends Error {
  constructor(label, failures, results) {
    super(`${label}: ${failures.length} unit(s) failed:\n  ${failures.slice(0, 10).map((f) => `${f.unit.label || keyOf(f.unit.key)}: ${String(f.error.message).split('\n').slice(0, 3).join(' | ')}`).join('\n  ')}`);
    this.failures = failures;
    this.results = results;
  }
}

/**
 * Runs `run(unit, handle)` for every unit on P workers. A timeout or crashed page is retried once on a fresh context;
 * any other failure stops the batch (workers finish their current unit) and throws a PoolError.
 * @param {{browser: object, cfg: object, units: {key: {width: number, theme: string}, label?: string}[], run: (unit: object, handle: object) => Promise<unknown>, workers?: number, label?: string}} opts
 * @returns {Promise<unknown[]>} the results, in unit order
 */
export async function runPool({ browser, cfg, units, run, workers = cfg.workers, label = 'batch' }) {
  const queues = new Map();
  units.forEach((u, i) => { const k = keyOf(u.key); if (!queues.has(k)) queues.set(k, []); queues.get(k).push(i); });
  const results = new Array(units.length);
  const failures = [];
  let done = 0;
  let nextReport = 0.1;
  const take = (current) => {
    if (current && queues.get(current)?.length) return queues.get(current).shift();
    let best = null;
    for (const [k, q] of queues) if (q.length && (!best || q.length > queues.get(best).length)) best = k;
    return best ? queues.get(best).shift() : undefined;
  };
  const worker = async () => {
    let handle = null;
    try {
      for (;;) {
        if (failures.length) return;
        const i = take(handle && keyOf(handle));
        if (i === undefined) return;
        const unit = units[i];
        if (!handle || keyOf(handle) !== keyOf(unit.key)) {
          if (handle) await closeHandle(handle);
          handle = await openHandle(browser, cfg, unit.key);
        }
        try {
          results[i] = await run(unit, handle);
        } catch (e) {
          if (!RETRYABLE.test(String(e && e.message))) { failures.push({ unit, error: e }); continue; }
          console.error(`retry after ${String(e.message).split('\n')[0]}: ${unit.label || keyOf(unit.key)}`);
          await closeHandle(handle);
          handle = await openHandle(browser, cfg, unit.key);
          try { results[i] = await run(unit, handle); } catch (e2) { failures.push({ unit, error: e2 }); continue; }
        }
        done++;
        if (units.length >= 20 && done / units.length >= nextReport) { process.stderr.write(`  ${label}: ${done}/${units.length}\n`); nextReport += 0.1; }
      }
    } finally {
      if (handle) await closeHandle(handle);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(workers, units.length)) }, worker));
  if (failures.length) throw new PoolError(label, failures, results);
  return results;
}

/**
 * A fresh staging folder (outside the repository) for one batch.
 * @param {string} name prefix
 * @returns {string} absolute path
 */
export function makeStage(name) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `fidelity-${name}-`));
}

/**
 * Publishes a staged batch: for each target folder, deletes the files `stale` matches that the batch does not replace,
 * then copies the staged files in. Call it only after every capture of the batch succeeded.
 * @param {{from: string, to: string, stale?: RegExp}[]} dirs staged folder -> target folder
 * @returns {number} files written
 */
export function publishDirs(dirs) {
  let n = 0;
  for (const { from, to, stale } of dirs) {
    fs.mkdirSync(to, { recursive: true });
    const incoming = new Set(fs.readdirSync(from));
    if (stale) for (const f of fs.readdirSync(to)) if (stale.test(f) && !incoming.has(f)) fs.rmSync(path.join(to, f));
    for (const f of incoming) { fs.copyFileSync(path.join(from, f), path.join(to, f)); n++; }
  }
  return n;
}

/**
 * Writes a file only when its content changed (keeps mtimes, and so the stage hashes, stable).
 * @param {string} file target
 * @param {string|Buffer} content
 * @returns {boolean} whether it was written
 */
export function writeIfChanged(file, content) {
  const buf = Buffer.isBuffer(content) ? content : Buffer.from(content);
  if (fs.existsSync(file) && fs.readFileSync(file).equals(buf)) return false;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, buf);
  fs.renameSync(tmp, file);
  return true;
}
