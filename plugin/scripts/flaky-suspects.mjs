#!/usr/bin/env node
// Stable observations only; authorizations are always an owner action.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { flakySuspects } from '../templates/shared/.pandacorp/test-gate-policy.mjs';
export { flakySuspects };
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const args = process.argv.slice(2).filter(a=>a !== '--json');
    console.log(JSON.stringify(flakySuspects(readFileSync(args[0] ?? '.pandacorp/run/test-outcomes.jsonl','utf8')),null,2));
  } catch (error) { console.error(error.message); process.exitCode=1; }
}
