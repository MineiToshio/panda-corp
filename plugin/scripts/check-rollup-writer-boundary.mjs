#!/usr/bin/env node
import { readFileSync } from "node:fs";
import path from "node:path";
const root = path.resolve(process.argv[2] || ".");
const engine = readFileSync(path.join(root, "plugin/templates/shared/.claude/engines/pandacorp-build.js"), "utf8");
if (!/pandacorp-build-state\.mjs.*sync-rollups/.test(engine)) { console.error("rollup writer boundary RED: generated CLI fragment absent"); process.exit(2); }
const forbidden = [/Sync DERIVED rollup state, frontmatter ONLY/, /Refresh \.pandacorp\/status\.yaml per-status work-order counts/];
for (const pattern of forbidden) if (pattern.test(engine)) { console.error(`rollup writer boundary RED: retired prose returned (${pattern})`); process.exit(2); }
console.log("PASS  rollup writer boundary");
