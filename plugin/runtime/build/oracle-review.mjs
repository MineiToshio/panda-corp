// A causal hash replacement is evidence of change, never evidence of retained coverage.
import { git } from "./units.mjs";
import { sha256Hex } from "./fsx.mjs";

export function oracleReviewPassed(unit) {
  if (!unit.test_repair) return true;
  const proof = unit.rescue?.coverage_review;
  const files = Object.entries(unit.test_repair.old_hashes);
  return unit.review?.verdict === "pass" && unit.rescue?.phase === "completed"
    && proof?.preserves_coverage === true && proof.commit === unit.rescue.commit
    && files.length > 0 && proof.files?.length === files.length
    && files.every(([file, old]) => proof.files.some(f => f.file === file && f.old_hash === old
      && f.new_hash === unit.test_hashes?.[file] && f.assertions?.length > 0));
}

// Pending repair hashes are candidates; the predecessor stays authoritative until review passes.
export const protectedOracleHashes = state => Object.assign({}, ...state.units
  .filter(u => u.state !== "abandoned" && oracleReviewPassed(u))
  .map(u => ({ ...u.test_hashes, ...u.probe_hashes })));

export async function validateOracleCoverage({ unit, report, root, deps }) {
  const proof = report.oracle_coverage, files = Object.entries(unit.test_repair.old_hashes);
  const reject = () => { throw new Error("independent oracle review must confirm conserved or equivalent assertions for every protected file"); };
  if (proof?.preserves_coverage !== true || !Array.isArray(proof.files) || proof.files.length !== files.length || !files.length) reject();
  for (const [file, old] of files) {
    const entries = proof.files.filter(f => f.file === file), item = entries[0];
    if (entries.length !== 1 || item.old_hash !== old || item.new_hash !== unit.test_hashes[file] || !Array.isArray(item.assertions) || !item.assertions.length) reject();
    const before = (await git(deps, root, ["show", `${unit.rescue.base}:./${file}`])).stdout;
    const after = (await git(deps, root, ["show", `${unit.rescue.commit}:./${file}`])).stdout;
    if (sha256Hex(before) !== old || sha256Hex(after) !== item.new_hash) reject();
    for (const assertion of item.assertions) {
      if (![assertion.before, assertion.after, assertion.reason].every(s => typeof s === "string" && s.trim())
        || !before.includes(assertion.before) || !after.includes(assertion.after)) reject();
    }
  }
  return { ...proof, commit: unit.rescue.commit };
}
