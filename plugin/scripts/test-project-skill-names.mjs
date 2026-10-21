// Canary for the public naming contract, including the actual doc-lint trigger.
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const template = resolve(dirname(fileURLToPath(import.meta.url)), '../templates/shared/.pandacorp');

function fixture(t, { skills = [], project = 'funko-tracker', provenance = 'adopt', checker = true } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'project-skill-names-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, '.pandacorp'));
  writeFileSync(join(root, '.pandacorp/status.yaml'), `project: "${project}"\ncreated_via: ${provenance}\n`);
  copyFileSync(join(template, 'doc-lint.sh'), join(root, '.pandacorp/doc-lint.sh'));
  if (checker) copyFileSync(join(template, 'check-project-skills.mjs'), join(root, '.pandacorp/check-project-skills.mjs'));
  for (const [folder, content] of skills) {
    const path = join(root, '.claude/skills', folder);
    mkdirSync(path, { recursive: true });
    writeFileSync(join(path, 'SKILL.md'), content);
  }
  return root;
}

function skill(name) {
  return `---\nname: ${name}\ndescription: Test fixture\n---\n# Fixture\n`;
}

function lint(root) {
  const result = spawnSync('bash', ['.pandacorp/doc-lint.sh'], { cwd: root, encoding: 'utf8' });
  assert.ifError(result.error);
  return result;
}

test('two namespaced ingestion commands pass without a docs directory', (t) => {
  const root = fixture(t, { skills: [['ingest-catalog', skill('funko-tracker:ingest-catalog')], ['ingest-delta', skill('funko-tracker:ingest-delta')]] });
  const result = lint(root);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /2 standalone project skill name\(s\) valid/);
});

test('projects without local skills pass', (t) => assert.equal(lint(fixture(t)).status, 0));

for (const [label, content, folder = 'ingest-catalog'] of [
  ['bare legacy name', skill('ingest-catalog')],
  ['another project namespace', skill('other:ingest-catalog')],
  ['duplicated namespace', skill('funko-tracker:funko-tracker:ingest-catalog')],
  ['invalid slug', skill('funko-tracker:Ingest_Catalog')],
  ['folder mismatch', skill('funko-tracker:ingest-delta')],
  ['missing name', '---\ndescription: fixture\n---\n'],
  ['duplicate name keys', '---\nname: funko-tracker:ingest-catalog\nname: funko-tracker:ingest-catalog\n---\n'],
  ['unterminated frontmatter', '---\nname: funko-tracker:ingest-catalog\n'],
]) {
  test(`${label} blocks the actual gate even on an adopted project`, (t) => {
    const result = lint(fixture(t, { skills: [[folder, content]] }));
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stderr + result.stdout, /PROJECT-SKILLS/);
  });
}

test('a missing checker fails closed when project skills exist', (t) => {
  const result = lint(fixture(t, { checker: false, skills: [['ingest-catalog', skill('funko-tracker:ingest-catalog')]] }));
  assert.equal(result.status, 1, result.stdout + result.stderr);
});

test('quoted names and CRLF are accepted', (t) => {
  const root = fixture(t, { skills: [['ingest-delta', skill('"funko-tracker:ingest-delta" # identity').replaceAll('\n', '\r\n')]] });
  assert.equal(lint(root).status, 0);
});
