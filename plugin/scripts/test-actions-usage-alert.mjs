// DR-166 U7 / INFRA-14: pure computation of the account-wide Actions quota alert. The percentage is
// the gross dollar amount of private-repo Actions compute against the included allowance ($12).
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildReport, classify, levelOfTitle, planIssueAction, summarizeActionsUsage } from './actions-usage-alert.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const item = (fields) => ({ date: '2026-11-24T00:00:00Z', product: 'actions', sku: 'actions_linux', quantity: 10, unitType: 'Minutes', pricePerUnit: 0.006, grossAmount: 0.06, discountAmount: 0.06, netAmount: 0, ...fields });
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

// 1. Sums gross dollars of private-repo Actions compute; minutes kept for display only. Public repos,
//    other products, storage units and other months are excluded; no fixed runner multipliers.
const usage = {
  usageItems: [
    item({ repositoryName: 'MineiToshio/funko-tracker', quantity: 1500, grossAmount: 9 }),
    item({ repositoryName: 'funko-tracker', quantity: 310, grossAmount: 1.86 }),
    item({ repositoryName: 'MineiToshio/panda-corp', quantity: 900, grossAmount: 5.4 }),
    item({ repositoryName: 'side-app', sku: 'actions_macos', quantity: 3, pricePerUnit: 0.062, grossAmount: 0.186 }),
    item({ repositoryName: 'side-app', sku: 'actions_windows', quantity: 5, pricePerUnit: 0.01, grossAmount: 0.05 }),
    item({ unitType: 'GigabyteHours', sku: 'actions_storage', quantity: 99, grossAmount: 3, repositoryName: 'side-app' }),
    item({ product: 'git_lfs', unitType: 'GigabyteHours', quantity: 50, grossAmount: 2 }),
    item({ repositoryName: 'side-app', date: '2026-10-31T00:00:00Z', quantity: 400, grossAmount: 2.4 }),
    item({ repositoryName: undefined, quantity: 2, grossAmount: 0.012 }),
    item({ repositoryName: 'side-app', grossAmount: 'not-a-number' }),
    null,
  ],
};
const summary = summarizeActionsUsage(usage, { publicRepos: new Set(['panda-corp']), year: 2026, month: 11 });
close(summary.totalUsd, 9 + 1.86 + 0.186 + 0.05 + 0.012);
assert.equal(summary.totalMinutes, 1500 + 310 + 3 + 5 + 2, 'raw minutes, never multiplied');
assert.deepEqual(summary.repos.map((r) => [r.repo, r.minutes]), [['funko-tracker', 1810], ['side-app', 8], ['(unattributed)', 2]]);
close(summary.repos[0].usd, 10.86);
close(summary.repos[1].usd, 0.236);
assert.equal(summary.skipped, 2);

// 2. Thresholds: < 60 OK, 60..84.9 WARN, >= 85 CRIT.
assert.equal(classify(59.9), 'OK');
assert.equal(classify(60), 'WARN');
assert.equal(classify(84.99), 'WARN');
assert.equal(classify(85), 'CRIT');

// 3. The 2026-11-24 incident: 1,810 Linux minutes = $10.86 of $12 (90.5 %) is CRIT, with a per-repo row.
const report = buildReport({ totalUsd: 10.86, totalMinutes: 1810, repos: [{ repo: 'funko-tracker', usd: 10.86, minutes: 1810 }], skipped: 0 }, { includedUsd: 12, now: new Date('2026-11-24T12:00:00Z') });
assert.equal(report.level, 'CRIT');
assert.equal(report.title, 'Actions quota CRIT: $10.86/$12.00 (90.5%) in 2026-11');
assert.match(report.body, /\| funko-tracker \| \$10\.86 \| 90\.5% \| 1810 \|/);
assert.equal(buildReport({ totalUsd: 7.2, totalMinutes: 0, repos: [], skipped: 0 }).level, 'WARN', '$7.20 of the default $12 = 60 %');
assert.equal(buildReport({ totalUsd: 7.2, totalMinutes: 0, repos: [], skipped: 0 }, { includedUsd: 24 }).level, 'OK', 'INCLUDED_USD is configurable');
assert.equal(buildReport({ totalUsd: 0, totalMinutes: 0, repos: [], skipped: 0 }).level, 'OK');

// 4. One issue: create / update while above WARN, close once OK. A level change on an open issue also
//    comments (edits send no notification); a same-level refresh does not.
assert.equal(levelOfTitle('Actions quota WARN: $7.20/$12.00 (60%) in 2026-11'), 'WARN');
assert.equal(levelOfTitle(undefined), null);
assert.deepEqual(planIssueAction('WARN', null), { action: 'create', comment: false });
assert.deepEqual(planIssueAction('CRIT', { number: 7, title: 'Actions quota WARN: …' }), { action: 'update', comment: true });
assert.deepEqual(planIssueAction('WARN', { number: 7, title: 'Actions quota CRIT: …' }), { action: 'update', comment: true });
assert.deepEqual(planIssueAction('CRIT', { number: 7, title: 'Actions quota CRIT: …' }), { action: 'update', comment: false });
assert.deepEqual(planIssueAction('OK', { number: 7, title: 'Actions quota CRIT: …' }), { action: 'close', comment: true });
assert.deepEqual(planIssueAction('OK', null), { action: 'none', comment: false });

// 5. A response without usageItems is an error, never a silent 0 %.
assert.throws(() => summarizeActionsUsage({ message: 'Not Found' }), /no usageItems/);

// 6. Missing secret: a clear notice and exit 0 (no crash loop), with no network call.
const env = { ...process.env };
delete env.GH_BILLING_TOKEN;
const run = spawnSync(process.execPath, [join(here, 'actions-usage-alert.mjs')], { encoding: 'utf8', env });
assert.equal(run.status, 0);
assert.match(run.stdout, /::notice title=Actions usage alert disabled::The GH_BILLING_TOKEN secret is not set/);

console.log('test-actions-usage-alert: ok');
