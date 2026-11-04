#!/usr/bin/env node
// Runs in the existing engine corpus; use the template's own config, outside repo ignores.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const deps = process.env.PANDACORP_TEMPLATE_DEPS_DIR ?? path.join(root, 'mission-control');
const biome = path.join(deps, 'node_modules/.bin/biome');
const template = path.join(root, 'plugin/templates/stack-a-nextjs');
const fixture = mkdtempSync(path.join(tmpdir(), 'pandacorp-template-e2e-'));

function hydrationImportsExist(dir) {
  const helper = readFileSync(path.join(dir, '_hydration.ts'), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/[^\r\n]*/g, '');
  const exports = new Set([...helper.matchAll(/export\s+(?:async\s+)?function\s+(\w+)/g)].map((match) => match[1]));
  let checked = 0;
  for (const entry of readdirSync(dir, { recursive: true })) {
    if (!entry.endsWith('.spec.ts')) continue;
    const source = readFileSync(path.join(dir, entry), 'utf8');
    for (const match of source.matchAll(/import\s*\{([^}]+)\}\s*from\s*["']\.\/_hydration(?:\.ts)?["']/g)) {
      for (const binding of match[1].split(',').map((item) => item.trim()).filter(Boolean)) {
        const name = binding.split(/\s+as\s+/)[0];
        assert.ok(exports.has(name), `${entry}: missing _hydration export ${name}`);
        checked++;
      }
    }
  }
  assert.ok(checked > 0, 'must check actual hydration imports');
  return checked;
}

function checkBiome() {
  const result = spawnSync(biome, ['check', 'e2e', '--error-on-warnings'], { cwd: fixture, encoding: 'utf8' });
  assert.ifError(result.error);
  return result;
}

try {
  const git = spawnSync('git', ['init', '--quiet'], { cwd: fixture, encoding: 'utf8' });
  assert.equal(git.status, 0, git.stderr);
  writeFileSync(path.join(fixture, '.gitignore'), '');
  cpSync(path.join(template, 'biome.json'), path.join(fixture, 'biome.json'));
  cpSync(path.join(template, 'e2e'), path.join(fixture, 'e2e'), { recursive: true });
  const e2e = path.join(fixture, 'e2e');
  const checked = hydrationImportsExist(e2e);
  const result = checkBiome();
  assert.equal(result.status, 0, result.stdout + result.stderr);
  // Negative controls: absent/commented exports and a formatter regression must fail.
  writeFileSync(path.join(e2e, 'missing.spec.ts'), 'import { absent as local } from "./_hydration";\n');
  assert.throws(() => hydrationImportsExist(e2e), /missing _hydration export absent/);
  rmSync(path.join(e2e, 'missing.spec.ts'));
  const helperPath = path.join(e2e, '_hydration.ts');
  const helper = readFileSync(helperPath, 'utf8');
  writeFileSync(helperPath, helper.replace('export async function waitForHydrated', '// export async function waitForHydrated'));
  assert.throws(() => hydrationImportsExist(e2e), /missing _hydration export waitForHydrated/);
  writeFileSync(helperPath, helper);
  writeFileSync(path.join(e2e, 'malformed.spec.ts'), 'export const malformed={value:1};\n');
  assert.notEqual(checkBiome().status, 0, 'Biome must reject unformatted e2e');
  console.log(`OK: template biome check e2e --error-on-warnings; ${checked} hydration imports; 3 negative controls`);
} finally {
  rmSync(fixture, { recursive: true, force: true });
}
