#!/usr/bin/env node
// job-command.mjs — fixture job command: `exit0` prints ok and exits 0, `exit1` prints boom on stderr and exits 1,
// `hang` records its pid in $FIXTURE_JOB_PIDFILE (when set) and sleeps until killed.
import { writeFileSync } from "node:fs";
const kind = process.argv[2];
if (kind === "exit0") { process.stdout.write("ok\n"); process.exit(0); }
else if (kind === "exit1") { process.stderr.write("boom\n"); process.exit(1); }
else if (kind === "hang") {
  if (process.env.FIXTURE_JOB_PIDFILE) writeFileSync(process.env.FIXTURE_JOB_PIDFILE, `${process.pid}\n`);
  setInterval(() => {}, 1 << 30);
} else { process.stderr.write(`job-command: unknown kind ${kind}\n`); process.exit(2); }
