#!/usr/bin/env node
import { existsSync, lstatSync, readFileSync, readlinkSync, realpathSync } from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] || path.join(path.dirname(new URL(import.meta.url).pathname), "..", ".."));
const read = (rel) => JSON.parse(readFileSync(path.join(root, rel), "utf8"));
const fail = (message) => { console.error(`Pandacorp runtime-source gate FAILED: ${message}`); process.exit(2); };

const metadata = read("plugin/runtime/plugin-metadata.json");
const tiers = read("plugin/runtime/model-tiers.json");
const workers = read("plugin/runtime/codex-tier-workers.json");
const graph = read("plugin/runtime/source-graph.json");

const common = Object.fromEntries(Object.entries(metadata).filter(([key]) => key !== "runtime_extensions"));
const expectedClaude = { ...common, ...metadata.runtime_extensions.claude };
const expectedCodex = {
  name: common.name,
  version: common.version,
  description: common.description,
  ...metadata.runtime_extensions.codex,
  author: common.author,
  license: common.license,
  keywords: common.keywords,
};
if (JSON.stringify(read("plugin/.claude-plugin/plugin.json")) !== JSON.stringify(expectedClaude)) fail("Claude manifest is not the exact projection of plugin-metadata.json");
if (JSON.stringify(read("plugin/.codex-plugin/plugin.json")) !== JSON.stringify(expectedCodex)) fail("Codex manifest is not the exact projection of plugin-metadata.json");
if ("hooks" in expectedCodex) fail("Codex manifest must not own hook registration; hooks are an enforcement projection");
if (typeof expectedCodex.skills !== "string" || !expectedCodex.skills) fail("Codex manifest lacks its skills projection");
const codexInterface = expectedCodex.interface;
for (const field of ["displayName", "shortDescription", "longDescription", "developerName", "category"]) {
  if (typeof codexInterface?.[field] !== "string" || !codexInterface[field].trim()) fail(`Codex manifest interface lacks ${field}`);
}
if (!Array.isArray(codexInterface?.capabilities) || !codexInterface.capabilities.length || codexInterface.capabilities.some((value) => typeof value !== "string" || !value.trim())) fail("Codex manifest interface capabilities must be a non-empty string array");
if (!Array.isArray(codexInterface?.defaultPrompt) || codexInterface.defaultPrompt.length < 1 || codexInterface.defaultPrompt.length > 3 || codexInterface.defaultPrompt.some((value) => typeof value !== "string" || !value.trim() || value.length > 128)) fail("Codex manifest interface defaultPrompt must contain 1-3 non-empty prompts of at most 128 characters");
if ("interface" in expectedClaude || "skills" in expectedClaude) fail("Claude manifest received Codex-only presentation or discovery fields");

const marketplace = read(".agents/plugins/marketplace.json");
const expectedMarketplace = {
  name: "panda-corp",
  interface: { displayName: "Panda Corp" },
  plugins: [{
    name: metadata.name,
    source: { source: "local", path: "./plugins/pandacorp" },
    policy: { installation: "AVAILABLE", authentication: "ON_INSTALL" },
    category: "Productivity",
  }],
};
if (JSON.stringify(marketplace) !== JSON.stringify(expectedMarketplace)) fail("repo-local Codex marketplace is not the exact Pandacorp bridge projection");
const marketplaceBridge = path.join(root, "plugins/pandacorp");
if (!lstatSync(marketplaceBridge).isSymbolicLink()) fail("repo-local Codex marketplace bridge must be a symlink");
if (readlinkSync(marketplaceBridge) !== "../plugin") fail("repo-local Codex marketplace bridge must use the canonical relative target ../plugin");
if (realpathSync(marketplaceBridge) !== realpathSync(path.join(root, "plugin"))) fail("repo-local Codex marketplace bridge does not resolve to canonical plugin/");

const aliases = new Set();
for (const [name, tier] of Object.entries(tiers.tiers || {})) {
  if (!tier.codex?.model || !tier.codex?.effort) fail(`tier ${name} lacks a Codex mapping`);
  for (const alias of tier.aliases || []) {
    if (aliases.has(alias)) fail(`model alias ${alias} has more than one owner`);
    aliases.add(alias);
  }
}
for (const worker of workers.workers || []) {
  if (!tiers.tiers[worker.tier]) fail(`tier worker ${worker.name} references unknown tier ${worker.tier}`);
}

const outputs = new Set();
for (const [fact, node] of Object.entries(graph.facts || {})) {
  if (node.source && !existsSync(path.join(root, node.source))) fail(`${fact} source is missing: ${node.source}`);
  for (const output of node.outputs || []) {
    if (outputs.has(output)) fail(`output ${output} has more than one producer`);
    outputs.add(output);
    if (output === node.source) fail(`${fact} declares its source as an output`);
    if (!existsSync(path.join(root, output))) fail(`${fact} output is missing: ${output}`);
  }
}

const generator = readFileSync(path.join(root, "plugin/scripts/generate-codex-agents.mjs"), "utf8");
for (const tier of Object.values(tiers.tiers)) {
  if (generator.includes(tier.codex.model)) fail(`model literal ${tier.codex.model} leaked into the generator`);
}
