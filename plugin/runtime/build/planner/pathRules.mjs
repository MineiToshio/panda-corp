// Planner path rules (BUILD-9, D30): literal-prefix glob overlap, barrier paths and AC id extraction.
import { normGlob, uniq } from "./common.mjs";

// Barrier paths are constants (D30): schema, migrations, the package manifest and lockfiles.
const BARRIER_RES = Object.freeze([
  /(^|\/)prisma\//, /\.(sql|prisma)$/i, /(^|\/)migrations?\//, /(^|\/)drizzle\//,
  /(^|\/)package\.json$/, /(^|\/)(pnpm-lock\.yaml|package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|bun\.lockb?)$/,
]);
const AC_RE = /\bAC-\d+-\d+\.\d+\b/gi;

/**
 * The literal prefix of a glob: everything before the first wildcard (`*`, `?`, `[`, `{`).
 * @param {string} glob
 * @returns {string}
 */
export function literalPrefix(glob) {
  const g = normGlob(glob);
  const i = g.search(/[*?[{]/);
  return i < 0 ? g : g.slice(0, i);
}

/** Conservative overlap of two globs: one literal prefix is a prefix of the other. */
export const globsOverlap = (a, b) => {
  const pa = literalPrefix(a);
  const pb = literalPrefix(b);
  return pa.startsWith(pb) || pb.startsWith(pa);
};

/**
 * Do two `artifacts` lists overlap? `null` means unknown (legacy WO without `artifacts`) and overlaps everything.
 * @param {string[]|null} a
 * @param {string[]|null} b
 */
export const artifactsOverlap = (a, b) => a === null || b === null || a.some((x) => b.some((y) => globsOverlap(x, y)));

/** Is this path/glob one of the constant barrier paths (schema, migrations, package manifest, lockfiles)? */
export const isBarrierPath = (p) => BARRIER_RES.some((re) => re.test(normGlob(p)));

/** Normalized (upper-case, unique) AC ids (`AC-NN-MMM.K`) found in a text. */
export const extractAcIds = (text) => uniq([...String(text ?? "").matchAll(AC_RE)].map((m) => m[0].toUpperCase()));
