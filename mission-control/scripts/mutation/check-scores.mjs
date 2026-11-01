import { readFileSync } from "node:fs";

const paths = process.argv.slice(2);
const reports = (paths.length ? paths : ["reports/mutation/mutation.json"]).map((file) =>
  (() => {
    const parsed = JSON.parse(readFileSync(file, "utf8"));
    if (!parsed.files || !Object.keys(parsed.files).length)
      throw new Error(`Missing module results: ${file}`);
    return parsed;
  })(),
);
const report = { files: Object.assign({}, ...reports.map((item) => item.files)) };
const outcomes = ["Killed", "Timeout", "Survived", "NoCoverage"];
if (!report.files || !Object.keys(report.files).length) throw new Error("Missing module results");
let failed = false;
console.log("| Module | Killed | Timeout | Survived | No coverage | Errors/ignored | Score | ");
console.log("|---|---:|---:|---:|---:|---:|---:|");
for (const [file, result] of Object.entries(report.files)) {
  if (typeof result.source === "string" && result.source !== readFileSync(file, "utf8"))
    throw new Error(`Report source differs from the current module: ${file}`);
  const count = (status) => result.mutants.filter((mutant) => mutant.status === status).length;
  const total = result.mutants.filter((mutant) => outcomes.includes(mutant.status)).length;
  const detected = count("Killed") + count("Timeout");
  const score = total ? (100 * detected) / total : Number.NaN;
  const excluded = result.mutants.length - total;
  console.log(
    `| ${file} | ${count("Killed")} | ${count("Timeout")} | ${count("Survived")} | ${count("NoCoverage")} | ${excluded} | ${score.toFixed(2)}% |`,
  );
  if (!(score >= 60)) failed = true;
}
if (failed) process.exitCode = 1;
