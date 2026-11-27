#!/usr/bin/env node
// actions-usage-alert.mjs — account-wide GitHub Actions quota alert (DR-166 U7, factory/standards/
// infra.md INFRA-14). Runs from the PUBLIC factory repo (its own minutes are free) on a daily cron.
// It reads the owner account's billing usage for the current month (an enhanced-billing-platform
// endpoint) and sums the GROSS dollar amount of Actions compute billed to PRIVATE repositories. A free
// account's included Actions compute is a dollar allowance ($12/month by default; Linux $0.006/min,
// Windows $0.010/min, macOS $0.062/min), so grossAmount already weighs each runner type. It keeps ONE
// issue labeled `actions-quota` in sync: opened/updated at >= 60 % (WARN) and >= 85 % (CRIT), closed
// with a comment once usage is back below 60 % (in practice: after the monthly reset). Minutes are
// shown for reading only; they never drive the percentage.
//
// Environment:
//   GH_BILLING_TOKEN  owner-created token able to read the account's billing usage. A classic token
//                     with the `user` scope is the known-good choice; a fine-grained "Plan: read"
//                     token is unverified. Missing = notice, exit 0.
//   GITHUB_TOKEN      the workflow token (issues: write) for the issue in GITHUB_REPOSITORY.
//   BILLING_USER      account login (default MineiToshio); INCLUDED_USD (default 12).
//   DRY_RUN=1         print the report and the planned issue action, touch nothing.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const LABEL = 'actions-quota';
export const WARN_PCT = 60;
export const CRIT_PCT = 85;
export const DEFAULT_INCLUDED_USD = 12;

function repoKey(name) {
  if (!name) return null;
  const s = String(name).trim().toLowerCase();
  return s.includes('/') ? s.slice(s.lastIndexOf('/') + 1) : s;
}

// Pure: usageItems from GET /users/{u}/settings/billing/usage → gross dollars (plus minutes, for
// display) per private repository. Defensive: unreadable items are skipped and counted, never
// thrown; an item without a repository counts as private ("(unattributed)"), so the alert errs
// toward warning, not silence.
export function summarizeActionsUsage(response, { publicRepos = new Set(), year, month } = {}) {
  const items = Array.isArray(response?.usageItems) ? response.usageItems : null;
  if (!items) throw new Error('billing usage response has no usageItems array');
  const prefix = year && month ? `${year}-${String(month).padStart(2, '0')}` : null;
  const byRepo = new Map();
  let totalUsd = 0;
  let totalMinutes = 0;
  let skipped = 0;
  for (const item of items) {
    if (!item || typeof item !== 'object') { skipped += 1; continue; }
    if (String(item.product || '').toLowerCase() !== 'actions') continue;
    if (!/minute/i.test(String(item.unitType || ''))) continue; // compute only; storage is a separate quota
    if (prefix && typeof item.date === 'string' && !item.date.startsWith(prefix)) continue;
    const gross = Number(item.grossAmount);
    if (!Number.isFinite(gross) || gross < 0) { skipped += 1; continue; }
    const key = repoKey(item.repositoryName);
    if (key && publicRepos.has(key)) continue;
    const label = key || '(unattributed)';
    const row = byRepo.get(label) || { usd: 0, minutes: 0 };
    const minutes = Number(item.quantity);
    row.usd += gross;
    if (Number.isFinite(minutes) && minutes >= 0) { row.minutes += minutes; totalMinutes += minutes; }
    byRepo.set(label, row);
    totalUsd += gross;
  }
  const repos = [...byRepo.entries()]
    .map(([repo, r]) => ({ repo, usd: r.usd, minutes: r.minutes }))
    .sort((a, b) => b.usd - a.usd || a.repo.localeCompare(b.repo));
  return { totalUsd, totalMinutes, repos, skipped };
}

export function classify(pct) {
  if (pct >= CRIT_PCT) return 'CRIT';
  if (pct >= WARN_PCT) return 'WARN';
  return 'OK';
}

// The level an open issue was last written at, read from its title ("Actions quota CRIT: …").
export function levelOfTitle(title) {
  const m = /\b(OK|WARN|CRIT)\b/.exec(String(title || ''));
  return m ? m[1] : null;
}

const money = (n) => `$${(Math.round(n * 100) / 100).toFixed(2)}`;
const round1 = (n) => Math.round(n * 10) / 10;

