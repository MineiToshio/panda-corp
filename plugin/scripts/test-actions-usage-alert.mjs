// DR-166 U7 / INFRA-14: pure computation of the account-wide Actions minutes alert.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildReport, classify, planIssueAction, summarizeActionsUsage } from './actions-usage-alert.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const item = (fields) => ({ date: '2026-11-24T00:00:00Z', product: 'actions', sku: 'actions_linux', quantity: 10, unitType: 'Minutes', pricePerUnit: 0.008, grossAmount: 0.08, discountAmount: 0.08, netAmount: 0, ...fields });

// 1. Sums private-repo Actions minutes; public repos, other products, storage units and other months are excluded.
const usage = {
  usageItems: [
    item({ repositoryName: 'MineiToshio/funko-tracker', quantity: 1500 }),
    item({ repositoryName: 'funko-tracker', quantity: 310 }),
    item({ repositoryName: 'MineiToshio/panda-corp', quantity: 900 }),
    item({ repositoryName: 'side-app', sku: 'actions_macos', quantity: 3 }),
    item({ repositoryName: 'side-app', sku: 'actions_windows', quantity: 5 }),
    item({ product: 'actions', unitType: 'GigabyteHours', sku: 'actions_storage', quantity: 99, repositoryName: 'side-app' }),
    item({ product: 'git_lfs', unitType: 'GigabyteHours', quantity: 50 }),
    item({ repositoryName: 'side-app', date: '2026-10-31T00:00:00Z', quantity: 400 }),
    item({ repositoryName: undefined, quantity: 2 }),
    item({ repositoryName: 'side-app', quantity: 'not-a-number' }),
    null,
  ],
};
const summary = summarizeActionsUsage(usage, { publicRepos: new Set(['panda-corp']), year: 2026, month: 11 });
assert.equal(summary.totalMinutes, 1500 + 310 + 30 + 10 + 2);
assert.deepEqual(summary.repos, [
  { repo: 'funko-tracker', minutes: 1810 },
  { repo: 'side-app', minutes: 40 },
  { repo: '(unattributed)', minutes: 2 },
]);
assert.equal(summary.skipped, 2);

// 2. Thresholds: < 60 OK, 60..84.9 WARN, >= 85 CRIT.
assert.equal(classify(59.9), 'OK');
assert.equal(classify(60), 'WARN');
assert.equal(classify(84.99), 'WARN');
assert.equal(classify(85), 'CRIT');

// 3. The 2026-11-24 incident (1,810 of 2,000) is CRIT, with a per-repo breakdown.
const report = buildReport({ totalMinutes: 1810, repos: [{ repo: 'funko-tracker', minutes: 1810 }], skipped: 0 }, { included: 2000, now: new Date('2026-11-24T12:00:00Z') });
assert.equal(report.level, 'CRIT');
assert.equal(report.title, 'Actions minutes CRIT: 1810/2000 (90.5%) in 2026-11');
assert.match(report.body, /\| funko-tracker \| 1810 \| 90\.5% \|/);
assert.equal(buildReport({ totalMinutes: 1200, repos: [], skipped: 0 }).level, 'WARN');
assert.equal(buildReport({ totalMinutes: 0, repos: [], skipped: 0 }).level, 'OK');

// 4. One issue: create / update while above WARN, close once OK, nothing when OK and closed.
assert.equal(planIssueAction('WARN', null), 'create');
assert.equal(planIssueAction('CRIT', { number: 7 }), 'update');
assert.equal(planIssueAction('OK', { number: 7 }), 'close');
assert.equal(planIssueAction('OK', null), 'none');

// 5. A response without usageItems is an error, never a silent 0 %.
assert.throws(() => summarizeActionsUsage({ message: 'Not Found' }), /no usageItems/);

// 6. Missing secret: a clear notice and exit 0 (no crash loop), with no network call.
const env = { ...process.env };
delete env.GH_BILLING_TOKEN;
const run = spawnSync(process.execPath, [join(here, 'actions-usage-alert.mjs')], { encoding: 'utf8', env });
assert.equal(run.status, 0);
assert.match(run.stdout, /::notice title=Actions usage alert disabled::The GH_BILLING_TOKEN secret is not set/);

console.log('test-actions-usage-alert: ok');
