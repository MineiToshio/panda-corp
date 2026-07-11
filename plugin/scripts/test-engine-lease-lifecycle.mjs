#!/usr/bin/env node
import { readFileSync } from "node:fs";
const body = readFileSync(new URL("../templates/shared/.claude/engines/pandacorp-build.js", import.meta.url), "utf8");
const checks = [
  [body.includes("const RENEW_LEASE"), "renew fragment exists"],
  [/async function safePoint\(\)[\s\S]*?RENEW_LEASE/.test(body), "every safe-point carries renewal"],
  [/async function ensureStopped[\s\S]*?RELEASE_LEASE/.test(body), "early stop releases"],
  [/Crash fail-safe[\s\S]*?RELEASE_LEASE/.test(body), "crash releases"],
  [/label: 'release-lease'/.test(body), "successful terminal path releases"],
  [/quiesce --project[\s\S]*?commit[\s\S]*?finalize-release --project/.test(body), "Claude release is quiesce -> committed projection -> finalize"],
  [body.includes("Never use the compatibility \\`release\\` command here"), "Claude terminal path forbids one-phase compatibility release"],
  [/lease token\/epoch missing/.test(body), "missing receipt fails closed"],
];
let pass = 0; for (const [ok, name] of checks) { if (!ok) throw new Error(name); console.log(`PASS  ${name}`); pass++; } console.log(`RESULT: ${pass} passed, 0 failed`);
