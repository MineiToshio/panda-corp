#!/usr/bin/env node
// Explicit overlay source allowlist; never recursively add .pandacorp/ owner/runtime state.
// Also works for a project nested below a factory repository with a broad inherited ignore.
import { execFileSync } from 'node:child_process';
import { lstatSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const MANAGED_OVERLAY_FILES = Object.freeze([
  'README.md', 'guide.md', 'status.yaml', 'idea-origin.md', 'track.jsonl', 'build-journal.jsonl',
  'verify.sh', 'canary.sh', 'merge-queue.sh', 'green-stamp.sh', 'change-reconcile.mjs', 'session-cleanup.sh',
  'worktree-bootstrap.sh', 'pending-work.sh', 'serve-once.sh', 'doc-lint.sh', 'check-project-skills.mjs', 'risk-paths',
]);

export function stageManagedOverlay(project, { dryRun = false } = {}) {
  const root = realpathSync(project);
  const env = { ...process.env };
  for (const key of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_COMMON_DIR', 'GIT_PREFIX']) delete env[key];
  const git = (args) => execFileSync('git', ['-C', root, ...args], { env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const repo = realpathSync(git(['rev-parse', '--show-toplevel']));
  const overlay = path.join(root, '.pandacorp');
  if (!lstatSync(overlay).isDirectory() || lstatSync(overlay).isSymbolicLink()) throw new Error('overlay must be a real directory');
  const files = [];
  for (const file of MANAGED_OVERLAY_FILES) {
    const relative = `.pandacorp/${file}`;
    let stat;
    try { stat = lstatSync(path.join(root, relative)); } catch (e) { if (e.code === 'ENOENT') continue; throw e; }
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`managed overlay path must be a regular file: ${relative}`);
    files.push(relative);
  }
  // -f applies ONLY to these regular named files, never a directory or a glob. Other projects can
  // inherit a parent's .pandacorp/ ignore too; the owning repository need not weaken that policy.
  if (!dryRun && files.length) git(['--literal-pathspecs', 'add', '-f', '--', ...files]);
  return { project: root, repo_root: repo, nested: root !== repo, dry_run: dryRun, files };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    let project = '.', dryRun = false;
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--project' && args[i + 1]) project = args[++i];
      else if (args[i] === '--dry-run') dryRun = true;
      else throw new Error('usage: stage-managed-overlay.mjs --project <dir> [--dry-run]');
    }
    console.log(JSON.stringify(stageManagedOverlay(project, { dryRun })));
  } catch (e) {
    console.error(`stage-managed-overlay: ${e.message}`);
    process.exitCode = 1;
  }
}
