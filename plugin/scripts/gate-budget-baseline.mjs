#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { reporterTests } from '../templates/shared/.pandacorp/test-gate-policy.mjs';
try {
  const [projectArg, flag, source] = process.argv.slice(2), project = resolve(projectArg ?? '.');
  if (flag !== '--from' || !source) throw new Error('usage: gate-budget-baseline.mjs <project> --from <green-full-gate-report-or-reporter.json>');
  const report = JSON.parse(readFileSync(source,'utf8'));
  let tests;
  if (report.scope === 'full' && report.green === true && Array.isArray(report.test_timings) && ['vitest','playwright'].every(r=>report.subgates?.some(g=>g.name===r && g.exit===0))) tests=report.test_timings;
  else {
    // Raw reporter JSON does not attest full scope. Require the matching green gate report,
    // including exact timings, so a subset cannot silently reset the baseline.
    const gate=JSON.parse(readFileSync(resolve(project,'.pandacorp/run/gate-report.json'),'utf8'));
    const runner=Array.isArray(report.testResults)?'vitest':'playwright';
    tests=reporterTests(runner,report,project);
    if (gate.scope!=='full' || gate.green!==true || !Array.isArray(gate.test_timings) || !tests.length || tests.some(t=>!gate.test_timings.some(g=>JSON.stringify(g)===JSON.stringify(t)))) throw new Error('reporter requires matching green full gate report with test_timings');
    tests=gate.test_timings;
  }
  if (!tests.length || tests.some(t=>typeof t.id!=='string' || !['vitest','playwright'].includes(t.runner) || !Number.isFinite(t.duration_ms) || t.duration_ms<0 || !['passed','skipped','pending','todo','disabled'].includes(t.status))) throw new Error('invalid/non-green test timings');
  const file=resolve(project,'.pandacorp/gate-budget.json');
  const old=existsSync(file)?JSON.parse(readFileSync(file,'utf8')):{};
  const baseline=Object.fromEntries(tests.map(t=>[t.id,t.duration_ms]));
  writeFileSync(file,JSON.stringify({schemaVersion:1,addedTestTimeBudgetMs:old.addedTestTimeBudgetMs ?? {vitest:30000,playwright:30000},baseline},null,2)+'\n');
  console.log('Baseline generated from green full run; review and commit it. No automatic cap increase.');
} catch (error) { console.error(error.message); process.exitCode=1; }
