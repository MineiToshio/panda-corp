// units/allowlist.mjs: write allowlists per unit kind (A2) and the path matchers behind them.

const TEST_RES = [/(^|\/)_tests\//, /^[^/]*\.test\.[^/]*$|\/[^/]*\.test\.[^/]*$/, /^[^/]*\.spec\.[^/]*$|\/[^/]*\.spec\.[^/]*$/, /^e2e\//, /^src\/test\//];
const DOCS_RES = [/^docs\//, /^README\.md$/, /^\.env\.example$/];

/** Human-readable patterns per kind, as printed in the brief (A2). */
export function allowlistPatterns(kind, artifacts = []) {
  if (kind === "build" || kind === "patch") return [...artifacts];
  if (kind === "docs") return ["docs/**", "README.md", ".env.example", "new work orders docs/frds/*/work-orders/wo-*.md (implementation_status: PLANNED)"];
  if (kind === "tests" || kind === "review" || kind === "audit" || kind === "deferred-review") return ["**/_tests/**", "**/*.test.*", "**/*.spec.*", "e2e/**", "src/test/**"];
  return [];
}

/** Does a repo-relative path match the test-file globs of A2? */
export const isTestSurface = (rel) => TEST_RES.some((re) => re.test(rel));

function artifactRegExp(glob) {
  const g = glob.replace(/\\/g, "/").replace(/^\.\//, "");
  let re = "";
  for (let i = 0; i < g.length; i += 1) {
    const c = g[i];
    if (c === "*" && g[i + 1] === "*") { if (g[i + 2] === "/") { re += "(?:.*/)?"; i += 2; } else { re += ".*"; i += 1; } } else if (c === "*") re += "[^/]*";
    else if (c === "?") re += "[^/]";
    else re += c.replace(/[.+^$()|[\]\\{}]/g, "\\$&");
  }
  return new RegExp(`^${re}$`);
}

/**
 * Does a changed path fall inside one `artifacts` entry? A plain path matches itself and, as a directory, everything
 * below it; a glob is anchored at the product root (`**` crosses directories, `*` stays inside a segment).
 */
export function matchesArtifact(artifact, rel) {
  const a = String(artifact).replace(/\\/g, "/").replace(/^\.\//, "");
  if (!a) return false;
  if (!/[*?]/.test(a)) return rel === a || rel.startsWith(`${a.replace(/\/+$/, "")}/`);
  return artifactRegExp(a).test(rel);
}

/**
 * Is a product-root-relative path inside the write allowlist of a unit kind?
 * @param {string} kind unit kind
 * @param {string[]} artifacts union of the unit's WOs' `artifacts` (build/patch only)
 * @param {string} rel path relative to the product root
 */
export function isAllowedPath(kind, artifacts, rel) {
  if (kind === "build" || kind === "patch") return artifacts.some((a) => matchesArtifact(a, rel));
  if (kind === "docs") return DOCS_RES.some((re) => re.test(rel));
  if (kind === "tests" || kind === "review" || kind === "audit" || kind === "deferred-review") return isTestSurface(rel);
  return false;
}
