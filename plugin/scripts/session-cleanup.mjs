#!/usr/bin/env node
// Session-owned resources only. Never sweep siblings or shared caches. DR-145.
import { spawn, spawnSync } from 'node:child_process';
import { randomUUID, createHash } from 'node:crypto';
import { existsSync, realpathSync } from 'node:fs';
import { lstat, mkdir, mkdtemp, open, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scan, processCwds } from './worktree-sweep.mjs';

const real = p => realpathSync(p);
const git = (repo, args) => {
  const r = spawnSync('git', ['--no-optional-locks', ...args], { cwd: repo, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`git ${args[0]}: ${r.stderr || r.error}`);
  return r.stdout.trim();
};
const inside = (p, parent) => p === parent || p.startsWith(parent + path.sep);
const protectedPath = p => /(^|\/)\.pandacorp(\/|$)|\/local-deployments(\/|$)|\/factory\/(ideas|memory)(\/|$)|\/factory\/(profile|portfolio)\.md$/.test(p);
const receipt = root => path.join(root, 'session.json');
async function load(root) {
  root = await realpath(root);
  const temp = await realpath(process.env.PANDACORP_SESSION_TEMP_BASE || os.tmpdir());
  if (path.dirname(root) !== temp || !path.basename(root).startsWith('pandacorp-session-')) throw new Error('invalid session root');
  const entry = await lstat(receipt(root));
  if (!entry.isFile() || entry.isSymbolicLink()) throw new Error('invalid receipt');
  const data = JSON.parse(await readFile(receipt(root), 'utf8'));
  if (data.version !== 1 || data.root !== root || !Array.isArray(data.worktrees) || real(data.repo) !== data.repo) throw new Error('invalid session receipt');
  return data;
}
export async function create(repo) {
  const repoRoot = real(git(repo, ['rev-parse', '--show-toplevel']));
  const common = real(git(repoRoot, ['rev-parse', '--path-format=absolute', '--git-common-dir']));
  // Allocate only AFTER proving coordinator access. Never modify/unlink somebody's lock.
  const probe = path.join(common, `pandacorp-write-probe-${randomUUID()}`);
  const fd = await open(probe, 'wx').catch(e => { throw new Error(`coordinator cannot write shared git directory (${e.code}); sandbox workers must hand off, not retry locks`); });
  await fd.close(); await rm(probe);
  const root = await realpath(await mkdtemp(path.join(process.env.PANDACORP_SESSION_TEMP_BASE || os.tmpdir(), 'pandacorp-session-')));
  const data = { version: 1, root, repo: repoRoot, worktrees: [] };
  await mkdir(path.join(root, 'artifacts'));
  await writeFile(receipt(root), JSON.stringify(data, null, 2), { flag: 'wx', mode: 0o600 });
  return data;
}
export async function register(root, target, { generatedFiles = [] } = {}) {
  const data = await load(root); target = real(target);
  const inv = await scan(data.repo, data.repo);
  if (protectedPath(target) || !inv.items.some(i => i.kind === 'worktree' && real(i.path) === target)) throw new Error('target must be a registered non-protected linked worktree');
  // Register immediately on creation, before handing the worktree to any worker. One coordinator writes receipt.
  const branch = git(target, ['rev-parse', '--symbolic-full-name', 'HEAD']);
  const gitdir = real(git(target, ['rev-parse', '--absolute-git-dir']));
  const st = await lstat(path.join(target, '.git'));
  const identity = `${st.dev}:${st.ino}:${st.birthtimeMs}`;
  let owned = data.worktrees.find(w => w.path === target);
  if (!owned) { owned = { path: target, branch, gitdir, identity, generatedFiles: {} }; data.worktrees.push(owned); }
  if (owned.identity !== identity || owned.branch !== branch || owned.gitdir !== gitdir) throw new Error('cannot register outputs for a replaced worktree');
  owned.generatedFiles ??= {};
  for (const relative of generatedFiles) {
    const file = path.resolve(target, relative);
    if (path.isAbsolute(relative) || !inside(file, target) || file === target || protectedPath(file) || /(^|\/)\.git(\/|$)/.test(file) || real(file) !== file || !(await lstat(file)).isFile()) throw new Error('generated output must be a real non-protected file inside its owned worktree');
    owned.generatedFiles[path.relative(target, file)] = createHash('sha256').update(await readFile(file)).digest('hex');
  }
  await writeFile(receipt(data.root), JSON.stringify(data, null, 2));
  return data;
}
// Refuse repo copies, nested owner state or a symlink root; symlink children are unlinked, never followed.
async function assertArtifacts(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  if (['HEAD', 'objects', 'refs', 'config'].every(n => entries.some(e => e.name === n))) throw new Error(`protected or unregistered bare repository in artifacts: ${dir}`);
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.name === '.git' || e.name === '.pandacorp' || protectedPath(p)) throw new Error(`protected or unregistered repository in artifacts: ${p}`);
    if (e.isDirectory()) await assertArtifacts(p);
  }
}
function removeWorktree(repo, target) {
  // Asynchronous, no spawnSync maxBuffer/timeout; caller polls its live tool process until exit.
  return new Promise(resolve => {
    const p = spawn('git', ['worktree', 'remove', '--', target], { cwd: repo, stdio: ['ignore', 'ignore', 'pipe'] });
    let error = ''; p.stderr.on('data', b => { error = (error + b).slice(-8192); });
    p.on('error', e => resolve({ code: -1, error: e.message }));
    p.on('close', code => resolve({ code, error }));
  });
}
export async function finish(root, { dryRun = false, self = process.cwd() } = {}) {
  const data = await load(root);
  // A second finisher must not race deletion. No stale-lock breaking.
  const lock = path.join(data.root, 'cleanup.lock');
  const fd = dryRun ? null : await open(lock, 'wx');
  const removed = [], kept = [], failed = [];
  try {
    for (const owned of data.worktrees) {
      const target = owned.path;
      if (typeof target !== 'string') throw new Error('invalid worktree receipt');
      if (existsSync(target)) {
        const st = await lstat(path.join(target, '.git')).catch(() => null);
        if (!st || st.isSymbolicLink() || real(target) !== target || `${st.dev}:${st.ino}:${st.birthtimeMs}` !== owned.identity ||
            git(target, ['rev-parse', '--symbolic-full-name', 'HEAD']) !== owned.branch || real(git(target, ['rev-parse', '--absolute-git-dir'])) !== owned.gitdir) {
          kept.push({ path: target, reason: 'identity-mismatch' }); continue;
        }
      }
      // Rescan EACH target immediately before removal, including ancestry, status, owner state, lsof and locks.
      const inv = await scan(data.repo, self, [target]);
      const item = inv.items.find(i => i.kind === 'worktree' && path.resolve(i.path) === target);
      if (!item) { if (existsSync(target)) kept.push({ path: target, reason: 'unregistered-path' }); continue; }
      if (protectedPath(target) || item.decision !== 'safe' || !item.merged || item.uncommitted !== 0) {
        kept.push({ path: target, reason: protectedPath(target) ? 'protected-path' : item.reason }); continue;
      }
      let changedOutput = false;
      for (const [relative, expected] of Object.entries(owned.generatedFiles || {})) {
        const file = path.resolve(target, relative);
        if (!inside(file, target) || protectedPath(file) || !existsSync(file) || real(file) !== file || !(await lstat(file)).isFile() || createHash('sha256').update(await readFile(file)).digest('hex') !== expected) { changedOutput = true; break; }
      }
      if (changedOutput) { kept.push({ path: target, reason: 'generated-output-changed' }); continue; }
      // status/remove respect index concealment bits. Inspect those tracked files independently.
      const concealed = git(target, ['ls-files', '-v', '-z']).split('\0').filter(row => /^[a-zS] /.test(row)).map(row => row.slice(2));
      let maskedChange = false;
      for (const relative of concealed) {
        const file = path.join(target, relative);
        if (!existsSync(file) || !(await lstat(file)).isFile() || real(file) !== file || git(target, ['hash-object', '--no-filters', '--', relative]) !== git(target, ['rev-parse', '--verify', `HEAD:${relative}`])) { maskedChange = true; break; }
      }
      if (maskedChange) { kept.push({ path: target, reason: 'masked-tracked-change' }); continue; }
      const ignored = git(target, ['ls-files', '--others', '--ignored', '--exclude-standard']);
      if (ignored.split('\n').some(protectedPath)) { kept.push({ path: target, reason: 'owner-state' }); continue; }
      const generated = /(^|\/)(node_modules|\.next|dist|build|coverage|\.cache|\.turbo)(\/|$)/;
      let unknownIgnored = false;
      for (const f of ignored.split('\n').filter(Boolean)) {
        if (generated.test(f)) continue;
        const file = path.join(target, f), expected = owned.generatedFiles?.[f];
        if (!expected || real(file) !== file || !(await lstat(file)).isFile() || createHash('sha256').update(await readFile(file)).digest('hex') !== expected) { unknownIgnored = true; break; }
      }
      if (unknownIgnored) { kept.push({ path: target, reason: 'unclassified-ignored-files' }); continue; }
      const cacheRoots = new Set(ignored.split('\n').filter(f => f && generated.test(f)).map(f => { const m = generated.exec(f); return f.slice(0, m.index + m[0].length).replace(/\/$/, ''); }));
      for (const cache of cacheRoots) {
        const p = path.join(target, cache);
        if ((await lstat(p)).isDirectory()) await assertArtifacts(p);
      }
      const gitdir = git(target, ['rev-parse', '--absolute-git-dir']);
      const common = git(target, ['rev-parse', '--path-format=absolute', '--git-common-dir']);
      if (['index.lock', 'HEAD.lock'].some(n => existsSync(path.join(gitdir, n))) || ['index.lock', 'packed-refs.lock'].some(n => existsSync(path.join(common, n)))) {
        kept.push({ path: target, reason: 'git-lock' }); continue;
      }
      if (dryRun) { removed.push({ path: target, dryRun: true }); continue; }
      process.stderr.write(`session-cleanup: removing ${target}\n`);
      const result = await removeWorktree(data.repo, target);
      if (result.code !== 0 || existsSync(target)) failed.push({ path: target, error: result.error || 'directory remains' });
      else removed.push({ path: target });
      // Keep refs: no need to erase branch history to reclaim node_modules/.next/cache disk space.
    }
    const artifacts = path.join(data.root, 'artifacts');
    const a = await lstat(artifacts);
    if (!a.isDirectory() || a.isSymbolicLink()) throw new Error('artifacts must be a real directory');
    await assertArtifacts(artifacts);
    const procs = processCwds();
    if (!procs.ok || procs.cwds.some(p => inside(p, artifacts))) kept.push({ path: artifacts, reason: procs.ok ? 'in-use' : 'process-check-unavailable' });
    if (!dryRun && !kept.length && !failed.length) {
      await rm(artifacts, { recursive: true }); // session-owned logs/caches only, permanent, no trash
      await rm(receipt(data.root));
    }
    return { root: data.root, removed, kept, failed, artifactsRemoved: !dryRun && !kept.length && !failed.length };
  } finally {
    if (fd) { await fd.close(); await rm(lock); }
    // Remove only our now-empty container. Failure retains evidence for inspection/retry.
    if (!dryRun && !existsSync(receipt(data.root))) await import('node:fs/promises').then(fs => fs.rmdir(data.root));
  }
}
async function main() {
  const args = process.argv.slice(2), cmd = args.shift();
  const opt = (name, fallback) => { const i = args.indexOf(`--${name}`); return i < 0 ? fallback : args[i + 1]; };
  let result;
  if (cmd === 'create') result = await create(opt('repo', '.'));
  else if (cmd === 'register') result = await register(opt('session', process.env.PANDACORP_CLEANUP_SESSION), opt('worktree'), { generatedFiles: args.flatMap((a, i) => args[i - 1] === '--generated-file' ? [a] : []) });
  else if (cmd === 'finish') result = await finish(opt('session', process.env.PANDACORP_CLEANUP_SESSION), { dryRun: args.includes('--dry-run') });
  else if (cmd === 'run') {
    const split = args.indexOf('--'); if (split < 0 || !args[split + 1]) throw new Error('run requires -- command args');
    const session = await create(opt('repo', '.'));
    const env = { ...process.env, PANDACORP_CLEANUP_SESSION: session.root, PANDACORP_SESSION_TEMP_BASE: path.dirname(session.root), TMPDIR: path.join(session.root, 'artifacts'), npm_config_cache: path.join(session.root, 'artifacts/npm') };
    let code;
    try { code = await new Promise((resolve, reject) => { const p = spawn(args[split + 1], args.slice(split + 2), { env, stdio: 'inherit' }); p.on('error', reject); p.on('close', c => resolve(c ?? 1)); }); }
    finally { result = await finish(session.root); }
    process.exitCode = code || (result.failed.length || result.kept.length ? 3 : 0);
  } else throw new Error('usage: session-cleanup.mjs create|register|finish|run --repo <repo> [--session <root>] [--worktree <path>] [--dry-run] [-- command]');
  console.log(JSON.stringify(result, null, 2));
  if (result.failed?.length || result.kept?.length) process.exitCode = 3;
}
if (process.argv[1] && real(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(e => { console.error(`session-cleanup: ${e.message}`); process.exitCode = 3; });
