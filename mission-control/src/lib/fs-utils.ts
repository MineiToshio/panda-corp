import fs from "node:fs";

/**
 * Read-only filesystem utilities for Mission Control's data layer (FRD-01).
 *
 * Platform golden rule (architecture §1): read-only, never call Claude.
 * Every function here is `fs.read*` or existence-check only — no writes, no egress.
 *
 * Traceability: IF-01-pathExists → REQ-01-010 → AC-01-010.1
 */

/**
 * Synchronous read-only existence probe.
 *
 * Returns `true` when `p` names an existing file or directory on the filesystem.
 * Returns `false` for any absent path **and** for any error (permission denied,
 * null bytes in the path, empty string, etc.) — it never throws.
 *
 * Callers (readStatus, readProjectDocs, FRD-03 not-found badge) use this to mark
 * a project as not-found without breaking the rest of the view (AC-01-010.1).
 *
 * Implementation note: `fs.existsSync` itself may throw on malformed paths
 * (e.g. paths containing null bytes → EINVAL). The try/catch ensures the
 * "never throws" contract is honored unconditionally.
 *
 * Synchronous by design: safe to call from Next.js Server Components without
 * `await`, matching the data layer's synchronous reader pattern.
 */
export function pathExists(p: string): boolean {
  if (!p || p.trim() === "") {
    return false;
  }
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}
