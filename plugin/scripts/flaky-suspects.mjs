#!/usr/bin/env node
// Observations only: no reruns, suppression or exclusions (proposal 43 phase 1).
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
export function flakySuspects(text) {
  const groups = new Map();
  const lines = text.split('\n');
  if (lines.at(-1) === '') lines.pop();
  for (const [i, line] of lines.entries()) {
    try {
      const row = JSON.parse(line);
      if (!row || row.v !== 1 || !['test_id', 'tree', 'project', 'attempt', 'runner'].every(k => typeof row[k] === 'string' && row[k]) ||
          !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(row.tree) || !['passed', 'failed', 'skipped'].includes(row.status) ||
          !Number.isInteger(row.seed) || row.seed < 0 || !(row.worker === null || Number.isInteger(row.worker)) || !Number.isFinite(Date.parse(row.ts))) {
        throw new Error('invalid outcome fields');
      }
      const key = JSON.stringify([row.project, row.tree, row.runner, row.test_id]);
      const group = groups.get(key) ?? { project: row.project, tree: row.tree, runner: row.runner, test_id: row.test_id, passed: 0, failed: 0, attempts: new Set() };
      if (row.status !== 'skipped') { group[row.status]++; group.attempts.add(row.attempt); }
      groups.set(key, group);
    } catch (error) { throw new Error(`test-outcomes line ${i + 1}: ${error.message}`); }
  }
  return [...groups.values()].filter(g => g.passed && g.failed).map(g => ({ ...g, attempts: [...g.attempts].sort() }));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { console.log(JSON.stringify(flakySuspects(readFileSync(process.argv[2] ?? '.pandacorp/run/test-outcomes.jsonl', 'utf8')), null, 2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
