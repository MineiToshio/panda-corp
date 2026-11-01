import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { documentBody } from "../documentBody";

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "document-body-"));
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("documentBody executable frontmatter boundary", () => {
  it.each(["js", "javascript", "JS", "coffee"])("never evaluates a ---%s document", (engine) => {
    const proof = path.join(dir, "executed");
    const source = `---${engine}\n(function(){require("node:fs").writeFileSync(${JSON.stringify(proof)},"x");return {};})()\n---\n# Body\n`;
    const result = documentBody(source);
    expect(result.ok).toBe(false);
    expect(fs.existsSync(proof)).toBe(false);
  });
});
