#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const source = readFileSync(path.join(root, "plugin/runtime/prompts/sync-rollups.md"), "utf8").trim().replace(/\s+/g, " ");
const file = path.join(root, "plugin/templates/shared/.claude/engines/pandacorp-build.js");
const body = readFileSync(file, "utf8");
const generated = `const SYNC_ROLLUPS = ${JSON.stringify(source)}.replaceAll('{{STATE_CLI_COMMAND}}', STATE_CLI_COMMAND).replaceAll('{{PROJECT_DIR}}', PROJECT_DIR).replaceAll('{{LEASE_TOKEN}}', LEASE_TOKEN).replaceAll('{{LEASE_EPOCH}}', String(LEASE_EPOCH))`;
if (!/^const SYNC_ROLLUPS = .*$/m.test(body)) throw new Error("SYNC_ROLLUPS generation marker not found");
const next = body.replace(/^const SYNC_ROLLUPS = .*$/m, generated);
writeFileSync(file, next);
