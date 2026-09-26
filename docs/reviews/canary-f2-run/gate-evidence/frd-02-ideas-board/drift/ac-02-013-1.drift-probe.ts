import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { readArchitectureDigest } from "@/lib/architecture/read-architecture";

/**
 * AC-02-013.1 declares the architecture-digest reader fail-loud (DR-078): only a MISSING digest is
 * the deliberate absent state. A digest that is PRESENT but cannot be read is an IO failure and
 * must surface (throw or a non-null error value) instead of masquerading as "not at the
 * architecture phase yet" (null -> the Arquitectura tab silently disappears).
 */
describe("AC-02-013.1 drift · architecture digest reader fail-loud", () => {
  let root: string | undefined;

  afterEach(() => {
    if (root) rmSync(root, { recursive: true, force: true });
  });

  it("does not report a present-but-unreadable digest as the absent state", () => {
    root = mkdtempSync(join(tmpdir(), "drift-ac-02-013-1-"));
    // The digest path exists but is a directory: readFileSync throws EISDIR (an IO failure).
    mkdirSync(join(root, ".pandacorp", "comms", "arquitectura-resumen.md"), { recursive: true });

    let outcome: unknown;
    try {
      outcome = readArchitectureDigest(root);
    } catch (error) {
      outcome = error;
    }
    expect(outcome, "unreadable digest collapsed into the absent-state null").not.toBeNull();
  });
});
