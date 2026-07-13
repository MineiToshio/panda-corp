#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const source = readFileSync(path.join(root, "plugin/runtime/prompts/sync-rollups.md"), "utf8").trim().replace(/\s+/g, " ");
const reviewer = readFileSync(path.join(root, "plugin/agents/reviewer.md"), "utf8");
const wholeFrdMatch = reviewer.match(/<!-- WHOLE_FRD_ORACLE_START -->([\s\S]*?)<!-- WHOLE_FRD_ORACLE_END -->/);
if (!wholeFrdMatch) throw new Error("canonical WHOLE_FRD_ORACLE block not found in reviewer.md");
const wholeFrdSource = wholeFrdMatch[1].trim().replace(/\s+/g, " ");
const file = path.join(root, "plugin/templates/shared/.claude/engines/pandacorp-build.js");
const body = readFileSync(file, "utf8");
const generated = `const SYNC_ROLLUPS = ${JSON.stringify(source)}.replaceAll('{{STATE_CLI_COMMAND}}', STATE_CLI_COMMAND).replaceAll('{{PROJECT_DIR}}', PROJECT_DIR).replaceAll('{{LEASE_TOKEN}}', LEASE_TOKEN).replaceAll('{{LEASE_EPOCH}}', String(LEASE_EPOCH))`;
const generatedWholeFrd = `const WHOLE_FRD_ORACLE = ${JSON.stringify(wholeFrdSource)}`;
if (!/^const SYNC_ROLLUPS = .*$/m.test(body)) throw new Error("SYNC_ROLLUPS generation marker not found");
if (!/^const WHOLE_FRD_ORACLE = .*$/m.test(body)) throw new Error("WHOLE_FRD_ORACLE generation marker not found");
const next = body.replace(/^const SYNC_ROLLUPS = .*$/m, generated).replace(/^const WHOLE_FRD_ORACLE = .*$/m, generatedWholeFrd);
writeFileSync(file, next);
