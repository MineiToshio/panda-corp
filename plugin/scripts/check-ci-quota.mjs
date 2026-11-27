#!/usr/bin/env node
// check-ci-quota.mjs — ADVISORY free-quota review of a project's GitHub Actions workflows (DR-166,
// factory/standards/infra.md INFRA-11/12). Private repositories share 2,000 Actions minutes a month
// across the whole account, so a workflow that runs the full suite on every push to every branch
// starves every other project. /pandacorp:upgrade runs this instead of overwriting a project's
// ci.yml (a workflow is project-owned once seeded): it prints suggestions, never edits, and always
// exits 0 unless invoked wrongly (exit 2).
//
//   node check-ci-quota.mjs <project-dir> [--template <ci.yml>] [--json]
//
// The parser is deliberately line-based (no YAML dependency): it understands the shape the factory
// template and ordinary hand-written workflows use. Anything it cannot read is reported as
// "unreadable", never as compliant.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HEAVY = /\b(vitest(\s+run)?|playwright\s+test|pnpm\s+(run\s+)?test(:e2e|:smoke|:visual)?\b|npm\s+(run\s+)?test\b|stryker|lhci|lighthouse)/;
const FULL_VERIFY = /verify\.sh(?![^\n]*--(light|only))/;
const AUDIT = /\b(pnpm|npm|yarn)\s+audit\b/;

function indentOf(line) { return line.length - line.trimStart().length; }
function stripComment(line) {
  const i = line.indexOf(' #');
  return (line.trimStart().startsWith('#') ? '' : i >= 0 ? line.slice(0, i) : line).replace(/\s+$/, '');
}

// Returns the lines of a mapping block that starts after `startIndex`, deeper than `baseIndent`.
function blockAfter(lines, startIndex, baseIndent) {
  const out = [];
  for (let i = startIndex + 1; i < lines.length; i += 1) {
    const raw = stripComment(lines[i]);
    if (!raw.trim()) continue;
    if (indentOf(raw) <= baseIndent) break;
    out.push(raw);
  }
  return out;
}

export function parseTriggers(text) {
  const lines = text.split('\n');
  const idx = lines.findIndex((l) => /^(on|"on"|'on'|true):/.test(stripComment(l)));
  if (idx < 0) return null;
  const head = stripComment(lines[idx]).replace(/^[^:]+:\s*/, '');
  const triggers = {};
  if (head) {
    // Inline forms: `on: push` or `on: [push, pull_request]`.
    for (const name of head.replace(/[[\]]/g, '').split(',').map((s) => s.trim()).filter(Boolean)) triggers[name] = [];
    return triggers;
  }
  const body = blockAfter(lines, idx, 0);
  const keyIndent = body.length ? indentOf(body[0]) : 2;
  let current = null;
  for (const line of body) {
    if (indentOf(line) === keyIndent) {
      current = line.trim().replace(/:.*$/, '');
      triggers[current] = [];
    } else if (current) triggers[current].push(line.trim());
  }
  return triggers;
}

export function parseJobs(text) {
  const lines = text.split('\n');
  const idx = lines.findIndex((l) => /^jobs:\s*$/.test(stripComment(l)));
  if (idx < 0) return [];
  const body = blockAfter(lines, idx, 0);
  const keyIndent = body.length ? indentOf(body[0]) : 2;
  const jobs = [];
  for (const line of body) {
    if (indentOf(line) === keyIndent && /^\s*[A-Za-z0-9_-]+:\s*$/.test(line)) jobs.push({ name: line.trim().slice(0, -1), lines: [] });
    else if (jobs.length) jobs[jobs.length - 1].lines.push(line);
  }
  return jobs.map((job) => {
    const text = job.lines.join('\n');
    const ifLine = job.lines.find((l) => indentOf(l) === keyIndent + 2 && /^\s*if:/.test(l));
    const timeout = text.match(/^\s*timeout-minutes:\s*(\d+)/m);
    return { name: job.name, text, if: ifLine ? ifLine.trim().slice(3).trim() : null, timeout: timeout ? Number(timeout[1]) : null };
  });
}

// A job "runs on push/PR" unless its `if:` positively restricts it to dispatch/schedule events.
function runsOnPushOrPr(job) {
  if (!job.if) return true;
  const allowsOnly = /github\.event_name\s*==\s*'(workflow_dispatch|schedule)'/.test(job.if) && !/push|pull_request/.test(job.if);
  return !allowsOnly;
}

