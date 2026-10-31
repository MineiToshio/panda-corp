import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Reviewer-authored (DR-080): a parenthesised or late "use client" passes tsc, Biome and Vitest, yet
// `next` refuses to compile the file and takes down every route. WO-13-013 shipped exactly that.
const SRC_ROOT = path.resolve(__dirname, "../..");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return entry === "_tests" ? [] : sourceFiles(full);
    return /\.tsx?$/.test(entry) ? [full] : [];
  });
}

function withoutLeadingComments(source: string): string {
  return source.replace(/^(?:\s+|\/\*[\s\S]*?\*\/|\/\/[^\n]*\n)+/, "");
}

describe("the client directive", () => {
  const files = sourceFiles(SRC_ROOT).map((file) => ({
    name: path.relative(SRC_ROOT, file),
    source: readFileSync(file, "utf8"),
  }));

  it("sees the production tree", () => {
    expect(files.length).toBeGreaterThan(300);
    expect(files.filter(({ source }) => source.includes('"use client"')).length).toBeGreaterThan(
      20,
    );
  });

  it("is never a parenthesised expression", () => {
    const offenders = files.filter(({ source }) => /^\s*\("use (client|server)"\);?/m.test(source));
    expect(offenders.map(({ name }) => name)).toEqual([]);
  });

  it("is the first statement of every file that declares it", () => {
    const offenders = files.filter(
      ({ source }) =>
        /^"use client";?$/m.test(source) &&
        !withoutLeadingComments(source).startsWith('"use client"'),
    );
    expect(offenders.map(({ name }) => name)).toEqual([]);
  });
});
