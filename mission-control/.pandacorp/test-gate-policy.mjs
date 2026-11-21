// Shared exact reporter identities and gate policy; no retries or automatic authorizations.
import { readFileSync, existsSync, writeFileSync, lstatSync, realpathSync } from 'node:fs';
import { createHash, createPublicKey, verify } from 'node:crypto';
import { resolve, relative, isAbsolute } from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
export const exclusionsPath = '.pandacorp/test-exclusions.json';
export const TEST_ID_ENCODING = 'json-string-v1';
// Encode the WHOLE assembled id once. Escaping backslashes also distinguishes a real LF
// from a literal backslash+n. Stored ids carry a marker; never guess or double-escape.
export function encodeTestId(value) {
  nonempty(value,'test id');
  return JSON.stringify(value).slice(1,-1).replace(/[\u007f-\u009f\u2028\u2029]/g, char => '\\u' + char.charCodeAt(0).toString(16).padStart(4,'0'));
}
export function readTestId(value, encoding) {
  if (encoding === undefined) return encodeTestId(value); // legacy raw identity
  if (encoding !== TEST_ID_ENCODING) throw new Error('unknown test id encoding');
  nonempty(value,'encoded test id');
  let decoded;
  try { decoded = JSON.parse('"' + value + '"'); }
  catch { throw new Error('invalid encoded test id'); }
  if (encodeTestId(decoded) !== value) throw new Error('non-canonical encoded test id');
  return value;
}
export function vitestTestId(file, fullName) {
  return encodeTestId(nonempty(file,'Vitest file') + ' > ' + nonempty(fullName,'Vitest fullName'));
}
export function playwrightTestId(file, parents, title, projectName) {
  for (const name of parents) nonempty(name,'suite title',true);
  return encodeTestId(nonempty(file,'spec file') + ' > ' + [...parents,nonempty(title,'spec title')].join(' > ') + ' [' + nonempty(projectName,'projectName',true) + ']');
}
export function binding(entry) {
  const fields=[entry.id, entry.reason, entry.authorized_by, entry.authorized_at, entry.expires, 'owner-confirmed-v1'];
  if (Object.hasOwn(entry,'id_encoding')) fields.push(entry.id_encoding); // bind interpretation too; retain legacy signatures
  return createHash('sha256').update(JSON.stringify(fields)).digest('hex');
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
      const testId = readTestId(row.test_id,row.id_encoding);
      const key = JSON.stringify([row.project, row.tree, row.runner, testId]);
      const g = groups.get(key) ?? {project: row.project, tree: row.tree, runner: row.runner, test_id: testId, id_encoding: TEST_ID_ENCODING, passed: 0, failed: 0, attempts: new Set()};
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
    if (line === 'branch refs/heads/main') return realpathSync(resolve(checkout, prefix));
  }
  throw new Error('main checkout required for suspect ledger');
}
function regularPolicy(project, name) {
  if (!lstatSync(resolve(project,'.pandacorp')).isDirectory() || lstatSync(resolve(project,'.pandacorp')).isSymbolicLink() || !lstatSync(resolve(project,name)).isFile() || lstatSync(resolve(project,name)).isSymbolicLink()) throw new Error('policy/key must be regular files under a real .pandacorp directory');
}
// Trust reads cannot inherit hook/worktree redirects, injected config or replace-object refs.
export function ownerGit(directory, ...args) {
  const env = {...process.env};
  for (const key of Object.keys(env)) if (key.startsWith('GIT_')) delete env[key];
  Object.assign(env,{GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:'/dev/null',GIT_NO_REPLACE_OBJECTS:'1'});
  return execFileSync('/usr/bin/git',['-C',directory,...args],{env,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
}
// Resolve the factory pointer from the project's main, never the evaluated branch's guide.
// Nested Mission Control uses the enclosing factory repository directly.
export function ownerPublicKey(project) {
  const git = ownerGit;
  const repo = git(project, 'rev-parse', '--show-toplevel');
  const prefix = git(project, 'rev-parse', '--show-prefix');
  let factory;
  try {
    git(repo, 'cat-file', '-e', 'refs/heads/main:factory/constitution.md');
    factory = repo;
  } catch {
    const guide = git(repo, 'show', 'refs/heads/main:' + prefix + '.pandacorp/guide.md');
    const path = guide.match(/^- Factory: `([^`]+)`/m)?.[1];
    if (!path || !isAbsolute(path)) throw new Error('factory trust pointer missing from project main');
    factory = path;
  }
  let pem;
  try { pem = git(factory, 'show', 'refs/heads/main:factory/owner-keys/exclusions.pub'); }
  catch { throw new Error('pinned factory main owner key missing; owner Keychain bootstrap required'); }
  const key = createPublicKey(pem);
  if (key.asymmetricKeyType !== 'ed25519') throw new Error('pinned factory key must be Ed25519');
  const fingerprint = createHash('sha256').update(key.export({type:'spki',format:'der'})).digest('hex');
  return {pem, fingerprint, factory};
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
  const pinned = ownerPublicKey(project);
  console.log('owner exclusion key: SHA256:' + pinned.fingerprint + ' (factory committed main)');
  const ids = new Set();
  for (const e of entries) {
    if (!e || typeof e.id !== 'string' || !e.id.trim() || /[\0*?]/.test(e.id) || typeof e.reason !== 'string' || !e.reason.trim() || e.authorized_by !== 'owner') throw new Error('exact unique id, reason and authorized_by: owner required');
    const testId=readTestId(e.id,e.id_encoding);
    if (ids.has(testId)) throw new Error('duplicate exclusion identity');
    ids.add(testId);
    for (const key of ['authorized_at','expires']) if (!/^\d{4}-\d{2}-\d{2}$/.test(e[key]) || new Date(e[key]).toISOString().slice(0,10) !== e[key]) throw new Error('invalid exclusion date');
    const start = Date.parse(e.authorized_at), end = Date.parse(e.expires);
    if (end <= start || end - start > 14*86400000 || Date.now() < start || Date.now() > end) throw new Error('exclusion expired, future-dated or exceeds 14 days');
    if (typeof e.authorization !== 'string' || !e.authorization.startsWith('tty-v1:') || !verify(null, Buffer.from(binding(e)), pinned.pem, Buffer.from(e.authorization.slice(7),'base64'))) throw new Error('missing/invalid owner TTY authorization signature binding');
    if (!suspects.some(s => s.project === identity && s.test_id === testId)) throw new Error('excluded id is not a ledger suspect: ' + e.id);
  }
  // Canonical comparison view only; never rewrite the original signed evidence.
  return entries.map(e=>({...e,id:readTestId(e.id,e.id_encoding),id_encoding:TEST_ID_ENCODING}));
}
function nonempty(value, label, allowEmpty = false) {
  if (typeof value !== 'string' || (!allowEmpty && !value.trim()) || /[\0]/.test(value)) throw new Error('invalid reporter identity: ' + label);
  return value;
}
function array(value, label) {
  if (!Array.isArray(value)) throw new Error('missing/invalid reporter collection: ' + label);
  return value;
}
function count(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('invalid reporter count: ' + label);
  return value;
}
export function reporterTests(runner, report, project, {allowEmpty = false} = {}) {
  if (!report || typeof report !== 'object') throw new Error('invalid reporter object');
  const rows = [], ids = new Set();
  const add = (id, status, duration) => {
    readTestId(id,TEST_ID_ENCODING);
    if (ids.has(id)) throw new Error('duplicate reporter identity: ' + id);
    ids.add(id);
    if (!['passed','failed','skipped','pending','todo','disabled','timedOut','interrupted'].includes(status)) throw new Error('unknown reporter status');
    const ms = duration ?? (['skipped','todo','disabled'].includes(status) ? 0 : NaN);
    if (!Number.isFinite(ms) || ms < 0) throw new Error('invalid test duration');
    if (status === 'pending') throw new Error('unfinished reporter test');
    rows.push({id, runner, duration_ms: ms, status});
  };
  if (runner === 'vitest') {
    const files = new Set();
    for (const suite of array(report.testResults, 'testResults')) {
      const name = nonempty(suite?.name, 'Vitest file');
      const file = isAbsolute(name) ? relative(project, name) : name;
      if (files.has(file)) throw new Error('duplicate Vitest module');
      files.add(file);
      if (!array(suite.assertionResults,'assertionResults').length) throw new Error('empty Vitest module inventory');
      for (const t of array(suite.assertionResults, 'assertionResults')) add(vitestTestId(file,t?.fullName), t.status, t.duration);
    }
    const total = count(report.numTotalTests, 'numTotalTests');
    const actual = status => rows.filter(t => status.includes(t.status)).length;
    if (total !== rows.length || count(report.numPassedTests,'numPassedTests') !== actual(['passed']) || count(report.numFailedTests,'numFailedTests') !== actual(['failed']) || count(report.numPendingTests,'numPendingTests') !== actual(['skipped','disabled']) || count(report.numTodoTests,'numTodoTests') !== actual(['todo'])) throw new Error('Vitest reporter inventory/count mismatch');
  } else if (runner === 'playwright') {
    array(report.errors, 'errors');
    const counts = {expected:0,unexpected:0,skipped:0,flaky:0};
    const visit = (suite, parents) => {
      nonempty(suite?.title, 'suite title', true);
      if (!Object.hasOwn(suite,'specs') && !Object.hasOwn(suite,'suites')) throw new Error('suite missing inventory');
      const before = rows.length;
      const names = parents.concat(suite.title ? [suite.title] : []);
      for (const spec of array(Object.hasOwn(suite,'specs') ? suite.specs : [], 'specs')) {
        const file = nonempty(spec?.file, 'spec file'), title = nonempty(spec.title, 'spec title');
        const tests = array(spec.tests, 'tests');
        if (!tests.length) throw new Error('spec has empty test inventory');
        for (const t of tests) {
          const projectName = nonempty(t?.projectName, 'projectName', true);
          if (!['passed','failed','skipped'].includes(t.expectedStatus) || !Object.hasOwn(counts,t.status)) throw new Error('invalid Playwright expectedStatus/outcome');
          counts[t.status]++;
          const id = playwrightTestId(file,names,title,projectName);
          const results = array(t.results, 'results');
          if (t.status === 'skipped' && t.expectedStatus === 'skipped' && !results.length) { add(id,'skipped',0); continue; }
          if (results.length !== 1 || t.status === 'flaky') throw new Error('incomplete or retried Playwright inventory');
          const result = results[0];
          if (!['passed','failed','skipped','timedOut','interrupted'].includes(result?.status) || (result.retry ?? 0) !== 0) throw new Error('invalid/retried Playwright result');
          if (result.status === 'skipped' && (t.expectedStatus !== 'skipped' || t.status !== 'skipped')) throw new Error('undeclared/unexecuted browser test');
          if ((t.status === 'expected' && result.status !== t.expectedStatus) || (t.status === 'unexpected' && result.status === t.expectedStatus) || (t.status === 'skipped' && result.status !== 'skipped')) throw new Error('contradictory Playwright result');
          const status = t.status === 'expected' ? 'passed' : t.status === 'skipped' ? 'skipped' : result.status === 'interrupted' ? 'interrupted' : 'failed';
          add(id,status,result.duration);
        }
      }
      for (const child of array(Object.hasOwn(suite,'suites') ? suite.suites : [],'suites')) visit(child,names);
      if (rows.length === before) throw new Error('empty Playwright suite inventory');
    };
    for (const suite of array(report.suites,'suites')) visit(suite,[]);
    if (!report.stats || Object.keys(counts).some(k => count(report.stats[k], 'stats.' + k) !== counts[k])) throw new Error('Playwright reporter inventory/count mismatch');
  } else throw new Error('unknown test runner');
  // Only an explicitly authorized partial Vitest passWithNoTests run may be empty.
  // Keep all summary validation above; an empty module is still malformed.
  if (!rows.length && !(allowEmpty && runner === 'vitest' && report.success === true && ['numTotalTestSuites','numPassedTestSuites','numFailedTestSuites','numPendingTestSuites'].every(key=>report[key] === 0) && report.testResults.length === 0)) throw new Error('empty reporter test inventory');
  return rows;
}
// JSON lacks reliable global errors and original skip modes. Record both from the runner.
// https://vitest.dev/api/advanced/reporters.html#ontestrunend
export default class GateErrorReporter {
  plannedModules = null;
  declared = new Set();
  onTestRunStart(specifications) { this.plannedModules = specifications.length; }
  tasks(module) {
    const rows = [];
    const walk = task => {
      for (const child of task.tasks ?? []) {
        if (child.type === 'suite') walk(child);
        else if (child.type === 'test') rows.push(child);
        else throw new Error('unknown Vitest task type');
      }
    };
    walk(module.task);
    return rows;
  }
  id(module, task) {
    const names = [nonempty(task.name,'Vitest task name')];
    for (let suite=task.suite; suite; suite=suite.suite) names.unshift(nonempty(suite.name,'suite title',true));
    return vitestTestId(relative(process.cwd(),module.moduleId),names.join(' '));
  }
  onTestModuleCollected(module) {
    for (const task of this.tasks(module)) if (['skip','todo'].includes(task.mode)) this.declared.add(this.id(module,task));
  }
  onTestRunEnd(modules, unhandledErrors, reason) {
    const file = process.env.PANDACORP_VITEST_ERRORS_FILE;
    if (!file) throw new Error('missing gate error reporter destination');
    const statuses = {pass:'passed',fail:'failed',skip:'skipped',todo:'todo',run:'pending',queued:'pending',only:'pending'};
    const tests = modules.flatMap(module => this.tasks(module).map(task => ({id:this.id(module,task),status:statuses[task.result?.state ?? task.mode] ?? 'pending',declaredSkip:this.declared.has(this.id(module,task)) || (task.result?.state === 'skip' && task.result.pending === true)})));
    writeFileSync(file,JSON.stringify({id_encoding:TEST_ID_ENCODING,reason,plannedModules:this.plannedModules,completedModules:modules.length,tests,unhandledErrors:unhandledErrors.map(e=>String(e.message ?? e))}));
  }
}
function validateVitestProof(report, tests, proof) {
  if (!proof || !['passed','failed'].includes(proof.reason) || !Array.isArray(proof.unhandledErrors) || proof.unhandledErrors.length || !Number.isSafeInteger(proof.plannedModules) || proof.plannedModules !== proof.completedModules || proof.completedModules !== report.testResults.length || !Array.isArray(proof.tests) || proof.tests.length !== tests.length) throw new Error('incomplete/interrupted Vitest inventory or global errors');
  if (!tests.length && proof.reason !== 'passed') throw new Error('empty Vitest inventory requires a green completed run');
  const ids = new Set();
  for (const test of proof.tests) {
    if (typeof test.declaredSkip !== 'boolean') throw new Error('invalid declared skip proof');
    const id=readTestId(test.id,proof.id_encoding);
    if (ids.has(id)) throw new Error('duplicate Vitest proof identity');
    ids.add(id);
    const row = tests.find(t=>t.id===id && t.status===test.status);
    if (!row || (['skipped','todo','disabled'].includes(row.status) && !test.declaredSkip)) throw new Error('undeclared/unexecuted Vitest test or reporter mismatch');
  }
}
export function checkBudget(project, tests) {
  for (const test of tests) readTestId(test.id,TEST_ID_ENCODING);
  const file = resolve(project,'.pandacorp/gate-budget.json');
  if (!existsSync(file)) { console.log('WARN DR-159: missing .pandacorp/gate-budget.json; generate a reviewed baseline'); return; }
  const b = JSON.parse(readFileSync(file,'utf8'));
  // Valid legacy files keep their advisory contract while a full run captures timings.
  // The reviewed baseline command is the explicit transition to schema 1 enforcement.
  if (b.schemaVersion === undefined && b.stages && !Array.isArray(b.stages) && typeof b.stages === 'object' && Object.keys(b.stages).length && Object.values(b.stages).every(ms=>Number.isFinite(ms) && ms>0) && [b.margin ?? 0.25,b.min_delta_ms ?? 1000].every(n=>Number.isFinite(n) && n>=0)) {
    console.log('WARN DR-159: legacy budget timing-capture transition; refresh schemaVersion 1 from this green full report with gate-budget-baseline.mjs and review/commit it');
    return;
  }
  if (b.schemaVersion !== 1 || !b.baseline || Array.isArray(b.baseline) || typeof b.baseline !== 'object' || !b.addedTestTimeBudgetMs || ['vitest','playwright'].some(r => !Number.isFinite(b.addedTestTimeBudgetMs[r]) || b.addedTestTimeBudgetMs[r] < 0) || Object.values(b.baseline).some(ms => !Number.isFinite(ms) || ms < 0)) throw new Error('invalid gate-budget.json schemaVersion 1');
  const baseline=Object.fromEntries(Object.entries(b.baseline).map(([id,ms])=>[readTestId(id,b.id_encoding),ms]));
  for (const runner of ['vitest','playwright']) {
    const added = tests.filter(t => t.runner === runner && !Object.hasOwn(baseline,t.id));
    const total = added.reduce((s,t) => s+t.duration_ms,0);
    for (const t of tests.filter(t => t.runner === runner && Object.hasOwn(baseline,t.id))) if (t.duration_ms > baseline[t.id]*1.25 && t.duration_ms-baseline[t.id] >= 1000) console.log(`WARN DR-159: slower existing test ${t.id}: ${t.duration_ms} ms`);
    if (total > b.addedTestTimeBudgetMs[runner]) throw new Error(`DR-159 ${runner}: added tests ${total} ms exceed ${b.addedTestTimeBudgetMs[runner]} ms: ` + added.sort((a,b)=>b.duration_ms-a.duration_ms).map(t=>`${t.id} (${t.duration_ms} ms)`).join('; ') + '. Optimize tests or refresh baseline from a green full run with gate-budget-baseline.mjs; commit for review.');
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [cmd, projectArg='.', runner, filename, exitArg] = process.argv.slice(2), project = resolve(projectArg);
    if (cmd === 'validate') loadExclusions(project);
    else if (cmd === 'owner-key') console.log(ownerPublicKey(project).fingerprint);
    else if (cmd === 'evaluate') {
      const report = JSON.parse(readFileSync(filename,'utf8')), rc = Number(exitArg);
      const allowEmpty = process.argv[7] === '--allow-empty-partial' && process.env.PANDACORP_GATE_FULL === '0' && runner === 'vitest' && rc === 0;
      const tests = reporterTests(runner,report,project,{allowEmpty});
      const exclusions = process.env.PANDACORP_DISABLE_TEST_EXCLUSIONS === '1' ? [] : loadExclusions(project);
      const failed = tests.filter(t=>['failed','timedOut','interrupted'].includes(t.status));
      // Runner crashes, global errors and incomplete/fail-fast inventories never become green.
      const infrastructure = runner === 'vitest' ? (report.numRuntimeErrorTestSuites > 0 || report.unhandledErrors?.length > 0 || report.testResults.some(s => s.message)) : (report.errors?.length > 0 || report.stats?.interrupted > 0);
      if (infrastructure || (rc === 0 && failed.length)) throw new Error('reporter contradicts green exit or contains infrastructure errors');
      if (runner === 'vitest') validateVitestProof(report,tests,JSON.parse(readFileSync(filename + '.errors.json','utf8')));
      if (rc !== 0 && (rc !== 1 || !failed.length || failed.some(t=>!exclusions.some(e=>e.id===t.id)) || tests.some(t=>t.status==='interrupted'))) throw new Error('non-excluded test failure or incomplete/infrastructure failure');
      if (process.env.PANDACORP_GATE_FULL === '1') checkBudget(project,tests);
      writeFileSync(filename + '.tests.json', JSON.stringify(tests));
    } else throw new Error('usage: test-gate-policy.mjs validate|evaluate <project> [runner reporter exit]');
  } catch (error) { console.error(error.message); process.exitCode=1; }
}
