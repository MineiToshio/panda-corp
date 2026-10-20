#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateServiceCatalog } from './validate-service-catalog.mjs';

const catalog = JSON.parse(readFileSync(new URL('../../factory/services/catalog.yaml', import.meta.url), 'utf8'));
assert.equal(validateServiceCatalog(catalog).providers, 24);
const mutations = [
  (data) => { data.providers.push(structuredClone(data.providers[0])); },
  (data) => { data.schema_version = 2; },
  (data) => { data.providers[0].dashboard_url = 'https://user:password@example.com'; },
  (data) => { data.providers[0].dashboard_url = 'javascript:alert(1)'; },
  (data) => { data.providers[0].sources[0].checked_at = '2026-02-30'; },
  (data) => { data.providers[0].automation.methods = ['api', 'magic']; },
  (data) => { data.providers[0].automation.steps = []; },
  (data) => { data.providers[0].automation.status = 'recipe_tested'; },
  (data) => { data.providers[0].email = 'owner@example.org'; },
  (data) => { data.providers[0].purpose = 'owner@example.org API token ghp_fakecredential'; },
  (data) => { data.providers[0].reuse_policy = 'Private user person@gmail.com'; },
  (data) => { data.providers[0].sources = []; },
  (data) => { data.providers[0].id = 'github'; },
  (data) => { data.providers[0].account_id = 'native-private-account'; },
];
for (const [index, mutate] of mutations.entries()) {
  const copy = structuredClone(catalog);
  mutate(copy);
  assert.throws(() => validateServiceCatalog(copy), `malformed case ${index + 1} must fail`);
}
const examples = structuredClone(catalog);
const modal = examples.providers.find((provider) => provider.id === 'modal');
modal.variable_examples.find((variable) => variable.name === 'MODAL_TOKEN_SECRET').targets = ['web_runtime'];
assert.throws(() => validateServiceCatalog(examples), 'operator credentials must never be mapped to app runtime');
const invalidTargets = structuredClone(catalog);
invalidTargets.providers.find((provider) => provider.id === 'neon').variable_examples[0].targets = ['public_browser'];
assert.throws(() => validateServiceCatalog(invalidTargets), 'unknown/public variable destinations fail');
const example = JSON.parse(readFileSync(new URL('../../factory/services/templates/catalog.example.yaml', import.meta.url), 'utf8'));
assert.equal(validateServiceCatalog(example).providers, 1);
console.log(`PASS: real catalog, public example and ${mutations.length + 2} malformed cases`);
