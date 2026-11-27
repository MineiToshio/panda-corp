#!/usr/bin/env node
// actions-usage-alert.mjs — account-wide GitHub Actions minutes alert (DR-166 U7, factory/standards/
// infra.md INFRA-14). Runs from the PUBLIC factory repo (its own minutes are free) on a daily cron:
// reads the owner account's billing usage for the current month, sums the Actions minutes billed to
// PRIVATE repositories (the 2,000 included minutes are shared by all of them), and keeps ONE issue
// labeled `actions-quota` in sync: opened/updated at >= 60 % (WARN) and >= 85 % (CRIT), closed with
// a comment once usage is back below 60 % (in practice: after the monthly reset).
//
// Environment:
//   GH_BILLING_TOKEN  owner-created token able to read the account's billing usage (fine-grained:
//                     account permission "Plan: read"; classic: `user` scope). Missing = notice, exit 0.
//   GITHUB_TOKEN      the workflow token (issues: write) for the issue in GITHUB_REPOSITORY.
//   BILLING_USER      account login (default MineiToshio); INCLUDED_MINUTES (default 2000).
//   DRY_RUN=1         print the report and the planned issue action, touch nothing.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const LABEL = 'actions-quota';
export const WARN_PCT = 60;
export const CRIT_PCT = 85;
// Included minutes are consumed at the runner multiplier (Linux 1, Windows 2, macOS 10).
export const MULTIPLIERS = { linux: 1, windows: 2, macos: 10 };

function multiplierFor(sku) {
  const s = String(sku || '').toLowerCase();
  if (s.includes('macos')) return MULTIPLIERS.macos;
  if (s.includes('windows')) return MULTIPLIERS.windows;
  return MULTIPLIERS.linux;
}

function repoKey(name) {
  if (!name) return null;
  const s = String(name).trim().toLowerCase();
  return s.includes('/') ? s.slice(s.lastIndexOf('/') + 1) : s;
}

// Pure: usageItems from GET /users/{u}/settings/billing/usage → minutes per private repository.
// Defensive: unknown shapes are skipped and counted, never thrown; an item without a repository is
// counted as private ("(unattributed)") so the alert errs toward warning, not silence.
export function summarizeActionsUsage(response, { publicRepos = new Set(), year, month } = {}) {
  const items = Array.isArray(response?.usageItems) ? response.usageItems : null;
  if (!items) throw new Error('billing usage response has no usageItems array');
  const prefix = year && month ? `${year}-${String(month).padStart(2, '0')}` : null;
  const byRepo = new Map();
  let total = 0;
  let skipped = 0;
  for (const item of items) {
    if (!item || typeof item !== 'object') { skipped += 1; continue; }
    if (String(item.product || '').toLowerCase() !== 'actions') continue;
    if (!/minute/i.test(String(item.unitType || ''))) continue;
    if (prefix && typeof item.date === 'string' && !item.date.startsWith(prefix)) continue;
    const quantity = Number(item.quantity);
    if (!Number.isFinite(quantity) || quantity < 0) { skipped += 1; continue; }
    const key = repoKey(item.repositoryName);
    if (key && publicRepos.has(key)) continue;
    const minutes = quantity * multiplierFor(item.sku);
    const label = key || '(unattributed)';
    byRepo.set(label, (byRepo.get(label) || 0) + minutes);
    total += minutes;
  }
  const repos = [...byRepo.entries()].map(([repo, minutes]) => ({ repo, minutes })).sort((a, b) => b.minutes - a.minutes || a.repo.localeCompare(b.repo));
  return { totalMinutes: total, repos, skipped };
}

export function classify(pct) {
  if (pct >= CRIT_PCT) return 'CRIT';
  if (pct >= WARN_PCT) return 'WARN';
  return 'OK';
}

export function buildReport(summary, { included = 2000, now = new Date() } = {}) {
  const pct = included > 0 ? (summary.totalMinutes / included) * 100 : 100;
  const level = classify(pct);
  const month = now.toISOString().slice(0, 7);
  const round = (n) => Math.round(n * 10) / 10;
  const title = `Actions minutes ${level}: ${Math.round(summary.totalMinutes)}/${included} (${round(pct)}%) in ${month}`;
  const rows = summary.repos.map((r) => `| ${r.repo} | ${Math.round(r.minutes)} | ${round((r.minutes / included) * 100)}% |`);
  const body = [
    `**${level}** — private repositories have used **${Math.round(summary.totalMinutes)} of ${included}** included GitHub Actions minutes in ${month} (${round(pct)}%).`,
    '',
    `Thresholds: WARN at ${WARN_PCT}%, CRIT at ${CRIT_PCT}%. Paid overage is blocked ($0 budget): at 100% every workflow in every private repo stops until the monthly reset.`,
    '',
    '| Repository | Minutes | Share of included |',
    '|---|---|---|',
    ...(rows.length ? rows : ['| (none) | 0 | 0% |']),
    '',
    'Runbook: factory/standards/infra.md INFRA-11..16 (DR-166). Pause optional dispatches, prefer local gates, check crons; at CRIT hold non-urgent workflow runs.',
    summary.skipped ? `\n_${summary.skipped} usage item(s) had an unreadable shape and were skipped._` : '',
    `\n_Updated ${now.toISOString()} by .github/workflows/actions-usage-alert.yml._`,
  ].join('\n');
  return { pct, level, title, body };
}