export function analyzeWorkflow(text, file = 'workflow') {
  const findings = [];
  const add = (rule, message) => findings.push({ file, rule, message });
  const triggers = parseTriggers(text);
  if (!triggers) return [{ file, rule: 'unreadable', message: 'no `on:` block found; review this workflow by hand' }];
  const hasPush = Object.hasOwn(triggers, 'push');
  const hasPr = Object.hasOwn(triggers, 'pull_request') || Object.hasOwn(triggers, 'pull_request_target');

  if (hasPush) {
    const push = triggers.push.join('\n');
    const branches = push.match(/branches:\s*\[([^\]]*)\]/);
    if (!/branches:/.test(push)) add('U2', 'push runs on every branch; limit it to `branches: [main]`');
    else if (/\*\*|"\*"|'\*'/.test(branches ? branches[1] : push)) add('U2', 'push uses a wildcard branch filter; limit it to `branches: [main]`');
    if (!/paths-ignore:/.test(push) || !/\*\*\/\*\.md/.test(push)) add('U2', "push lacks `paths-ignore: ['**/*.md']` (docs-only pushes should skip CI)");
  }
  if ((hasPush || hasPr) && !/^concurrency:/m.test(text)) add('U2', 'no top-level `concurrency` with `cancel-in-progress: true` for the same ref');
  else if ((hasPush || hasPr) && !/cancel-in-progress:\s*true/.test(text)) add('U2', '`concurrency` does not cancel in-progress runs for the same ref');

  for (const job of parseJobs(text)) {
    if (job.timeout == null) add('U4', `job \`${job.name}\` has no \`timeout-minutes\``);
    const onPush = (hasPush || hasPr) && runsOnPushOrPr(job);
    if (!onPush) continue;
    if (HEAVY.test(job.text) || FULL_VERIFY.test(job.text)) add('U1', `job \`${job.name}\` runs the unit/browser suite on push/PR; move it to a \`workflow_dispatch\`-only job (fast static checks only on push/PR)`);
    if (AUDIT.test(job.text)) add('U3', `job \`${job.name}\` runs the dependency audit on push/PR; run it weekly + on demand`);
    if (job.timeout != null && job.timeout > 10 && !HEAVY.test(job.text) && !FULL_VERIFY.test(job.text)) add('U4', `job \`${job.name}\` is a fast check with timeout-minutes ${job.timeout}; keep fast checks at 10 or less`);
  }

  for (const line of triggers.schedule || []) {
    const cron = line.match(/cron:\s*["']([^"']+)["']/);
    if (!cron) continue;
    const minute = cron[1].trim().split(/\s+/)[0];
    if (/[*,/-]/.test(minute)) add('U5', `cron \`${cron[1]}\` runs more than once an hour; use the lowest cadence that meets the task's SLA`);
  }
  return findings;
}

export function adviseProject(projectDir, templatePath) {
  const dir = path.join(projectDir, '.github', 'workflows');
  const ciPath = path.join(dir, 'ci.yml');
  const template = templatePath && existsSync(templatePath) ? readFileSync(templatePath, 'utf8') : null;
  let ci = 'missing';
  if (existsSync(ciPath)) ci = template != null && readFileSync(ciPath, 'utf8') === template ? 'identical' : 'customized';
  const findings = [];
  if (existsSync(dir)) {
    for (const name of readdirSync(dir).filter((n) => /\.ya?ml$/.test(n)).sort()) {
      findings.push(...analyzeWorkflow(readFileSync(path.join(dir, name), 'utf8'), `.github/workflows/${name}`));
    }
  }
  return { ci, findings };
}

function main(argv) {
  const args = argv.slice(2);
  const json = args.includes('--json');
  const t = args.indexOf('--template');
  const templatePath = t >= 0 ? args[t + 1] : path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'templates', 'stack-a-nextjs', '.github', 'workflows', 'ci.yml');
  const project = args.find((a, i) => !a.startsWith('--') && (t < 0 || i !== t + 1));
  if (!project || !existsSync(project)) {
    console.error('usage: check-ci-quota.mjs <project-dir> [--template <ci.yml>] [--json]');
    return 2;
  }
  const report = adviseProject(project, templatePath);
  if (json) { console.log(JSON.stringify(report, null, 2)); return 0; }
  const ciLine = { missing: 'ci.yml missing: seed it from the stack template', identical: 'ci.yml matches the stack template', customized: 'ci.yml is project-owned and differs from the template: not overwritten' }[report.ci];
  console.log(`check-ci-quota (advisory, DR-166): ${ciLine}`);
  if (!report.findings.length) console.log('  no free-quota findings');
  for (const f of report.findings) console.log(`  [${f.rule}] ${f.file}: ${f.message}`);
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main(process.argv);
