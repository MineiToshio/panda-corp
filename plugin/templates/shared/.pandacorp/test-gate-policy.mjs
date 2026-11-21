// Shared exact reporter identities and gate policy; no retries or automatic authorizations.
import { readFileSync, existsSync, writeFileSync, lstatSync } from 'node:fs';
import { createHash, verify } from 'node:crypto';
import { resolve, relative, isAbsolute } from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
export const exclusionsPath = '.pandacorp/test-exclusions.json';
export function binding(entry) {
  return createHash('sha256').update(JSON.stringify([entry.id, entry.reason, entry.authorized_by, entry.authorized_at, entry.expires, 'owner-confirmed-v1'])).digest('hex');
}
export function flakySuspects(text) {
  const groups = new Map();
  const lines = text.split('\n');
  if (lines.at(-1) === '') lines.pop();
  for (const [i, line] of lines.entries()) {
    try {
      const row = JSON.parse(line);
      if (!row || row.v !== 1 || !['test_id', 'tree', 'project', 'attempt', 'runner'].every(k => typeof row[k] === 'string' && row[k]) ||
          !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(row.tree) || !['vitest', 'playwright'].includes(row.runner) || !['passed', 'failed', 'skipped'].includes(row.status) ||
          !Number.isInteger(row.seed) || row.seed < 0 || !(row.worker === null || Number.isInteger(row.worker)) || !Number.isFinite(Date.parse(row.ts))) throw new Error('invalid outcome fields');
      const key = JSON.stringify([row.project, row.tree, row.runner, row.test_id]);
      const g = groups.get(key) ?? {project: row.project, tree: row.tree, runner: row.runner, test_id: row.test_id, passed: 0, failed: 0, attempts: new Set()};
      if (row.status !== 'skipped') { g[row.status]++; g.attempts.add(row.attempt); }
      groups.set(key, g);
    } catch (error) { throw new Error(`test-outcomes line ${i + 1}: ${error.message}`); }
  }
  return [...groups.values()].filter(g => g.passed && g.failed).map(g => ({...g, attempts: [...g.attempts].sort()})).sort((a,b) => JSON.stringify([a.project,a.tree,a.runner,a.test_id]).localeCompare(JSON.stringify([b.project,b.tree,b.runner,b.test_id]), 'en'));
}
export function projectIdentity(project) {
  const prefix = execFileSync('git', ['-C', project, 'rev-parse', '--show-prefix'], {encoding:'utf8'}).trim();
  const lines = execFileSync('git', ['-C', project, 'worktree', 'list', '--porcelain'], {encoding:'utf8'}).split('\n');
  let checkout;
  for (const line of lines) {
    if (line.startsWith('worktree ')) checkout = line.slice(9);
    if (line === 'branch refs/heads/main') return resolve(checkout, prefix);
  }
  throw new Error('main checkout required for suspect ledger');
}
function regularPolicy(project, name) {
  if (!lstatSync(resolve(project,'.pandacorp')).isDirectory() || lstatSync(resolve(project,'.pandacorp')).isSymbolicLink() || !lstatSync(resolve(project,name)).isFile() || lstatSync(resolve(project,name)).isSymbolicLink()) throw new Error('policy/key must be regular files under a real .pandacorp directory');
}
export function loadExclusions(project) {
  const file = resolve(project, exclusionsPath);
  if (!existsSync(file)) return [];
  regularPolicy(project, exclusionsPath);
  const status = readFileSync(resolve(project,'.pandacorp/status.yaml'),'utf8');
  const field = key => status.match(new RegExp('^' + key + ':\\s*["\']?([^"\'\\s#]+)', 'm'))?.[1];
  if (JSON.parse(readFileSync(resolve(project,'package.json'),'utf8')).name !== 'mission-control' || field('deploy_target') !== 'internal') throw new Error('exclusions require Mission Control + deploy_target: internal; launched external projects refused');
  // Policy and review are committed inputs, never an ignored local bypass.
  execFileSync('git',['-C',project,'ls-files','--error-unmatch',exclusionsPath],{stdio:'pipe'});
  execFileSync('git',['-C',project,'diff','--exit-code','HEAD','--',exclusionsPath],{stdio:'pipe'});
  const entries = JSON.parse(readFileSync(file,'utf8'));
  if (!Array.isArray(entries)) throw new Error('exclusions must be an array');
  if (!entries.length) return [];
  const identity = projectIdentity(project);
  const suspects = flakySuspects(readFileSync(resolve(identity,'.pandacorp/run/test-outcomes.jsonl'),'utf8'));
  const publicPath = '.pandacorp/exclusion-owner.pub';
  if (entries.length) {
    regularPolicy(project, publicPath);
    execFileSync('git',['-C',project,'ls-files','--error-unmatch',publicPath],{stdio:'pipe'});
    execFileSync('git',['-C',project,'diff','--exit-code','HEAD','--',publicPath],{stdio:'pipe'});
  }
  const ids = new Set();
  for (const e of entries) {
    if (!e || typeof e.id !== 'string' || !e.id.trim() || /[\n\r\0*?]/.test(e.id) || ids.has(e.id) || typeof e.reason !== 'string' || !e.reason.trim() || e.authorized_by !== 'owner') throw new Error('exact unique id, reason and authorized_by: owner required');
    ids.add(e.id);
    for (const key of ['authorized_at','expires']) if (!/^\d{4}-\d{2}-\d{2}$/.test(e[key]) || new Date(e[key]).toISOString().slice(0,10) !== e[key]) throw new Error('invalid exclusion date');
    const start = Date.parse(e.authorized_at), end = Date.parse(e.expires);
    if (end <= start || end - start > 14*86400000 || Date.now() < start || Date.now() > end) throw new Error('exclusion expired, future-dated or exceeds 14 days');
    if (typeof e.authorization !== 'string' || !e.authorization.startsWith('tty-v1:') || !verify(null, Buffer.from(binding(e)), readFileSync(resolve(project, publicPath)), Buffer.from(e.authorization.slice(7),'base64'))) throw new Error('missing/invalid owner TTY authorization signature binding');
    if (!suspects.some(s => s.project === identity && s.test_id === e.id)) throw new Error('excluded id is not a ledger suspect: ' + e.id);
  }
  return entries;
}
export function reporterTests(runner, report, project) {
  const rows = [];
  const add = (id, result) => {
    const status = result.status;
    if (!['passed','failed','skipped','pending','todo','disabled','timedOut','interrupted'].includes(status)) throw new Error('unknown reporter status');
    const ms = result.duration ?? (['skipped','pending','todo','disabled'].includes(status) ? 0 : NaN);
    if (!Number.isFinite(ms) || ms < 0) throw new Error('invalid test duration');
    rows.push({id, runner, duration_ms: ms, status});
  };
  if (runner === 'vitest') {
    if (!Array.isArray(report.testResults)) throw new Error('missing Vitest testResults');
    for (const suite of report.testResults) {
      const file = isAbsolute(suite.name) ? relative(project, suite.name) : suite.name;
      for (const t of suite.assertionResults) add(file + ' > ' + t.fullName, t);
    }
  } else {
    const visit = (suite, parents) => {
      const names = parents.concat(suite.title ? [suite.title] : []);
      for (const spec of suite.specs ?? []) for (const t of spec.tests) {
        const id = spec.file + ' > ' + [...names, spec.title].join(' > ') + ' [' + (t.projectName ?? '') + ']';
        if (!Array.isArray(t.results)) throw new Error('missing Playwright results');
        for (const r of t.results) add(id, r);
      }
      for (const child of suite.suites ?? []) visit(child, names);
    };
    if (!Array.isArray(report.suites)) throw new Error('missing Playwright suites');
    for (const suite of report.suites) visit(suite, []);
  }
  return rows;
}
// The JSON reporter omits global unhandled errors. Record Vitest's explicit completion
// callback separately so excluded assertion failures cannot mask those errors.
// https://vitest.dev/api/advanced/reporters.html#ontestrunend
export default class GateErrorReporter {
  onTestRunEnd(modules, unhandledErrors, reason) {
    const file = process.env.PANDACORP_VITEST_ERRORS_FILE;
    if (!file) throw new Error('missing gate error reporter destination');
    writeFileSync(file, JSON.stringify({reason,unhandledErrors:unhandledErrors.map(e=>String(e.message ?? e))}));
  }
}
export function checkBudget(project, tests) {
  const file = resolve(project,'.pandacorp/gate-budget.json');
  if (!existsSync(file)) { console.log('WARN DR-159: missing .pandacorp/gate-budget.json; generate a reviewed baseline'); return; }
  const b = JSON.parse(readFileSync(file,'utf8'));
  if (b.schemaVersion !== 1 || !b.baseline || Array.isArray(b.baseline) || typeof b.baseline !== 'object' || !b.addedTestTimeBudgetMs || ['vitest','playwright'].some(r => !Number.isFinite(b.addedTestTimeBudgetMs[r]) || b.addedTestTimeBudgetMs[r] < 0) || Object.values(b.baseline).some(ms => !Number.isFinite(ms) || ms < 0)) throw new Error('invalid gate-budget.json schemaVersion 1');
  for (const runner of ['vitest','playwright']) {
    const added = tests.filter(t => t.runner === runner && !Object.hasOwn(b.baseline,t.id));
    const total = added.reduce((s,t) => s+t.duration_ms,0);
    for (const t of tests.filter(t => t.runner === runner && Object.hasOwn(b.baseline,t.id))) if (t.duration_ms > b.baseline[t.id]*1.25 && t.duration_ms-b.baseline[t.id] >= 1000) console.log(`WARN DR-159: slower existing test ${t.id}: ${t.duration_ms} ms`);
    if (total > b.addedTestTimeBudgetMs[runner]) throw new Error(`DR-159 ${runner}: added tests ${total} ms exceed ${b.addedTestTimeBudgetMs[runner]} ms: ` + added.sort((a,b)=>b.duration_ms-a.duration_ms).map(t=>`${t.id} (${t.duration_ms} ms)`).join('; ') + '. Optimize tests or refresh baseline from a green full run with gate-budget-baseline.mjs; commit for review.');
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [cmd, projectArg='.', runner, filename, exitArg] = process.argv.slice(2), project = resolve(projectArg);
    if (cmd === 'validate') loadExclusions(project);
    else if (cmd === 'evaluate') {
      const report = JSON.parse(readFileSync(filename,'utf8')), tests = reporterTests(runner,report,project);
      const rc = Number(exitArg), exclusions = process.env.PANDACORP_DISABLE_TEST_EXCLUSIONS === '1' ? [] : loadExclusions(project);
      const failed = tests.filter(t=>['failed','timedOut','interrupted'].includes(t.status));
      // Runner crashes, global errors and incomplete/fail-fast inventories never become green.
      const infrastructure = runner === 'vitest' ? (report.numRuntimeErrorTestSuites > 0 || report.unhandledErrors?.length > 0 || report.testResults.some(s => s.message)) : (report.errors?.length > 0 || report.stats?.interrupted > 0);
      if (infrastructure || (rc === 0 && failed.length)) throw new Error('reporter contradicts green exit or contains infrastructure errors');
      let missingErrorProof = false;
      if (runner === 'vitest' && rc !== 0 && exclusions.length) {
        const proof = JSON.parse(readFileSync(filename + '.errors.json','utf8'));
        missingErrorProof = !Array.isArray(proof.unhandledErrors) || proof.unhandledErrors.length > 0 || !['passed','failed'].includes(proof.reason);
      }
      if (rc !== 0 && (missingErrorProof || rc !== 1 || !failed.length || infrastructure || failed.some(t=>!exclusions.some(e=>e.id===t.id)) || tests.some(t=>['skipped','pending','todo','disabled','interrupted'].includes(t.status)))) throw new Error('non-excluded test failure or incomplete/infrastructure failure');
      if (process.env.PANDACORP_GATE_FULL === '1') checkBudget(project,tests);
      writeFileSync(filename + '.tests.json', JSON.stringify(tests));
    } else throw new Error('usage: test-gate-policy.mjs validate|evaluate <project> [runner reporter exit]');
  } catch (error) { console.error(error.message); process.exitCode=1; }
}
