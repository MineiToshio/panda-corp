#!/usr/bin/env node
// Independent DR-145 safety probes. Mutations are limited to disposable synthetic repositories.
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { create, register, finish } from './session-cleanup.mjs';
import { scan } from './worktree-sweep.mjs';

const script = fileURLToPath(new URL('./session-cleanup.mjs', import.meta.url));
const env = { ...process.env, GIT_AUTHOR_NAME: 'Safety fixture', GIT_AUTHOR_EMAIL: 'fixture@example.invalid', GIT_COMMITTER_NAME: 'Safety fixture', GIT_COMMITTER_EMAIL: 'fixture@example.invalid', GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' };
const roots = [];
const git = (cwd, ...args) => {
  const result = spawnSync('git', args, { cwd, env, encoding: 'utf8' });
  assert.equal(result.status, 0, `${args.join(' ')}: ${result.stderr}`);
  return result.stdout.trim();
};
function fixture() {
  const root = realpathSync(mkdtempSync(path.join(os.tmpdir(), 'cleanup-review-')));
  roots.push(root);
  const repo = path.join(root, 'repo'), wt = path.join(root, 'original');
  mkdirSync(repo);
  git(repo, 'init', '-q', '-b', 'main');
  writeFileSync(path.join(repo, 'file.txt'), 'synthetic fixture\n');
  git(repo, 'add', 'file.txt');
  git(repo, 'commit', '-qm', 'Synthetic fixture');
  git(repo, 'worktree', 'add', '-q', '-b', 'fixture/original', wt);
  return { root, repo, wt };
}
function engineFixture(relative = 'build/wt/unit') {
  const f = fixture();
  writeFileSync(path.join(f.repo,'.gitignore'),'.pandacorp/\nnode_modules/\n');
  git(f.repo,'add','.gitignore');git(f.repo,'commit','-qm','engine ignores');
  mkdirSync(path.join(f.repo,'.pandacorp/run/build'),{recursive:true});
  writeFileSync(path.join(f.repo,'.pandacorp/status.yaml'),'running: false\n');
  writeFileSync(path.join(f.repo,'.pandacorp/run/build/state.json'),JSON.stringify({status:'finished'}));
  f.engine = path.join(f.repo,'.pandacorp/run',relative);
  git(f.repo,'worktree','add','-qb','lane/test/unit',f.engine);
  return f;
}
// Real bootstrap, no session receipt: sweep must be able to verify its own provenance.
function bootstrapFixture(engine = false) {
  const f = fixture();
  f.app=engine?'mission-control/':'';
  mkdirSync(path.join(f.repo,'.claude'));mkdirSync(path.join(f.repo,'factory'));mkdirSync(path.join(f.repo,f.app,'e2e'),{recursive:true});
  writeFileSync(path.join(f.repo,'.gitignore'),'.pandacorp/\nnode_modules/\n.env.local\n');
  writeFileSync(path.join(f.repo,f.app,'package.json'),'{"name":"pandacorp"}');
  writeFileSync(path.join(f.repo,'.claude/launch.json'),'{"configurations":[{"name":"fixture","port":4037}]}');
  writeFileSync(path.join(f.repo,f.app,'e2e/server-env.json'),'{"PORT":"4037","OWNER":"original"}');
  writeFileSync(path.join(f.repo,'factory/seed'),'fixture');
  git(f.repo,'add','.');git(f.repo,'commit','-qm','bootstrap inputs');
  if(engine) {
    mkdirSync(path.join(f.repo,'.pandacorp/run/build'),{recursive:true});
    writeFileSync(path.join(f.repo,'.pandacorp/status.yaml'),'running: false\n');
    writeFileSync(path.join(f.repo,'.pandacorp/run/build/state.json'),'{"status":"finished"}');
  }
  f.target=engine?path.join(f.repo,'.pandacorp/run/build/wt/bootstrap'):path.join(f.root,'bootstrap');
  git(f.repo,'worktree','add','-qb',engine?'lane/provenance/unit':'fixture/bootstrap',f.target);
  const bin=path.join(f.root,'bin');mkdirSync(bin);
  const pnpm=path.join(bin,'pnpm');writeFileSync(pnpm,'#!/bin/sh\nmkdir -p node_modules\n');
  spawnSync('chmod',['+x',pnpm]);
  f.bootEnv={...env,PATH:`${bin}:${process.env.PATH}`,PANDACORP_DISK_FREE_MB:'100000',PANDACORP_E2E_PORT:'39877',PANDACORP_CLEANUP_SESSION:''};
  f.bootstrap=()=>{
    const r=spawnSync('bash',[fileURLToPath(new URL('../templates/shared/.pandacorp/worktree-bootstrap.sh',import.meta.url))],{cwd:f.target,env:f.bootEnv,encoding:'utf8'});
    assert.equal(r.status,0,r.stderr);
  };
  f.bootstrap();
  return f;
}
async function verdict(f, target) {
  return (await scan(f.repo,f.repo,[target])).items.find(i=>i.path===target);
}
let failed = 0, total = 0;
async function probe(name, fn) {
  total++;
  try { await fn(); console.log(`PASS ${name}`); }
  catch (e) { failed++; console.error(`FAIL ${name}: ${e.message}`); }
}
async function backlogFixture(implementation, merger) {
  const source = readFileSync(new URL('../../.claude/engines/pandacorp-backlog.js', import.meta.url), 'utf8').replace(/^export\s+const\s+meta/m, 'const meta');
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  const engine = new AsyncFunction('agent', 'log', 'args', 'phase', 'parallel', source);
  const prompts = [];
  const agent = async (prompt, options) => {
    prompts.push({ prompt, label: options.label });
    if (options.label === 'scan') return { items: [{ id: 'BL-1001', path: '/fixture/BL-1001.md', title: 'Fixture', status: 'open', tier: 'sonnet' }] };
    if (options.label.startsWith('implement:')) return implementation;
    return merger;
  };
  const result = await engine(agent, () => {}, { factoryRoot: '/fixture' }, () => {}, tasks => Promise.all(tasks.map(task => task())));
  return { result, prompts };
}
try {
  await probe('wrapped child can register its session despite session TMPDIR', async () => {
    const f = fixture(), session = await create(f.repo); roots.push(session.root);
    const child = spawnSync(process.execPath, [script, 'register', '--session', session.root, '--worktree', f.wt], {
      cwd: f.repo, env: { ...env, PANDACORP_SESSION_TEMP_BASE: path.dirname(session.root), TMPDIR: path.join(session.root, 'artifacts') }, encoding: 'utf8',
    });
    assert.equal(child.status, 0, child.stderr.trim());
  });
  await probe('failed process inventory refuses automatic removal', async () => {
    const f = fixture(), session = await create(f.repo); roots.push(session.root);
    await register(session.root, f.wt);
    const bin = path.join(f.root, 'bin'); mkdirSync(bin);
    writeFileSync(path.join(bin, 'lsof'), '#!/bin/sh\necho "permission denied" >&2\nexit 1\n', { mode: 0o755 });
    const child = spawnSync(process.execPath, [script, 'finish', '--session', session.root, '--dry-run'], {
      cwd: f.repo, env: { ...env, PATH: `${bin}:${process.env.PATH}` }, encoding: 'utf8',
    });
    const result = JSON.parse(child.stdout);
    assert.equal(result.removed.length, 0, `unsafe authorization: ${JSON.stringify(result)}`);
    assert.ok(result.kept.some(item => item.path === f.wt));
  });
  await probe('replacement worktree at registered path is foreign', async () => {
    const f = fixture(), session = await create(f.repo); roots.push(session.root);
    await register(session.root, f.wt);
    git(f.repo, 'worktree', 'move', f.wt, path.join(f.root, 'moved-original'));
    git(f.repo, 'worktree', 'add', '-q', '-b', 'fixture/foreign-session', f.wt);
    const result = await finish(session.root, { dryRun: true, self: f.repo });
    assert.equal(result.removed.length, 0, `foreign worktree authorized: ${JSON.stringify(result)}`);
    assert.equal(result.kept.length, 1);
  });
  await probe('bare repository artifact is protected like a repository copy', async () => {
    const f = fixture(), session = await create(f.repo); roots.push(session.root);
    git(f.repo, 'clone', '-q', '--bare', f.repo, path.join(session.root, 'artifacts', 'independent.git'));
    await assert.rejects(() => finish(session.root, { dryRun: true, self: f.repo }), /repository|protected|artifact/i);
  });
  await probe('active process in artifacts prevents deletion', async () => {
    const f = fixture(), session = await create(f.repo); roots.push(session.root);
    const sleeper = spawn('sleep', ['60'], { cwd: path.join(session.root, 'artifacts'), stdio: 'ignore' });
    try {
      await new Promise((resolve, reject) => { sleeper.once('spawn', resolve); sleeper.once('error', reject); });
      const result = await finish(session.root, { dryRun: true, self: f.repo });
      assert.ok(result.kept.some(item => item.path === path.join(session.root, 'artifacts') && item.reason === 'in-use'));
      assert.equal(result.artifactsRemoved, false);
    } finally { sleeper.kill(); }
  });
  await probe('unrecognized ignored private files are retained', async () => {
    const f = fixture(), session = await create(f.repo); roots.push(session.root);
    writeFileSync(path.join(f.repo, '.git', 'info', 'exclude'), '.env.local\n');
    writeFileSync(path.join(f.wt, '.env.local'), 'SYNTHETIC_PRIVATE_VALUE=fixture-only\n');
    await register(session.root, f.wt);
    const result = await finish(session.root, { dryRun: true, self: f.repo });
    assert.equal(result.removed.length, 0, 'private ignored file authorized for deletion');
    assert.ok(result.kept.some(item => item.path === f.wt));
  });
  await probe('wrapped tools can create and finish their own nested session', async () => {
    const f = fixture();
    const source = `const {create,register,finish}=await import(${JSON.stringify(new URL('./session-cleanup.mjs', import.meta.url).href)});const s=await create(process.cwd());await register(s.root,process.argv[1]);await finish(s.root,{self:process.cwd()});`;
    const child = spawnSync(process.execPath, [script, 'run', '--repo', f.repo, '--', process.execPath, '--input-type=module', '-e', source, f.wt], {
      cwd: f.repo, env, encoding: 'utf8',
    });
    assert.equal(child.status, 0, child.stderr.trim());
  });
  await probe('unregistered repository inside an ignored generated cache is protected', async () => {
    const f = fixture(), session = await create(f.repo); roots.push(session.root);
    writeFileSync(path.join(f.repo, '.git', 'info', 'exclude'), 'node_modules/\n');
    mkdirSync(path.join(f.wt, 'node_modules'));
    git(f.repo, 'clone', '-q', f.repo, path.join(f.wt, 'node_modules', 'independent-source'));
    await register(session.root, f.wt);
    let result;
    try { result = await finish(session.root, { dryRun: true, self: f.repo }); }
    catch (e) { assert.match(e.message, /repository|protected|artifact/i); return; }
    assert.equal(result.removed.length, 0, `repository copy authorized: ${JSON.stringify(result)}`);
    assert.ok(result.kept.some(item => item.path === f.wt));
  });
  await probe('backlog cleanup receipt is shell quoted before interpolation', async () => {
    const cleanupSession = "/tmp/pandacorp-session-fixture ' space; $(printf CLEANUP_INJECTION)\nnext";
    const { prompts } = await backlogFixture({ id: 'BL-1001', branch: 'bl/BL-1001', status: 'done', cleanupSession }, { id: 'BL-1001', merged: true, validator: 'green' });
    const merge = prompts.find(item => item.label.startsWith('merge:')).prompt;
    const command = [...merge.matchAll(/`([^`]*finish --session [^`]*)`/g)][0]?.[1];
    assert.ok(command, 'expected cleanup command in merge prompt');
    const argument = command.slice(command.indexOf(' --session ') + ' --session '.length);
    // Execute only printf with the actual rendered argument. No paths or repositories are touched.
    const inert = spawnSync('bash', ['-c', `printf '%s\\0' ${argument}`], { encoding: 'utf8' });
    assert.equal(inert.status, 0, inert.stderr);
    assert.equal(inert.stdout, `${cleanupSession}\0`, 'receipt did not survive as exactly one literal argument');
  });
  await probe('blocked backlog implementation retains its cleanup receipt in report', async () => {
    const cleanupSession = '/tmp/pandacorp-session-partial';
    const { result } = await backlogFixture({ id: 'BL-1001', status: 'blocked', reason: 'fixture blocked', cleanupSession });
    assert.equal(result.blocked[0].cleanupSession, cleanupSession);
  });
  await probe('red backlog merge retains its cleanup receipt in report', async () => {
    const cleanupSession = '/tmp/pandacorp-session-partial';
    const { result } = await backlogFixture({ id: 'BL-1001', branch: 'bl/BL-1001', status: 'done', cleanupSession }, { id: 'BL-1001', merged: false, validator: 'red', reason: 'fixture gate red' });
    assert.equal(result.blocked[0].cleanupSession, cleanupSession);
  });
  await probe('terminal engine worktree with dirty files survives finish', async () => {
    const f=engineFixture(), session=await create(f.repo);roots.push(session.root);
    writeFileSync(path.join(f.engine,'file.txt'),'owner edits');
    const r=await finish(session.root,{self:f.repo});
    assert.ok(existsSync(f.engine));assert.ok(r.kept.some(i=>i.path===f.engine));
  });
  await probe('process cwd inside a terminal engine worktree survives finish', async () => {
    const f=engineFixture(), session=await create(f.repo);roots.push(session.root);
    const sleeper=spawn('sleep',['60'],{cwd:f.engine,stdio:'ignore'});
    try {
      await new Promise((resolve,reject)=>{sleeper.once('spawn',resolve);sleeper.once('error',reject);});
      const r=await finish(session.root,{self:f.repo});
      assert.ok(existsSync(f.engine));assert.ok(r.kept.some(i=>i.path===f.engine&&i.reason==='in-use'));
    } finally {sleeper.kill();}
  });
  await probe('terminal engine worktrees preserve hidden edits, private files and locks', async () => {
    for(const mode of ['masked','private','owner','locked','git-lock']) {
      const f=engineFixture(), session=await create(f.repo);roots.push(session.root);
      if(mode==='masked') {git(f.engine,'update-index','--assume-unchanged','file.txt');writeFileSync(path.join(f.engine,'file.txt'),'hidden edit');}
      if(mode==='private') {writeFileSync(path.join(f.repo,'.git/info/exclude'),'.env.local\n');writeFileSync(path.join(f.engine,'.env.local'),'SYNTHETIC=private');}
      if(mode==='owner') {mkdirSync(path.join(f.engine,'.pandacorp/inbox'),{recursive:true});writeFileSync(path.join(f.engine,'.pandacorp/inbox/note'),'owner');}
      if(mode==='locked') git(f.repo,'worktree','lock',f.engine);
      if(mode==='git-lock') writeFileSync(path.join(git(f.engine,'rev-parse','--absolute-git-dir'),'index.lock'),'fixture');
      const r=await finish(session.root,{self:f.repo});assert.ok(existsSync(f.engine),mode);assert.ok(r.kept.some(i=>i.path===f.engine),mode);
    }
  });
  await probe('engine skip-worktree edits without bootstrap proof are retained', async () => {
    for(const name of ['.claude/launch.json','e2e/server-env.json']) {
      const f=engineFixture(), session=await create(f.repo);roots.push(session.root);
      mkdirSync(path.dirname(path.join(f.engine,name)),{recursive:true});writeFileSync(path.join(f.engine,name),'{}');
      git(f.engine,'add',name);git(f.engine,'commit','-qm','tracked input');
      git(f.engine,'update-index','--skip-worktree',name);writeFileSync(path.join(f.engine,name),'{"ownerEdit":true}');
      assert.notEqual((await verdict(f,f.engine)).decision,'safe',name);
      const r=await finish(session.root,{self:f.repo});assert.ok(r.kept.some(i=>i.path===f.engine));
    }
  });
  await probe('normal worktrees protect run state and every hidden tracked edit', async () => {
    for(const mode of ['run-state','assume-unchanged','skip-worktree']) {
      const f=fixture(), session=await create(f.repo);roots.push(session.root);
      writeFileSync(path.join(f.repo,'.git/info/exclude'),'.pandacorp/\n');
      if(mode==='run-state') {mkdirSync(path.join(f.wt,'.pandacorp/run'),{recursive:true});writeFileSync(path.join(f.wt,'.pandacorp/run/evidence'),'owner evidence');}
      else {git(f.wt,'update-index',`--${mode}`,'file.txt');writeFileSync(path.join(f.wt,'file.txt'),'hidden owner edit');}
      await register(session.root,f.wt);
      assert.notEqual((await verdict(f,f.wt)).decision,'safe',mode);
      const r=await finish(session.root,{self:f.repo});assert.ok(r.kept.some(i=>i.path===f.wt),mode);
    }
  });
  await probe('bootstrap provenance permits generated launch, server-env and env files in both cleanups', async () => {
    for(const engine of [false,true]) {
      const f=bootstrapFixture(engine), session=await create(f.repo);roots.push(session.root);
      await register(session.root,f.target);
      assert.equal((await verdict(f,f.target)).decision,'safe',`engine=${engine}`);
      const r=await finish(session.root,{self:f.repo});assert.ok(r.removed.some(i=>i.path===f.target));assert.ok(!existsSync(f.target));
    }
  });
  await probe('later owner edits invalidate bootstrap hashes for both engine and ordinary worktrees', async () => {
    for(const engine of [false,true]) for(const name of ['.claude/launch.json','e2e/server-env.json','.env.local']) {
      const f=bootstrapFixture(engine), session=await create(f.repo);roots.push(session.root);
      await register(session.root,f.target);writeFileSync(path.join(f.target,name==='.claude/launch.json'?name:f.app+name),'owner edit after bootstrap');
      assert.notEqual((await verdict(f,f.target)).decision,'safe',`engine=${engine} ${name}`);
      const r=await finish(session.root,{self:f.repo});assert.ok(r.kept.some(i=>i.path===f.target));assert.ok(existsSync(f.target));
    }
  });
  await probe('rebootstrap cannot bless owner fields in a PORT-only rewrite', async () => {
    const f=bootstrapFixture(true), name=path.join(f.target,f.app,'e2e/server-env.json');
    const json=JSON.parse(readFileSync(name,'utf8'));json.OWNER='later owner edit';writeFileSync(name,JSON.stringify(json));
    f.bootstrap();
    assert.notEqual((await verdict(f,f.target)).decision,'safe');
  });
  await probe('rebootstrap preserves later owner launch and env edits without recording them', async () => {
    for(const name of ['.claude/launch.json','mission-control/.env.local']) {
      const f=bootstrapFixture(true), file=path.join(f.target,name);
      writeFileSync(file,'later owner content');f.bootstrap();
      assert.equal(readFileSync(file,'utf8'),'later owner content');
      assert.notEqual((await verdict(f,f.target)).decision,'safe');
    }
  });
  await probe('waiting archive, malformed state and orphan lease fail closed', async () => {
    for(const mode of ['archive-waiting','bad-state','orphan-lease','cache-repo']) {
      const relative=mode==='archive-waiting'?'build-archive/old/integration':'build/wt/unit';
      const f=engineFixture(relative), session=await create(f.repo);roots.push(session.root);
      if(mode==='archive-waiting') writeFileSync(path.join(f.engine,'../state.json'),JSON.stringify({status:'waiting_gate'}));
      if(mode==='bad-state') writeFileSync(path.join(f.repo,'.pandacorp/run/build/state.json'),'invalid');
      if(mode==='orphan-lease') mkdirSync(path.join(f.repo,'.pandacorp/run/build.lease'));
      if(mode==='cache-repo') {mkdirSync(path.join(f.engine,'node_modules'));git(f.repo,'clone','-q',f.repo,path.join(f.engine,'node_modules/source'));}
      const r=await finish(session.root,{self:f.repo});assert.ok(existsSync(f.engine),mode);assert.ok(r.kept.some(i=>i.path===f.engine),mode);
    }
  });
  await probe('suspended and unrelated protected-state worktrees survive finish', async () => {
    for(const relative of ['build-suspended/old/wt/unit','preserved-tests/unit','build/units/unit']) {
      const f=engineFixture(relative), session=await create(f.repo);roots.push(session.root);
      const r=await finish(session.root,{self:f.repo});assert.ok(existsSync(f.engine),relative);assert.ok(r.kept.some(i=>i.path===f.engine),relative);
    }
  });
  await probe('generated output registration refuses escapes, symlinks and Git metadata', async () => {
    const f = fixture(), session = await create(f.repo); roots.push(session.root);
    const outside = path.join(f.root, 'outside.txt'); writeFileSync(outside, 'synthetic outside value');
    symlinkSync(outside, path.join(f.wt, 'generated-link'));
    for (const relative of ['../outside.txt', outside, 'generated-link', '.git', '.pandacorp/run/evidence', 'factory/profile.md']) {
      await assert.rejects(() => register(session.root, f.wt, { generatedFiles: [relative] }), /generated output|non-protected|inside/i);
    }
  });
  await probe('owner edits to tracked skip-worktree generated output prevent removal', async () => {
    const f = fixture(), session = await create(f.repo); roots.push(session.root);
    mkdirSync(path.join(f.wt, '.claude'));
    const launch = path.join(f.wt, '.claude', 'launch.json');
    writeFileSync(launch, '{}');
    git(f.wt, 'add', '.claude/launch.json'); git(f.wt, 'commit', '-qm', 'Synthetic tracked launch fixture');
    git(f.repo, 'merge', '--ff-only', 'fixture/original');
    writeFileSync(launch, '{"autoPort":true}'); git(f.wt, 'update-index', '--skip-worktree', '.claude/launch.json');
    await register(session.root, f.wt, { generatedFiles: ['.claude/launch.json'] });
    const masked = await finish(session.root, { dryRun: true, self: f.repo });
    assert.equal(masked.removed.length, 0, 'producer receipt must not bless a tracked override against HEAD');
    assert.ok(masked.kept.some(item => item.path === f.wt && item.reason === 'masked-tracked-change'));
    writeFileSync(launch, '{"ownerEdit":true}');
    const result = await finish(session.root, { dryRun: true, self: f.repo });
    assert.equal(result.removed.length, 0, `edited tracked output authorized: ${JSON.stringify(result)}`);
    assert.ok(result.kept.some(item => item.path === f.wt));
  });
  await probe('assume-unchanged cannot hide owner edits to an arbitrary tracked file', async () => {
    const f = fixture(), session = await create(f.repo); roots.push(session.root);
    await register(session.root, f.wt);
    git(f.wt, 'update-index', '--assume-unchanged', 'file.txt');
    writeFileSync(path.join(f.wt, 'file.txt'), 'synthetic owner edit hidden from git status\n');
    assert.equal(git(f.wt, 'status', '--porcelain'), '', 'fixture must reproduce a hidden change');
    const result = await finish(session.root, { dryRun: true, self: f.repo });
    assert.equal(result.removed.length, 0, `hidden owner edit authorized: ${JSON.stringify(result)}`);
    assert.ok(result.kept.some(item => item.path === f.wt));
  });
} finally {
  for (const root of roots.reverse()) rmSync(root, { recursive: true, force: true });
}
console.log(`Adversarial probes: ${total - failed}/${total} passed`);
process.exitCode = failed ? 1 : 0;
