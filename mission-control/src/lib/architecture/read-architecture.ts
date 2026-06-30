/**
 * read-architecture.ts — server-only reader for a project's Spanish architecture digest.
 *
 * Kept SEPARATE from architecture.ts (the pure parser) so the client ArchitectureDigest can import
 * the parser without pulling `node:fs` into the browser bundle — same split as read-spec.ts/spec.ts.
 * Imported only by the board Server Component (page.tsx).
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Read a project's Spanish architecture digest (`.pandacorp/comms/arquitectura-resumen.md`), or
 * null when absent.
 *
 * Fail-loud boundary (DR-078): a missing file is a deliberate "not at the architecture phase yet"
 * state (→ null → the Arquitectura tab is hidden), NOT a parse failure. A present-but-unreadable
 * file (permissions/IO) also degrades to null rather than crashing the board.
 */
export function readArchitectureDigest(projectPath: string): string | null {
  const path = join(projectPath, ".pandacorp", "comms", "arquitectura-resumen.md");
  if (!existsSync(path)) return null;
  try {
    const raw = readFileSync(path, "utf-8");
    return raw.trim().length > 0 ? raw : null;
  } catch {
    return null;
  }
}
