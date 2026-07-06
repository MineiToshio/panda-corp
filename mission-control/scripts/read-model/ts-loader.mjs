/**
 * scripts/read-model/ts-loader.mjs — a zero-dependency Node ESM resolve hook for the read-model CLIs.
 *
 * The read-model CLIs (`sync-aggregate`, `backfill`, `regen`) run the project's TypeScript directly
 * (Node's native type-stripping, Node ≥ 23), but the source uses two conventions plain Node ESM
 * does not resolve on its own:
 *   1. the `@/*` → `./src/*` alias (from `tsconfig.json`);
 *   2. extensionless relative imports (`./seal` → `./seal.ts`), the bundler convention.
 * This loader teaches Node's resolver both — no `tsx`/`ts-node`/`jiti` dependency (DR-052), pure
 * `node:*`. Registered with `node --loader ./scripts/read-model/ts-loader.mjs <cli>`.
 *
 * Scope: it ONLY rewrites bare `@/…` and extensionless relative specifiers to a concrete `.ts`/`.tsx`
 * file when one exists; everything else (node builtins, `react`, `.json`, already-extensioned paths)
 * is passed straight through to the default resolver.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/** `./src`, resolved from the process working directory (the CLIs `cd` into the repo root). */
const SRC_DIR = path.resolve(process.cwd(), "src");

/** Candidate on-disk files for a resolved base path (extensionless → `.ts`/`.tsx`/`/index.ts`). */
function firstExistingFile(basePath) {
  const candidates = [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    path.join(basePath, "index.ts"),
    path.join(basePath, "index.tsx"),
  ];
  for (const candidate of candidates) {
    try {
      if (fs.statSync(candidate).isFile()) return candidate;
    } catch {
      // Not this candidate — try the next.
    }
  }
  return null;
}

/** True when the specifier already carries a resolvable extension (leave it to the default resolver). */
function hasKnownExtension(specifier) {
  return /\.(ts|tsx|js|jsx|mjs|cjs|json|node)$/.test(specifier);
}

export async function resolve(specifier, context, nextResolve) {
  let base = null;

  if (specifier.startsWith("@/")) {
    base = path.join(SRC_DIR, specifier.slice(2));
  } else if (
    (specifier.startsWith("./") || specifier.startsWith("../")) &&
    context.parentURL &&
    context.parentURL.startsWith("file:") &&
    !hasKnownExtension(specifier)
  ) {
    base = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier);
  }

  if (base) {
    const resolved = firstExistingFile(base);
    if (resolved) {
      return nextResolve(pathToFileURL(resolved).href, context);
    }
  }

  return nextResolve(specifier, context);
}
