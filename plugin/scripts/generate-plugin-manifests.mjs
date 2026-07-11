#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const source = JSON.parse(readFileSync(path.join(root, "plugin/runtime/plugin-metadata.json"), "utf8"));
const { runtime_extensions: extensions, ...common } = source;

for (const runtime of ["claude", "codex"]) {
  // Runtime extensions are deliberately projected, not copied wholesale between
  // manifests. In particular, Codex hook registration is owned by the enforcement
  // projection (.codex/config.toml + plugin/hooks), because plugin.json rejects hooks.
  const manifest = runtime === "codex"
    ? { name: common.name, version: common.version, description: common.description, ...extensions.codex, author: common.author, license: common.license, keywords: common.keywords }
    : { ...common, ...extensions.claude };
  writeFileSync(path.join(root, `plugin/.${runtime}-plugin/plugin.json`), `${JSON.stringify(manifest, null, 2)}\n`);
}