// Pure: what to do with the single labeled issue.
export function planIssueAction(level, openIssue) {
  if (level === 'OK') return openIssue ? 'close' : 'none';
  return openIssue ? 'update' : 'create';
}

async function gh(token, method, url, body) {
  const res = await fetch(url.startsWith('http') ? url : `https://api.github.com${url}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'pandacorp-actions-usage-alert' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { ok: res.ok, status: res.status, data };
}

async function publicRepoSet(token, user) {
  const set = new Set();
  for (let page = 1; page <= 10; page += 1) {
    const r = await gh(token, 'GET', `/users/${encodeURIComponent(user)}/repos?type=owner&per_page=100&page=${page}`);
    if (!r.ok || !Array.isArray(r.data)) throw new Error(`listing public repositories failed (HTTP ${r.status})`);
    for (const repo of r.data) if (repo && repo.private === false && repo.name) set.add(String(repo.name).toLowerCase());
    if (r.data.length < 100) break;
  }
  return set;
}

async function main() {
  const billingToken = process.env.GH_BILLING_TOKEN;
  if (!billingToken) {
    console.log('::notice title=Actions usage alert disabled::The GH_BILLING_TOKEN secret is not set. The owner creates it (see factory/standards/infra.md INFRA-14); until then this job does nothing.');
    return 0;
  }
  const user = process.env.BILLING_USER || 'MineiToshio';
  const included = Number(process.env.INCLUDED_MINUTES || 2000);
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  const usage = await gh(billingToken, 'GET', `/users/${encodeURIComponent(user)}/settings/billing/usage?year=${year}&month=${month}`);
  if (!usage.ok) {
    console.log(`::error title=Billing usage unreadable::GET /users/${user}/settings/billing/usage returned HTTP ${usage.status}. Check that GH_BILLING_TOKEN is valid and can read billing (fine-grained "Plan: read" or classic \`user\` scope).`);
    return 1;
  }
  const summary = summarizeActionsUsage(usage.data, { publicRepos: await publicRepoSet(billingToken, user), year, month });
  const report = buildReport(summary, { included, now });
  console.log(report.title);
  for (const r of summary.repos) console.log(`  ${r.repo}: ${Math.round(r.minutes)} min`);

  const repo = process.env.GITHUB_REPOSITORY;
  const token = process.env.GITHUB_TOKEN;
  if (process.env.DRY_RUN === '1' || !repo || !token) {
    console.log(`dry run: issue action not applied (${!repo || !token ? 'no GITHUB_REPOSITORY/GITHUB_TOKEN' : 'DRY_RUN=1'})`);
    return 0;
  }
  const open = await gh(token, 'GET', `/repos/${repo}/issues?state=open&labels=${LABEL}&per_page=10`);
  if (!open.ok || !Array.isArray(open.data)) throw new Error(`listing ${LABEL} issues failed (HTTP ${open.status})`);
  const issue = open.data.find((i) => !i.pull_request) || null;
  const action = planIssueAction(report.level, issue);
  if (action === 'create') {
    const label = await gh(token, 'POST', `/repos/${repo}/labels`, { name: LABEL, color: 'd93f0b', description: 'Account-wide GitHub Actions minutes alert (DR-166)' });
    if (!label.ok && label.status !== 422) throw new Error(`creating label failed (HTTP ${label.status})`);
    const created = await gh(token, 'POST', `/repos/${repo}/issues`, { title: report.title, body: report.body, labels: [LABEL] });
    if (!created.ok) throw new Error(`creating issue failed (HTTP ${created.status})`);
    console.log(`opened issue #${created.data.number}`);
  } else if (action === 'update') {
    const updated = await gh(token, 'PATCH', `/repos/${repo}/issues/${issue.number}`, { title: report.title, body: report.body });
    if (!updated.ok) throw new Error(`updating issue failed (HTTP ${updated.status})`);
    console.log(`updated issue #${issue.number}`);
  } else if (action === 'close') {
    await gh(token, 'POST', `/repos/${repo}/issues/${issue.number}/comments`, { body: `Back to OK: ${report.title}.` });
    const closed = await gh(token, 'PATCH', `/repos/${repo}/issues/${issue.number}`, { state: 'closed', state_reason: 'completed' });
    if (!closed.ok) throw new Error(`closing issue failed (HTTP ${closed.status})`);
    console.log(`closed issue #${issue.number}`);
  } else console.log('no issue action needed');
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then((code) => { process.exitCode = code; }, (err) => {
    console.log(`::error title=Actions usage alert failed::${err.message}`);
    process.exitCode = 1;
  });
}
