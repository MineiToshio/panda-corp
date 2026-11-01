import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const sourcePath = "src/components/core/Chip/vocabulary.ts";
const source = readFileSync(sourcePath, "utf8");
const test = readFileSync("src/components/core/Chip/_tests/stackOrder.test.ts", "utf8");
const marker = "export const WORK_ORDER_STACK_STATES = ";
const start = source.indexOf(marker) + marker.length;
const end = source.indexOf("] as const", start) + 1;
if (start < marker.length || end <= start) throw new Error("Missing stack declaration");
const original = source.slice(start, end);
const states = [...original.matchAll(/"([^"]+)"/g)].map((match) => match[1]);
if (states.length !== 5 || new Set(states).size !== 5)
  throw new Error("Unexpected stack vocabulary");
const variants = [{ id: "baseline", states }];
for (let index = 0; index < states.length; index++) {
  variants.push({
    id: `delete-${index}`,
    states: states.filter((_, position) => position !== index),
  });
  variants.push({
    id: `duplicate-${index}`,
    states: states.map((state, position) =>
      position === index ? states[(index + 1) % states.length] : state,
    ),
  });
  if (index < states.length - 1) {
    const swapped = [...states];
    [swapped[index], swapped[index + 1]] = [swapped[index + 1], swapped[index]];
    variants.push({ id: `swap-${index}`, states: swapped });
  }
}
variants.push(
  { id: "reverse", states: [...states].reverse() },
  { id: "empty", states: [] },
  { id: "append", states: [...states, states[0]] },
);
mkdirSync(".mutation-cache/stack-mutants", { recursive: true });
mkdirSync(".mutation-cache/stack-tests", { recursive: true });
for (const variant of variants) {
  writeFileSync(
    `.mutation-cache/stack-mutants/${variant.id}.ts`,
    source.slice(0, start) + JSON.stringify(variant.states) + source.slice(end),
  );
  writeFileSync(
    `.mutation-cache/stack-tests/${variant.id}.test.ts`,
    test.replace('"../vocabulary"', JSON.stringify(`../stack-mutants/${variant.id}`)),
  );
}
writeFileSync(
  ".mutation-cache/stack-vitest.config.ts",
  `import base from '../vitest.config';\nexport default {...base, test: {...base.test, include: ['.mutation-cache/stack-tests/*.test.ts'], exclude: base.test.exclude.filter(pattern => pattern !== '.mutation-cache/**'), maxWorkers: 1}};\n`,
);
writeFileSync(".mutation-cache/stack-results.json", "");
const run = spawnSync(
  process.execPath,
  [
    process.argv[2],
    "run",
    "--config",
    ".mutation-cache/stack-vitest.config.ts",
    "--reporter=json",
    "--outputFile=.mutation-cache/stack-results.json",
  ],
  { encoding: "utf8" },
);
writeFileSync(".mutation-cache/stack-run.log", `${run.stdout}\n${run.stderr}`);
if (run.error) throw run.error;
const result = JSON.parse(readFileSync(".mutation-cache/stack-results.json", "utf8"));
const assertions = (id) =>
  result.testResults.find((file) => path.basename(file.name) === `${id}.test.ts`)
    ?.assertionResults ?? [];
if (assertions("baseline")[0]?.status !== "passed") throw new Error("Unmutated stack test failed");
const mutants = variants.slice(1).map((variant) => {
  const assertion = assertions(variant.id)[0];
  if (!assertion || !["passed", "failed"].includes(assertion.status))
    throw new Error(`Missing result for ${variant.id}`);
  if (
    assertion.status === "failed" &&
    !assertion.failureMessages.some((message) => message.includes("AssertionError"))
  )
    throw new Error(`Non-assertion failure for ${variant.id}`);
  return {
    id: variant.id,
    mutatorName: "StackOrder",
    replacement: JSON.stringify(variant.states),
    status: assertion.status === "failed" ? "Killed" : "Survived",
    location: { start: { line: 64, column: 0 }, end: { line: 70, column: 0 } },
  };
});
mkdirSync("reports/mutation", { recursive: true });
writeFileSync(
  process.argv[3],
  JSON.stringify(
    {
      engine: "explicit-stack-order-campaign",
      baseline: "passed",
      files: { [sourcePath]: { source, mutants } },
    },
    null,
    2,
  ),
);
console.log(
  `Stack mutation campaign: ${mutants.filter((mutant) => mutant.status === "Killed").length}/${mutants.length} killed; baseline passed.`,
);
if (mutants.some((mutant) => mutant.status !== "Killed")) process.exitCode = 1;
