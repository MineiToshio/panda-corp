#!/usr/bin/env node
// CONV-17 / DR-137: check standalone Claude project skills, not runtime discovery.
import { existsSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import { join, resolve } from 'node:path';

const args = process.argv.slice(2);
let projectRoot = '.';
let selectedSkill;
let rollout = false;
let legacyWarnings = false;
for (let index = 0; index < args.length; index += 1) {
  const argument = args[index];
  if (argument === '--rollout') rollout = true;
  else if (argument === '--strict') rollout = false;
  else if (argument === '--skill') selectedSkill = args[++index];
  else if (argument.startsWith('--')) throw new Error(`unknown option ${argument}`);
  else projectRoot = argument;
}
if (args.includes('--skill') && !selectedSkill) throw new Error('--skill requires a slug');
const root = resolve(projectRoot);
const skillsRoot = join(root, '.claude/skills');
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function scalar(text, key) {
  const matches = text.split(/\r?\n/).filter((line) => line.startsWith(`${key}:`));
  if (matches.length !== 1) throw new Error(`expected exactly one ${key} field`);
  const value = matches[0].slice(key.length + 1).trim();
  const match = /^(?:"([^"\r\n]*)"|'([^'\r\n]*)'|([^#\s]+))\s*(?:#.*)?$/.exec(value);
  if (!match) throw new Error(`invalid ${key} scalar`);
  return match[1] ?? match[2] ?? match[3];
}

function main() {
  if (!existsSync(skillsRoot) && !selectedSkill) return;
  let entries = readdirSync(skillsRoot, { withFileTypes: true })
    .filter((entry) => !entry.name.startsWith('.') && (entry.isDirectory() || entry.isSymbolicLink()));
  if (selectedSkill) {
    if (!slugPattern.test(selectedSkill)) throw new Error('--skill requires an English kebab-case directory slug');
    entries = entries.filter((entry) => entry.name === selectedSkill);
    if (entries.length !== 1) throw new Error(`requested skill not found: ${selectedSkill}`);
  }
  if (!entries.length) return;
  const status = readFileSync(join(root, '.pandacorp/status.yaml'), 'utf8');
  if (rollout) {
    legacyWarnings = true;
    try {
      const version = scalar(status, 'created_with');
      if (/^\d+\.\d+\.\d+$/.test(version)) {
        const [major, minor] = version.split('.').map(Number);
        legacyWarnings = major < 8 || (major === 8 && minor < 110);
      }
    } catch { /* Missing provenance must never opt an old project into a new hard gate. */ }
    if (legacyWarnings) console.log('PROJECT-SKILLS: legacy rollout is advisory; new or renamed skills require --strict --skill <slug>');
  }
  const project = scalar(status, 'project');
  if (!slugPattern.test(project)) throw new Error('status.yaml project must be an English kebab-case slug');
  const publicNames = new Set();
  const targets = new Set();
  for (const entry of entries) {
    const folder = join(skillsRoot, entry.name);
    const manifestPath = join(folder, '.claude-plugin/plugin.json');
    if (existsSync(manifestPath)) {
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
      if (manifest.name !== project) throw new Error(`${entry.name}: plugin namespace must be ${project}`);
      // Plugins supply their namespace; their skill resolution is reviewed with the native loader.
      console.log(`PROJECT-SKILLS: ${entry.name} plugin namespace checked; skill resolution requires native review`);
      if (!existsSync(join(folder, 'SKILL.md'))) continue;
    }
    const path = join(folder, 'SKILL.md');
    const target = realpathSync(path);
    if (targets.has(target)) continue;
    targets.add(target);
    const text = readFileSync(path, 'utf8');
    const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text);
    if (!frontmatter) throw new Error(`${entry.name}: missing or unterminated frontmatter`);
    const name = scalar(frontmatter[1], 'name');
    const prefix = `${project}:`;
    const skillSlug = name.startsWith(prefix) ? name.slice(prefix.length) : '';
    if (!slugPattern.test(skillSlug)) throw new Error(`${entry.name}: expected name ${project}:<skill-slug>, got ${name}`);
    if (entry.name !== skillSlug) throw new Error(`${entry.name}: directory must match skill slug ${skillSlug}`);
    if (publicNames.has(name)) throw new Error(`duplicate public skill name ${name}`);
    publicNames.add(name);
  }
  console.log(`PROJECT-SKILLS: ${publicNames.size} standalone project skill name(s) valid`);
}

try {
  main();
} catch (error) {
  console.error(`PROJECT-SKILLS: ${legacyWarnings ? "WARNING (legacy rollout): " : ""}${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = legacyWarnings ? 0 : 1;
}
