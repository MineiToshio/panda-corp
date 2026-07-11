#!/usr/bin/env node
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const skillsRoot = path.join(root, "plugin/skills");
const policy = JSON.parse(readFileSync(path.join(root, "plugin/runtime/skill-runtime-policy.json"), "utf8"));
const scalar = (body, key) => body.match(new RegExp(`^${key}:\\s*(.+)$`, "m"))?.[1]?.trim();
const skills = readdirSync(skillsRoot, { withFileTypes: true }).filter((e) => e.isDirectory() && readdirSync(path.join(skillsRoot, e.name)).includes("SKILL.md")).map((e) => e.name).sort().map((slug) => {
  const body = readFileSync(path.join(skillsRoot, slug, "SKILL.md"), "utf8");
  const override = policy.overrides[slug] || {};
  return { slug, source: `plugin/skills/${slug}/SKILL.md`, user_invocable: scalar(body, "user-invocable") !== "false", runtimes: { claude: { ...policy.defaults.claude, ...override.claude }, codex: { ...policy.defaults.codex, ...override.codex } } };
});
writeFileSync(path.join(root, "plugin/runtime/skill-capabilities.json"), `${JSON.stringify({ generated_from: "plugin/skills/*/SKILL.md + plugin/runtime/skill-runtime-policy.json", skills }, null, 2)}\n`);
