#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const fail = (message) => { throw new Error(message); };
const text = (value, at) => { if (typeof value !== 'string' || !value.trim()) fail(`${at}: expected non-empty string`); };
const exactKeys = (value, required, optional, at) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${at}: expected object`);
  for (const key of required) if (!(key in value)) fail(`${at}.${key}: missing`);
  for (const key of Object.keys(value)) if (![...required, ...optional].includes(key)) fail(`${at}.${key}: unknown field`);
};
const url = (value, at) => {
  text(value, at);
  let parsed;
  try { parsed = new URL(value); } catch { fail(`${at}: invalid URL`); }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) fail(`${at}: expected credential-free HTTPS URL`);
};
const list = (value, at) => { if (!Array.isArray(value) || value.length === 0) fail(`${at}: expected non-empty list`); };
const date = (value, at) => {
  text(value, at);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`)) || new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value) fail(`${at}: invalid date`);
};

export function validateServiceCatalog(catalog) {
  exactKeys(catalog, ['schema_version', 'providers'], [], 'catalog');
  if (catalog.schema_version !== 1) fail('catalog.schema_version: unsupported version');
  list(catalog.providers, 'catalog.providers');
  const seen = new Set();
  for (const [index, provider] of catalog.providers.entries()) {
    const at = `providers[${index}]`;
    exactKeys(provider, ['id', 'name', 'type', 'purpose', 'adoption', 'dashboard_url', 'reuse_policy', 'environment_policy', 'automation', 'quota_notes', 'sources'], ['variable_examples'], at);
    for (const key of ['id', 'name', 'type', 'purpose', 'reuse_policy', 'environment_policy', 'quota_notes']) text(provider[key], `${at}.${key}`);
    if (!/^[a-z][a-z0-9_]*$/.test(provider.id) || seen.has(provider.id)) fail(`${at}.id: invalid or duplicate provider ID`);
    seen.add(provider.id);
    if (provider.id === 'github') fail(`${at}.id: GitHub is shared infrastructure, outside this catalog`);
    if (!['base', 'optional', 'reference', 'project_specific'].includes(provider.adoption)) fail(`${at}.adoption: invalid`);
    url(provider.dashboard_url, `${at}.dashboard_url`);
    exactKeys(provider.automation, ['methods', 'status', 'steps'], [], `${at}.automation`);
    list(provider.automation.methods, `${at}.automation.methods`);
    if (new Set(provider.automation.methods).size !== provider.automation.methods.length || provider.automation.methods.some((method) => !['api', 'cli', 'browser'].includes(method))) fail(`${at}.automation.methods: invalid or duplicate method`);
    if (!['documented', 'access_verified', 'recipe_tested'].includes(provider.automation.status)) fail(`${at}.automation.status: invalid`);
    // A status beyond documentation requires operation-specific dated evidence, not a claimed flag.
    if (provider.automation.status !== 'documented') fail(`${at}.automation.status: public recipes are documented; live access/test evidence belongs in private records`);
    list(provider.automation.steps, `${at}.automation.steps`);
    provider.automation.steps.forEach((step, i) => text(step, `${at}.automation.steps[${i}]`));
    list(provider.sources, `${at}.sources`);
    provider.sources.forEach((source, i) => {
      exactKeys(source, ['url', 'checked_at'], [], `${at}.sources[${i}]`);
      url(source.url, `${at}.sources[${i}].url`);
      date(source.checked_at, `${at}.sources[${i}].checked_at`);
    });
    if (provider.variable_examples !== undefined) {
      list(provider.variable_examples, `${at}.variable_examples`);
      const variableNames = new Set();
      for (const [i, variable] of provider.variable_examples.entries()) {
        const variableAt = `${at}.variable_examples[${i}]`;
        exactKeys(variable, ['name', 'source', 'targets', 'secret', 'purpose', 'note'], [], variableAt);
        for (const key of ['name', 'source', 'purpose', 'note']) text(variable[key], `${variableAt}.${key}`);
        if (!/^[A-Z][A-Z0-9_]*$/.test(variable.name) || variableNames.has(variable.name)) fail(`${variableAt}.name: invalid or duplicate`);
        variableNames.add(variable.name);
        if (typeof variable.secret !== 'boolean') fail(`${variableAt}.secret: expected boolean`);
        list(variable.targets, `${variableAt}.targets`);
        if (new Set(variable.targets).size !== variable.targets.length || variable.targets.some((target) => !['web_runtime', 'worker_runtime', 'migration', 'local_cli'].includes(target))) fail(`${variableAt}.targets: invalid or duplicate destination`);
        if (['MODAL_TOKEN_ID', 'MODAL_TOKEN_SECRET'].includes(variable.name) && variable.targets.some((target) => target !== 'local_cli')) fail(`${variableAt}: operator tokens cannot be app runtime variables`);
      }
    }
    const serialized = JSON.stringify(provider);
    if (/(?:[a-z0-9._%+-]+)@(?:gmail|hotmail|outlook|yahoo)\.[a-z]+|(?:sk_live_|sk_test_|ghp_|github_pat_|AKIA)[a-zA-Z0-9_]+|postgres(?:ql)?:\/\//i.test(serialized)) fail(`${at}: personal email or credential-shaped value in public recipe`);
  }
  return { providers: catalog.providers.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    // The canonical catalog is JSON-compatible YAML, deliberately dependency-free for plugin consumers.
    const result = validateServiceCatalog(JSON.parse(readFileSync(process.argv[2] || path.join(root, 'factory/services/catalog.yaml'), 'utf8')));
    console.log(`Service catalog valid: ${result.providers} documented provider recipes`);
  } catch (error) {
    console.error(`Service catalog invalid: ${error.message}`);
    process.exitCode = 1;
  }
}
