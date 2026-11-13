#!/usr/bin/env node
// G-V1 and G-IMPORT: keep raw evidence, validate narrow exceptions, resolve full import paths.
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const V1 = new RegExp(['pandacorp-build' + String.raw`\.js`, 'launch-' + 'implement', 'launch-codex-' + 'implement', 'build-' + 'mech', 'preflight-' + 'implement', 'Dynamic' + ' Workflows'].join('|'));
const historical = file => /decision-log|\/backlog\/|\/memory\/|\/proposals\/|pandacorp-backlog|engine-v1-reactivation/.test(file);
const manifest = 'plugin/templates/retired-files.json';
const retiredOverlay = ['engines', 'workflows'].map(dir => `.claude/${dir}/pandacorp-build${'.js'}`);
const roots = ['plugin', 'factory', 'mission-control/src', 'mission-control/content', 'AGENTS.md', 'CLAUDE.md', 'README.md', '.codex', '.github'];
const extensions = ['', '.mjs', '.js', '.ts', '.tsx', '.json', '/index.mjs', '/index.js', '/index.ts'];

/** Relative module specifiers are identities in their importer's directory, never basenames. */
export function resolvedImports(file, source, deleted) {
  const results = [];
  const pattern = /\bfrom\s*["']([^"']+)["']|\bimport\s*\(\s*["']([^"']+)["']|\brequire\s*\(\s*["']([^"']+)["']|\bimport\s*["']([^"']+)["']/g;
  for (const match of source.matchAll(pattern)) {
    const specifier = match.slice(1).find(Boolean);
    if (!specifier.startsWith('.')) continue;
    const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier));
    const target = extensions.map(ext => resolved + ext).find(candidate => deleted.has(candidate));
    if (target) results.push({ file, target, specifier, line: source.slice(0, match.index).split('\n').length });
  }
  return results;
}

export function auditRetirement({ files, deleted }) {
  const raw = [], v1 = [], imports = [], references = [], errors = [];
  const manifestText = files.get(manifest);
  try {
    if (JSON.stringify(JSON.parse(manifestText)) !== JSON.stringify(retiredOverlay)) errors.push('retirement manifest must retain the exact two overlay paths');
  } catch { errors.push('retirement manifest missing or unreadable'); }
  for (const [file, source] of files) {
    const lines = source.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const text = lines[i], hit = { file, line: i + 1, text };
      if (V1.test(text)) {
        raw.push(hit);
        // Only these historical fixture paths and the planner's explicit anti-import assertions are exempt.
        const negativeProbe = file === 'plugin/scripts/test-build-v2-planner.mjs' &&
          (/^await test\("planner\.mjs imports nothing from /.test(text) || /^\s*ok\(!\/.*\.test\(src\)/.test(text));
        if (!historical(file) && file !== manifest && file !== 'plugin/scripts/fixtures/audit-last-green/f1-commits.json' && !negativeProbe) v1.push(hit);
      }
      if (!historical(file) && file !== manifest) {
        for (const target of deleted) {
          if (text.includes(target)) references.push({ ...hit, target });
        }
      }
    }
    if (/\.[cm]?[jt]sx?$/.test(file)) imports.push(...resolvedImports(file, source, deleted));
    // Resolve shell execution paths separately; a bare same-directory script is still an executable reference.
    if (/\.(sh|md)$/.test(file) && !historical(file)) {
      const commands = /\b(?:node|bash|sh)\s+["']?([\w./-]+\.(?:mjs|js|sh))/g;
      for (const match of source.matchAll(commands)) {
        const token = match[1];
        const candidates = [token, path.posix.normalize(path.posix.join(path.posix.dirname(file), token))];
        const target = candidates.find(p => deleted.has(p));
        if (target) references.push({ file, target, line: source.slice(0, match.index).split('\n').length, text: match[0] });
      }
    }
  }
  return { raw, v1, imports, references, errors, ok: ![v1, imports, references, errors].some(items => items.length) };
}

export function checkRetirement(root, base = 'main') {
  const git = args => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  const deleted = new Set(git(['diff', '--name-only', '--diff-filter=D', `${base}...HEAD`]).trim().split('\n').filter(Boolean));
  if (!deleted.size) throw new Error('no deleted paths found; supply the pre-retirement base');
  const names = git(['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', ...roots]).split('\0').filter(Boolean);
  const files = new Map();
  for (const name of new Set(names)) if (existsSync(path.join(root, name))) {
    const source = readFileSync(path.join(root, name), 'utf8');
    if (!source.includes('\0')) files.set(name, source);
  }
  return { deleted: [...deleted], ...auditRetirement({ files, deleted }) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = checkRetirement(path.resolve(process.argv[2] ?? '.'), process.argv[3] ?? 'main');
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.ok ? 0 : 2;
  } catch (error) { console.error(error.message); process.exitCode = 2; }
}
