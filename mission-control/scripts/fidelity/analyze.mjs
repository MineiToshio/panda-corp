/** Compare three unchanged captures on each side before suggesting any pixel tolerance. */
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { noiseBudget, summarize } from "./calibration.mjs";

const require = createRequire(path.join(process.cwd(), "package.json"));
const { chromium } = require("@playwright/test");
const directory = process.argv[2];
if (!directory)
  throw new Error("Usage: node scripts/fidelity/analyze.mjs <audit evidence directory>");
const factory = process.env.PANDACORP_FACTORY_ROOT;
if (!factory) throw new Error("PANDACORP_FACTORY_ROOT is required");
const { openDecoder } = await import(
  pathToFileURL(path.join(factory, "plugin/skills/design/scripts/fidelity/pixels.mjs"))
);
const runs = [1, 2, 3].map((n) => {
  const dir = path.join(directory, `run-${n}`);
  if (!fs.existsSync(dir)) throw new Error(`Missing run ${n}`);
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")));
});
const browser = await chromium.connect(
  process.env.PW_TEST_CONNECT_WS_ENDPOINT ?? "ws://127.0.0.1:4950/pw",
);
const noise = [];
const missing = [];
try {
  const decoder = await openDecoder(browser);
  for (const first of runs[0]) {
    const series = runs.map((rows) => rows.find((r) => r.id === first.id));
    if (!series.every((r) => r?.validState)) {
      missing.push(first.id);
      continue;
    }
    for (const side of ["oracle", "app"])
      for (const n of [1, 2]) {
        const reference = fs.readFileSync(series[0][side].viewportFile);
        const candidate = fs.readFileSync(series[n][side].viewportFile);
        const result = await decoder.diff(reference, candidate, {
          sliceHeight: 900,
          threshold: 0.1,
          maxRatio: 0.005,
        });
        if (result.sizeMismatch) throw new Error(`Calibration size mismatch: ${first.id}`);
        noise.push({ id: first.id, side, againstRun: n + 1, ratio: result.slices[0].ratio });
      }
  }
  await decoder.close();
} finally {
  await browser.close();
}
const budget = noiseBudget(noise.map((r) => r.ratio));
const groups = {};
for (const width of [375, 768, 1280])
  for (const theme of ["light", "dark"]) {
    groups[`${width}-${theme}`] = summarize(
      runs
        .flat()
        .filter((r) => r.validState && r.width === width && r.theme === theme)
        .flatMap((r) => r.viewport?.slices.map((s) => s.ratio) ?? []),
    );
  }
const result = {
  mode: "advisory",
  unit: "ratio (multiply by 100 for percent)",
  metric: "pixelmatch-7 YIQ 0.1, includeAA=false, first 900px viewport only",
  runCounts: runs.map((rows) => ({
    attempted: rows.length,
    valid: rows.filter((r) => r.validState).length,
    fullPass: rows.filter((r) => r.validState && r.full?.ok).length,
    fullSizeMismatch: rows.filter((r) => r.full?.sizeMismatch).length,
  })),
  repeatedStateContexts: noise.length / 4,
  missing,
  noise: summarize(noise.map((r) => r.ratio)),
  noiseBySide: Object.fromEntries(
    ["oracle", "app"].map((side) => [
      side,
      summarize(noise.filter((r) => r.side === side).map((r) => r.ratio)),
    ]),
  ),
  proposedViewportNoiseBudget: budget,
  rationale:
    "Observed maximum same-side repeat noise plus 0.5 percentage points; percentiles remain visible separately. Diagnostic proposal only: does not excuse product drift, page height mismatch, missing doubles/actions or missing L1/L2/axe coverage.",
  productByContext: groups,
  withinProposedBudget: runs.map(
    (rows) =>
      rows.filter(
        (r) =>
          r.validState && r.viewport?.slices.every((s) => budget !== null && s.ratio <= budget),
      ).length,
  ),
  gateEligible: false,
  gateReason:
    "No complete L1-L4 coverage: sampled shared hooks only, missing data doubles, no complete axe matrix. Full-height mismatches and action errors remain failures.",
};
fs.writeFileSync(path.join(directory, "analysis.json"), JSON.stringify(result, null, 2));
fs.writeFileSync(path.join(directory, "noise.json"), JSON.stringify(noise));
console.log(JSON.stringify(result, null, 2));
