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

it("AC-02-016.8: separates section headers, per-variable comments and optional declarations without retaining values", () => {
  const project = tmpProject();
  writeFileSync(
    join(project, ".env.example"),
    "# --- Database ---\n# Database URL\nDATABASE_URL=secret\nPASSWORD=secret\n\n# Analytics\n\n# Optional key\n# ANALYTICS_KEY=secret\n",
  );
  expect(readEnvExample(project)).toEqual([
    { name: "DATABASE_URL", comment: "Database URL", section: "Database", described: true },
    { name: "PASSWORD", comment: "", section: "Database", described: false },
    { name: "ANALYTICS_KEY", comment: "Optional key", section: "Analytics", described: true },
  ]);
  writeFileSync(join(project, ".env.example"), "not a declaration");
  expect(() => readEnvExample(project)).toThrow(/invalid variable declaration/);
});

it.each([
  {
    project: "pandatrack",
    header:
      "# -----------------------------------------------------------------------------\n# Database\n# -----------------------------------------------------------------------------",
    section: "Database",
    comment: "Postgres connection string (e.g. Neon, local). Required for Prisma and app data.",
  },
  {
    project: "funko-tracker",
    header: "# --- Database (Neon DEV for all local development; Docker is forbidden) ---",
    section: "Database (Neon DEV for all local development; Docker is forbidden)",
    comment:
      "Pooled runtime connection: Neon DEV in .env.local, Neon production in .env.production; tests use explicit native Homebrew fixtures.",
  },
])("AC-02-016.8: preserves the $project .env.example section shape", ({
  header,
  section,
  comment,
}) => {
  const project = tmpProject();
  writeFileSync(join(project, ".env.example"), `${header}\n# ${comment}\nDATABASE_URL=\n`);
  expect(readEnvExample(project)).toEqual([
    { name: "DATABASE_URL", comment, section, described: true },
  ]);
});
