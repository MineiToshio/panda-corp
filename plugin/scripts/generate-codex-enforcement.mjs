#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const policy = JSON.parse(readFileSync(path.join(root, "plugin/runtime/enforcement-policy.json"), "utf8"));
const generatedHeader = "# Generated from plugin/runtime/enforcement-policy.json; do not edit by hand.";
const config = `${generatedHeader}\nsandbox_mode = ${JSON.stringify(policy.codex.config.sandbox_mode)}\napproval_policy = ${JSON.stringify(policy.codex.config.approval_policy)}\n\n[agents]\nmax_threads = ${policy.codex.config.max_threads}\nmax_depth = ${policy.codex.config.max_depth}\n\n[features]\nhooks = ${policy.codex.config.hooks_enabled}\n\n[sandbox_workspace_write]\nnetwork_access = ${policy.codex.config.network_access}\n`;
const rules = `${generatedHeader}\n${policy.execpolicy.map((rule) => `prefix_rule(pattern=${JSON.stringify(rule.pattern)}, decision=${JSON.stringify(rule.decision)}, justification=${JSON.stringify(rule.justification)})`).join("\n")}\n`;
const hooks = {
  hooks: {
    PreToolUse: [
      { matcher: policy.codex.hook_matchers.command, hooks: [{ type: "command", command: "node \"./scripts/pandacorp-hook-adapter.mjs\" --runtime codex --event pre-tool", timeout: 15, statusMessage: "Pandacorp Codex safety gate" }] },
      { matcher: policy.codex.hook_matchers.write, hooks: [{ type: "command", command: "node \"./scripts/pandacorp-hook-adapter.mjs\" --runtime codex --event pre-tool", timeout: 15, statusMessage: "Pandacorp Codex write gate" }] }
    ],
    Stop: [{ hooks: [{ type: "command", command: "node \"./scripts/pandacorp-hook-adapter.mjs\" --runtime codex --event stop", timeout: 300, statusMessage: "Pandacorp Codex verify gate" }] }]
  }
};

const outputs = [
  [".codex/config.toml", config],
  [".codex/rules/pandacorp.rules", rules],
  ["plugin/templates/shared/.codex/config.toml", config],
  ["plugin/templates/shared/.codex/rules/pandacorp.rules", rules],
  ["plugin/hooks/codex-hooks.json", `${JSON.stringify(hooks, null, 2)}\n`]
];
for (const [relative, body] of outputs) {
  const target = path.join(root, relative);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, body);
}
