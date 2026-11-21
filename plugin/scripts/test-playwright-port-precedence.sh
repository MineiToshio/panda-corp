#!/bin/bash
# Proposal 43: exercise the real bootstrap and config in synthetic flat/nested repositories only.
# No browser servers, network installs or owner fixtures; Git writes stay in the temporary corpus.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
node --input-type=module - "$ROOT" <<'NODE'
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const root = process.argv[2];
const template = fs.readFileSync(path.join(root, 'plugin/templates/stack-a-nextjs/e2e/playwright.config.ts'));
const bootstrap = fs.readFileSync(path.join(root, 'plugin/templates/shared/.pandacorp/worktree-bootstrap.sh'));
const queue = fs.readFileSync(path.join(root, 'plugin/templates/shared/.pandacorp/merge-queue.sh'));
const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'p43-ports-')));
const env = { PATH: process.env.PATH, HOME: dir, PANDACORP_DISK_FREE_MB: '100000', PANDACORP_HOST_DIR: path.join(dir, 'host') };
function run(cwd, cmd, args, extra = {}) {
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8', env: { ...env, ...extra } });
  assert.equal(r.status, 0, `${cmd}: ${r.stderr}\n${r.stdout}`);
  return r.stdout.trim();
}
function put(file, bytes) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, bytes); }
try {
  for (const [name, nested, committed] of [['mission-control', true, 3900], ['funko-tracker', false, 4037], ['personal-page-v2', false, 4010]]) {
    const main = path.join(dir, `${name}-main`), wt = path.join(dir, `${name}-wt`);
    fs.mkdirSync(main);
    const rel = nested ? 'mission-control' : '.', app = path.join(main, rel);
    put(path.join(app, 'package.json'), '{"name":"synthetic","type":"module"}');
    put(path.join(app, 'pnpm-lock.yaml'), 'synthetic lock\n');
    put(path.join(app, 'e2e/server-env.json'), JSON.stringify({ PORT: String(committed), FIXTURE: './e2e/fixtures', URL: `http://127.0.0.1:${committed}` }));
    put(path.join(app, 'playwright.config.ts'), template);
    put(path.join(app, '.pandacorp/green-stamp.sh'), fs.readFileSync(path.join(root, 'plugin/templates/shared/.pandacorp/green-stamp.sh')));
    put(path.join(app, '.pandacorp/verify.sh'), fs.readFileSync(path.join(root, 'plugin/templates/stack-a-nextjs/verify.sh')));
    put(path.join(app, '.pandacorp/merge-queue.sh'), queue);
    put(path.join(app, '.pandacorp/worktree-bootstrap.sh'), bootstrap);
    for (const script of ['verify.sh', 'worktree-bootstrap.sh']) fs.chmodSync(path.join(app, '.pandacorp', script), 0o755);
    put(path.join(app, '.pandacorp/status.yaml'), 'phase: release\ndeploy_target: external\n');
    fs.mkdirSync(path.join(app, 'src/_tests'), { recursive: true });
    for (const spec of ['smoke', 'visual', 'responsive', 'shell', 'headers']) put(path.join(app, 'e2e', `${spec}.spec.ts`), '');
    put(path.join(app, 'bin/pnpm'), `#!/bin/bash
printf '%s\\n' "$*" >> "$P43_GATE_LOG"
if [ "$1" = tsc ]; then
  node --disable-warning=ExperimentalWarning --input-type=module -e 'import fs from "node:fs"; const {default:c}=await import("./playwright.config.ts"); const file=".pandacorp/run/e2e-port"; console.log(JSON.stringify({url:c.use.baseURL,portExists:fs.existsSync(file),mtime:fs.existsSync(file)?fs.statSync(file).mtimeMs:null}));' >> "$P43_ORIGIN_LOG"
fi
exit 0
`);
    fs.chmodSync(path.join(app, 'bin/pnpm'), 0o755);
    put(path.join(main, '.claude/launch.json'), '{"configurations":[{"name":"synthetic","port":3000}]}');
    put(path.join(main, '.gitignore'), 'node_modules/\n.env.local\n.pandacorp/run/\n**/.pandacorp/run/\n');
    if (nested) put(path.join(main, 'factory/seed'), 'synthetic');
    run(main, 'git', ['init', '-q', '-b', 'main']);
    run(main, 'git', ['add', '.']);
    run(main, 'git', ['-c', 'user.name=Synthetic', '-c', 'user.email=synthetic@example.invalid', 'commit', '-qm', 'seed']);
    const origin = path.join(dir, `${name}-origin.git`);
    run(dir, 'git', ['init', '--bare', '-q', '-b', 'main', origin]);
    run(main, 'git', ['remote', 'add', 'origin', origin]);
    run(main, 'git', ['push', '-q', 'origin', 'main']);
    run(main, 'git', ['worktree', 'add', '-b', `p43-${name}`, wt, 'main']);
    const project = path.join(wt, rel);
    put(path.join(project, 'node_modules/.pandacorp-lock-sha'), createHash('sha256').update('synthetic lock\n').digest('hex') + '\n');
    const before = fs.readFileSync(path.join(project, 'e2e/server-env.json'));
    const launch = fs.readFileSync(path.join(wt, '.claude/launch.json'));
    // Run the actual bootstrap from the project CWD, including nested factory topology.
    const script = path.join(dir, 'bootstrap.sh'); put(script, bootstrap);
    run(project, 'bash', [script], { PANDACORP_E2E_PORT: '39888' });
    assert.deepEqual(fs.readFileSync(path.join(project, 'e2e/server-env.json')), before);
    assert.deepEqual(fs.readFileSync(path.join(wt, '.claude/launch.json')), launch);
    assert.equal(fs.readFileSync(path.join(project, '.pandacorp/run/e2e-port'), 'utf8').trim(), '39888');
    assert.ok(!run(wt, 'git', ['ls-files', '-v']).split('\n').some(line => /^[Ss]/.test(line)));
    assert.equal(run(wt, 'git', ['status', '--porcelain', '--untracked-files=no']), '');
    run(project, 'git', ['check-ignore', '.pandacorp/run/e2e-port']);
    const token = run(project, 'bash', ['.pandacorp/green-stamp.sh', 'start']);
    assert.equal(run(project, 'bash', ['.pandacorp/green-stamp.sh', 'start'], { PANDACORP_E2E_COMMITTED_PORT: '1', PANDACORP_E2E_SLOT_PORTS: '4101,4102,4103' }), token, 'per-invocation port switches are stamp controls');
    put(path.join(project, '.pandacorp/run/e2e-port'), '39889\n');
    assert.notEqual(run(project, 'bash', ['.pandacorp/green-stamp.sh', 'start']), token, 'private port file is binding input');
    put(path.join(project, '.pandacorp/run/e2e-port'), '39888\n');
    put(path.join(project, 'node_modules/@playwright/test/package.json'), '{"name":"@playwright/test","type":"module","main":"index.js"}');
    put(path.join(project, 'node_modules/@playwright/test/index.js'), 'export const defineConfig = c => c; export const devices = {"Desktop Chrome": {}};');
    const load = (extra = {}) => JSON.parse(run(project, process.execPath, ['--disable-warning=ExperimentalWarning', '--input-type=module', '-e', 'const {default:c}=await import("./playwright.config.ts"); console.log(JSON.stringify(c));'], extra));
    put(path.join(project, '.pandacorp/run/lane.env'), 'PANDACORP_LANE=synthetic\nPORT=39887\n');
    assert.equal(load().use.baseURL, 'http://127.0.0.1:39888', 'private file wins over lane and committed port');
    fs.unlinkSync(path.join(project, '.pandacorp/run/e2e-port'));
    assert.equal(load().use.baseURL, 'http://127.0.0.1:39887', 'engine lane wins over committed');
    fs.unlinkSync(path.join(project, '.pandacorp/run/lane.env'));
    const numeric = JSON.parse(before); numeric.PORT = committed;
    put(path.join(project, 'e2e/server-env.json'), JSON.stringify(numeric));
    assert.equal(load().use.baseURL, `http://127.0.0.1:${committed}`, 'committed fallback');
    // Recreate the old overlay's tracked rewrites/index flags, with NO private port file.
    put(path.join(project, 'e2e/server-env.json'), before);
    put(path.join(project, 'feature.txt'), 'synthetic feature\n');
    run(wt, 'git', ['add', '.']);
    run(wt, 'git', ['-c', 'user.name=Synthetic', '-c', 'user.email=synthetic@example.invalid', 'commit', '-qm', 'feature']);
    put(path.join(project, 'e2e/server-env.json'), JSON.stringify({ ...JSON.parse(before), PORT: '39888' }));
    put(path.join(wt, '.claude/launch.json'), '{"configurations":[{"name":"legacy","autoPort":true}]}');
    run(wt, 'git', ['update-index', '--skip-worktree', '.claude/launch.json', ...(nested ? ['mission-control/e2e/server-env.json'] : ['e2e/server-env.json'])]);
    put(path.join(project, '.env.local'), 'OWNER_FIXTURE=preserve\n');
    put(path.join(project, '.pandacorp/run/lane.env'), 'PANDACORP_LANE=synthetic\nPORT=39887\n');
    assert.ok(!fs.existsSync(path.join(project, '.pandacorp/run/e2e-port')));
    const gateLog = path.join(dir, `${name}-gates.log`), originLog = path.join(dir, `${name}-origins.log`);
    const queueEnv = { ...env, PATH: `${path.join(project, 'bin')}:${env.PATH}`, P43_GATE_LOG: gateLog, P43_ORIGIN_LOG: originLog };
    const invokeQueue = (authorized = false) => spawnSync('bash', ['.pandacorp/merge-queue.sh'], { cwd: project, encoding: 'utf8', env: { ...queueEnv, ...(authorized ? { PANDACORP_OWNER_RELEASE_OK: '1' } : {}) } });
    const first = invokeQueue();
    assert.equal(first.status, 21, `legacy first queue: ${first.stdout}\n${first.stderr}`);
    assert.match(first.stdout, /\[full-gate\]/);
    const stamp = fs.readFileSync(path.join(project, '.pandacorp/run/green-stamp'));
    const second = invokeQueue(true);
    assert.equal(second.status, 0, `authorized second queue: ${second.stdout}\n${second.stderr}`);
    assert.match(second.stdout, /\[certified-tree\]/, `legacy retry repeated the green gate: ${second.stdout}`);
    assert.equal(fs.readFileSync(gateLog, 'utf8').split('\n').filter(line => /^tsc(?: |$)/.test(line)).length, 1, 'only one full gate across exit 21 and authorization');
    const observed = fs.readFileSync(originLog, 'utf8').trim().split('\n').map(JSON.parse);
    assert.equal(observed.length, 1);
    assert.equal(observed[0].url, `http://127.0.0.1:${committed}`, 'actual queue gate pins committed origin despite legacy/lane overrides');
    assert.equal(observed[0].portExists, true, 'private port must exist before the green gate starts');
    assert.equal(fs.statSync(path.join(project, '.pandacorp/run/e2e-port')).mtimeMs, observed[0].mtime, 'cleanup must not rewrite the certified port');
    assert.deepEqual(fs.readFileSync(path.join(project, '.pandacorp/run/green-stamp')), stamp);
    assert.deepEqual(fs.readFileSync(path.join(project, 'e2e/server-env.json')), before);
    assert.deepEqual(fs.readFileSync(path.join(wt, '.claude/launch.json')), launch);
    assert.ok(!run(wt, 'git', ['ls-files', '-v']).split('\n').some(line => /^[Ss]/.test(line)), 'actual queue clears legacy bootstrap flags');
    assert.equal(run(main, 'git', ['rev-parse', 'HEAD']), run(wt, 'git', ['rev-parse', 'HEAD']));
    assert.equal(run(origin, 'git', ['rev-parse', 'main']), run(wt, 'git', ['rev-parse', 'HEAD']));
    console.log(`OK ${name}: legacy -> green gate -> exit 21 -> authorized certified-tree; committed origin; no post-gate port rewrite`);
    console.log(`OK ${name}: ignored > lane > committed; queue pins committed; no tracked rewrite/index flags`);
    run(main, 'git', ['worktree', 'remove', '--force', wt]);
  }
  assert.deepEqual(fs.readFileSync(path.join(root, 'mission-control/playwright.config.ts')), template);
  console.log('OK controls and template/Mission Control byte identity');
} finally { fs.rmSync(dir, { recursive: true, force: true }); }
NODE
