import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { readSpecDigest } from "@/lib/spec/read-spec";

/**
 * AC-02-011.1 declares the spec-digest reader fail-loud (DR-078): only a MISSING digest is the
 * deliberate absent state. A digest that is PRESENT but cannot be read is an IO failure and must
 * surface (throw or a non-null error value) instead of masquerading as "no spec yet"
 * (null -> the Spec tab silently disappears).
 */
describe("AC-02-011.1 drift · spec digest reader fail-loud", () => {
  let root: string | undefined;

  afterEach(() => {
    if (root) rmSync(root, { recursive: true, force: true });
  });

  it("does not report a present-but-unreadable digest as the absent state", () => {
    root = mkdtempSync(join(tmpdir(), "drift-ac-02-011-1-"));
    // The digest path exists but is a directory: readFileSync throws EISDIR (an IO failure).
    mkdirSync(join(root, ".pandacorp", "comms", "spec-resumen.md"), { recursive: true });

    let outcome: unknown;
    try {
      outcome = readSpecDigest(root);
    } catch (error) {
      outcome = error;
    }
    expect(outcome, "unreadable digest collapsed into the absent-state null").not.toBeNull();
  });
});