export function buildReport(summary, { includedUsd = DEFAULT_INCLUDED_USD, now = new Date() } = {}) {
  const pct = includedUsd > 0 ? (summary.totalUsd / includedUsd) * 100 : 100;
  const level = classify(pct);
  const month = now.toISOString().slice(0, 7);
  const title = `Actions quota ${level}: ${money(summary.totalUsd)}/${money(includedUsd)} (${round1(pct)}%) in ${month}`;
  const rows = summary.repos.map((r) => `| ${r.repo} | ${money(r.usd)} | ${round1((r.usd / includedUsd) * 100)}% | ${Math.round(r.minutes)} |`);
  const body = [
    `**${level}**: private repositories have used **${money(summary.totalUsd)} of ${money(includedUsd)}** of included GitHub Actions compute in ${month} (${round1(pct)}%, ${Math.round(summary.totalMinutes)} runner minutes).`,
    '',
    `Thresholds: WARN at ${WARN_PCT}%, CRIT at ${CRIT_PCT}%, measured on the gross amount of private-repo Actions compute (Linux $0.006/min, Windows $0.010/min, macOS $0.062/min). Paid overage is blocked ($0 budget): at 100% every workflow in every private repo stops until the monthly reset.`,
    '',
    '| Repository | Gross | Share of included | Minutes |',
    '|---|---|---|---|',
    ...(rows.length ? rows : ['| (none) | $0.00 | 0% | 0 |']),
    '',
    'Runbook: factory/standards/infra.md INFRA-11..16 (DR-166). Pause optional dispatches, prefer local gates, check crons; at CRIT hold non-urgent workflow runs.',
    summary.skipped ? `\n_${summary.skipped} usage item(s) had an unreadable shape and were skipped._` : '',
    `\n_Updated ${now.toISOString()} by .github/workflows/actions-usage-alert.yml._`,
  ].join('\n');
  return { pct, level, title, body };
}

// Pure: what to do with the single labeled issue. An edit sends no notification, so a level change
// on an open issue (WARN <-> CRIT) also gets a comment; closing always comments.
export function planIssueAction(level, openIssue) {
  if (level === 'OK') return { action: openIssue ? 'close' : 'none', comment: Boolean(openIssue) };
  if (!openIssue) return { action: 'create', comment: false };
  return { action: 'update', comment: levelOfTitle(openIssue.title) !== level };
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
  const includedUsd = Number(process.env.INCLUDED_USD || DEFAULT_INCLUDED_USD);
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  const usage = await gh(billingToken, 'GET', `/users/${encodeURIComponent(user)}/settings/billing/usage?year=${year}&month=${month}`);
  if (!usage.ok) {
    console.log(`::error title=Billing usage unreadable::GET /users/${user}/settings/billing/usage returned HTTP ${usage.status}. Check that GH_BILLING_TOKEN is valid and can read billing (a classic token with the \`user\` scope is known to work; a fine-grained "Plan: read" token is unverified) and that the account is on the enhanced billing platform.`);
    return 1;
  }
  const summary = summarizeActionsUsage(usage.data, { publicRepos: await publicRepoSet(billingToken, user), year, month });
  const report = buildReport(summary, { includedUsd, now });
  console.log(report.title);
  for (const r of summary.repos) console.log(`  ${r.repo}: $${r.usd.toFixed(2)} (${Math.round(r.minutes)} min)`);

  const repo = process.env.GITHUB_REPOSITORY;
  const token = process.env.GITHUB_TOKEN;
  if (process.env.DRY_RUN === '1' || !repo || !token) {
    console.log(`dry run: issue action not applied (${!repo || !token ? 'no GITHUB_REPOSITORY/GITHUB_TOKEN' : 'DRY_RUN=1'})`);
    return 0;
  }
  const open = await gh(token, 'GET', `/repos/${repo}/issues?state=open&labels=${LABEL}&per_page=10`);
  if (!open.ok || !Array.isArray(open.data)) throw new Error(`listing ${LABEL} issues failed (HTTP ${open.status})`);
  const issue = open.data.find((i) => !i.pull_request) || null;
  const { action, comment } = planIssueAction(report.level, issue);
  if (action === 'create') {
    const label = await gh(token, 'POST', `/repos/${repo}/labels`, { name: LABEL, color: 'd93f0b', description: 'Account-wide GitHub Actions minutes alert (DR-166)' });
    if (!label.ok && label.status !== 422) throw new Error(`creating label failed (HTTP ${label.status})`);
    const created = await gh(token, 'POST', `/repos/${repo}/issues`, { title: report.title, body: report.body, labels: [LABEL] });
    if (!created.ok) throw new Error(`creating issue failed (HTTP ${created.status})`);
    console.log(`opened issue #${created.data.number}`);
  } else if (action === 'update') {
    const updated = await gh(token, 'PATCH', `/repos/${repo}/issues/${issue.number}`, { title: report.title, body: report.body });
    if (!updated.ok) throw new Error(`updating issue failed (HTTP ${updated.status})`);
    // An edit sends no notification: a WARN <-> CRIT change also gets a comment.
    if (comment) {
      const note = await gh(token, 'POST', `/repos/${repo}/issues/${issue.number}/comments`, { body: `Level changed to ${report.level}: ${report.title}.` });
      if (!note.ok) throw new Error(`commenting on issue failed (HTTP ${note.status})`);
    }
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
