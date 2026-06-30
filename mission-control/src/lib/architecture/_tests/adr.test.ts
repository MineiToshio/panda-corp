/**
 * adr.ts — reader tests. Reads docs/adr/*.md into {id, title, decision, body}; an absent dir is
 * the legitimate "no ADRs" state (→ []), never a crash (DR-078 boundary).
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readAdrs } from "../adr";

const dirs: string[] = [];
function tmpProject(): string {
  const dir = mkdtempSync(join(tmpdir(), "adr-reader-"));
  dirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function writeAdr(project: string, file: string, body: string): void {
  const dir = join(project, "docs", "adr");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, file), body);
}

const ADR_0001 = `---
id: ADR-0001
title: Approved stack — Next.js App Router static portfolio
status: ACCEPTED
---

# ADR-0001 — Approved stack: Next.js App Router static portfolio

## Context

Some context paragraph.

## Decision

Adopt golden path A at the latest stable versions on Vercel Hobby.

More detail in a second paragraph.
`;

describe("readAdrs", () => {
  it("returns [] when there is no docs/adr dir (absent ≠ crash)", () => {
    expect(readAdrs(tmpProject())).toEqual([]);
  });

  it("reads id, title, the first Decision paragraph, and the full body", () => {
    const project = tmpProject();
    writeAdr(project, "adr-0001-approved-stack.md", ADR_0001);
    const adrs = readAdrs(project);
    expect(adrs).toHaveLength(1);
    const adr = adrs[0];
    expect(adr?.id).toBe("ADR-0001");
    expect(adr?.title).toBe("Approved stack — Next.js App Router static portfolio");
    expect(adr?.decision).toBe(
      "Adopt golden path A at the latest stable versions on Vercel Hobby.",
    );
    expect(adr?.body).toContain("## Context");
  });

  it("sorts ADRs by filename and derives id/title when frontmatter is absent", () => {
    const project = tmpProject();
    writeAdr(
      project,
      "adr-0002-no-db.md",
      "# ADR-0002 — No database\n\n## Decision\n\nContent as code.\n",
    );
    writeAdr(project, "adr-0001-stack.md", "# ADR-0001 — Stack\n\n## Decision\n\nNext.js.\n");
    const adrs = readAdrs(project);
    expect(adrs.map((a) => a.id)).toEqual(["ADR-0001", "ADR-0002"]);
    expect(adrs[1]?.title).toBe("No database");
    expect(adrs[1]?.decision).toBe("Content as code.");
  });
});
