#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { reporterTests, readTestId, TEST_ID_ENCODING } from '../templates/shared/.pandacorp/test-gate-policy.mjs';
try {
  const [projectArg, flag, source] = process.argv.slice(2), project = resolve(projectArg ?? '.');
  if (flag !== '--from' || !source) throw new Error('usage: gate-budget-baseline.mjs <project> --from <green-full-gate-report-or-reporter.json>');
  const report = JSON.parse(readFileSync(source,'utf8'));
  const normalize=(tests,encoding)=>tests.map(t=>({...t,id:readTestId(t.id,encoding)}));
  let tests;
  if (report.scope === 'full' && report.green === true && Array.isArray(report.test_timings) && ['vitest','playwright'].every(r=>report.subgates?.some(g=>g.name===r && g.exit===0))) tests=normalize(report.test_timings,report.test_id_encoding);
  else {
    // Raw reporter JSON does not attest full scope. Require the matching green gate report,
    // including exact timings, so a subset cannot silently reset the baseline.
    const gate=JSON.parse(readFileSync(resolve(project,'.pandacorp/run/gate-report.json'),'utf8'));
    const gateTests=Array.isArray(gate.test_timings)?normalize(gate.test_timings,gate.test_id_encoding):null;
    const runner=Array.isArray(report.testResults)?'vitest':'playwright';
    tests=reporterTests(runner,report,project);
    if (gate.scope!=='full' || gate.green!==true || !gateTests || !tests.length || tests.some(t=>!gateTests.some(g=>g.id===t.id && g.runner===t.runner && g.status===t.status && g.duration_ms===t.duration_ms))) throw new Error('reporter requires matching green full gate report with test_timings');
    tests=gateTests;
  }
  if (!tests.length || tests.some(t=>typeof t.id!=='string' || !['vitest','playwright'].includes(t.runner) || !Number.isFinite(t.duration_ms) || t.duration_ms<0 || !['passed','skipped','pending','todo','disabled'].includes(t.status))) throw new Error('invalid/non-green test timings');
  const file=resolve(project,'.pandacorp/gate-budget.json');
  const old=existsSync(file)?JSON.parse(readFileSync(file,'utf8')):{};
  const baseline=Object.fromEntries(tests.map(t=>[t.id,t.duration_ms]));
  writeFileSync(file,JSON.stringify({schemaVersion:1,id_encoding:TEST_ID_ENCODING,addedTestTimeBudgetMs:old.addedTestTimeBudgetMs ?? {vitest:30000,playwright:30000},baseline},null,2)+'\n');
  console.log('Baseline generated from green full run; review and commit it. No automatic cap increase.');
} catch (error) { console.error(error.message); process.exitCode=1; }
