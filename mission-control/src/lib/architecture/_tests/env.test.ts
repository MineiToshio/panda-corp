/**
 * env.ts — reader tests. Parses `.env.example` into {name, comment}; an absent file is the
 * legitimate "no env vars" state (→ []), never a crash (DR-078 boundary).
 */

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readEnvExample } from "../env";

const dirs: string[] = [];
function tmpProject(): string {
  const dir = mkdtempSync(join(tmpdir(), "env-reader-"));
  dirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

const REAL = `# Public site URL — used for metadataBase and OG URLs.
# No trailing slash.
NEXT_PUBLIC_SITE_URL=https://toshiominei.com

# Web3Forms public access key — safe to ship to the client.
NEXT_PUBLIC_WEB3FORMS_KEY=

NEXT_PUBLIC_POSTHOG_KEY=
`;

describe("readEnvExample", () => {
  it("returns [] when there is no .env.example (absent ≠ crash)", () => {
    expect(readEnvExample(tmpProject())).toEqual([]);
  });

  it("parses names with their leading comment, and a var without comment", () => {
    const project = tmpProject();
    writeFileSync(join(project, ".env.example"), REAL);
    const vars = readEnvExample(project);
    expect(vars.map((v) => v.name)).toEqual([
      "NEXT_PUBLIC_SITE_URL",
      "NEXT_PUBLIC_WEB3FORMS_KEY",
      "NEXT_PUBLIC_POSTHOG_KEY",
    ]);
    expect(vars[0]?.comment).toContain("Public site URL");
    expect(vars[0]?.comment).toContain("No trailing slash");
    expect(vars[1]?.comment).toContain("Web3Forms");
    // A blank line separated this var from any preceding comment.
    expect(vars[2]?.comment).toBe("");
  });

  it("ignores blank-line-detached comments and never throws on odd content", () => {
    const project = tmpProject();
    writeFileSync(join(project, ".env.example"), "# orphan comment\n\nlowercase=ignored\nA_B=ok\n");
    const vars = readEnvExample(project);
    // `lowercase` does not match the NAME pattern (must start uppercase); A_B does.
    expect(vars.map((v) => v.name)).toEqual(["A_B"]);
    expect(vars[0]?.comment).toBe("");
  });
});
