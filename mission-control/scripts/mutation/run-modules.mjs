import { spawnSync } from "node:child_process";
import { mkdirSync, realpathSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import config from "../../stryker.config.mjs";

const cli = realpathSync(process.argv[2]);
const plugin = createRequire(cli).resolve("@stryker-mutator/vitest-runner");
const targets = config.mutate.filter(
  (target) => !process.argv[3] || target.includes(process.argv[3]),
);
if (!targets.length) throw new Error("No matching mutation modules");
mkdirSync(".mutation-cache", { recursive: true });
const reports = [];
let failed = false;
for (const target of targets) {
  const name = path.relative("src", target.split(":")[0]).replaceAll(path.sep, "__");
  const report = `reports/mutation/${name}.json`;
  const temporaryConfig = ".mutation-cache/module.config.mjs";
  writeFileSync(
    temporaryConfig,
    `import base from '../stryker.config.mjs';\nexport default { ...base, mutate: ${JSON.stringify([target])}, jsonReporter: {fileName: ${JSON.stringify(report)}}, htmlReporter: {fileName: ${JSON.stringify(`reports/mutation/${name}.html`)}} };\n`,
  );
  console.log(`\nMutation module: ${target}`);
  const args = target.includes("/Chip/vocabulary.ts:")
    ? [
        "scripts/mutation/stack-order.mjs",
        path.join(path.dirname(createRequire(cli).resolve("vitest/package.json")), "vitest.mjs"),
        report,
      ]
    : [cli, "run", temporaryConfig, "--plugins", plugin];
  const run = spawnSync(process.execPath, args, { stdio: "inherit" });
  if (run.error) throw run.error;
  if (run.status !== 0) failed = true;
  reports.push(report);
}
const check = spawnSync(process.execPath, ["scripts/mutation/check-scores.mjs", ...reports], {
  stdio: "inherit",
});
if (check.error) throw check.error;
if (failed || check.status !== 0) process.exitCode = 1;
