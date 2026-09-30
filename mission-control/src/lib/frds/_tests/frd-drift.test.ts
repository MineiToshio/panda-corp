/**
 * frd-drift reader (FRD-12 AC-12-003.3, DR-078, DR-122): the `drift:` frontmatter list the build
 * engine's certifying landing writes into `docs/frds/<frd>/frd.md`. Absent = no drift; anything that
 * is not a list of REQ/AC ids is a loud, typed error and never a silent `[]`.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseFrdDrift, readFrdDrift } from "../frd-drift";

const FIXTURES = path.join(__dirname, "fixtures");
const fixture = (name: string): string => fs.readFileSync(path.join(FIXTURES, name), "utf-8");

function frdWith(frontmatterLine: string): string {
  return `---\nid: FRD-09\nimplementation_status: VERIFIED\n${frontmatterLine}\n---\n# FRD-09\n`;
}

describe("parseFrdDrift: real production-shaped FRDs", () => {
  it("reads the engine-written flow list, keeping order and every id", () => {
    expect(parseFrdDrift(fixture("frd-with-drift.md"))).toEqual({
      ok: true,
      ids: ["AC-02-010.4", "REQ-03-001", "AC-02-010.8"],
    });
  });

  it("an absent `drift:` key is an explicit, honest 'no drift' (ok with no ids)", () => {
    expect(parseFrdDrift(fixture("frd-without-drift.md"))).toEqual({ ok: true, ids: [] });
  });

  it("an empty list is also 'no drift'", () => {
    expect(parseFrdDrift(frdWith("drift: []"))).toEqual({ ok: true, ids: [] });
  });
});

describe("parseFrdDrift: malformed values fail loud (DR-078), never a silent empty list", () => {
  const cases: readonly { readonly label: string; readonly line: string }[] = [
    { label: "a bare string instead of a list", line: "drift: AC-02-010.4" },
    { label: "a number", line: "drift: 3" },
    { label: "a mapping", line: "drift: {a: 1}" },
    { label: "a null value", line: "drift:" },
    { label: "a list with a non-id entry", line: "drift: [AC-02-010.4, nope]" },
    { label: "a list with a non-string entry", line: "drift: [42]" },
    { label: "an id missing its sequence number", line: "drift: [AC-02]" },
    { label: "a lowercase id", line: "drift: [ac-02-010-4]" },
  ];

  for (const { label, line } of cases) {
    it(`rejects ${label}`, () => {
      const result = parseFrdDrift(frdWith(line));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe("malformed");
    });
  }

  it("rejects frontmatter that is not valid YAML", () => {
    const result = parseFrdDrift("---\ndrift: [AC-02-010.4\n: : :\n---\n# x\n");
    expect(result).toMatchObject({ ok: false, reason: "malformed" });
  });

  it("the malformed result carries a human-readable detail naming the problem", () => {
    expect(parseFrdDrift(frdWith("drift: [AC-02-010.4, nope]"))).toMatchObject({
      ok: false,
      detail: expect.stringContaining("nope"),
    });
  });

  it("does not poison later parses (gray-matter cache trap): a bad parse then a good one", () => {
    expect(parseFrdDrift(frdWith("drift: nope")).ok).toBe(false);
    expect(parseFrdDrift(frdWith("drift: [AC-01-001]"))).toEqual({ ok: true, ids: ["AC-01-001"] });
  });
});

describe("readFrdDrift: one resolver over docs/frds/<frd>/frd.md", () => {
  let project: string;

  beforeEach(() => {
    project = fs.mkdtempSync(path.join(os.tmpdir(), "frd-drift-"));
  });

  afterEach(() => {
    fs.rmSync(project, { recursive: true, force: true });
  });

  function writeFrd(frd: string, content: string): void {
    const dir = path.join(project, "docs", "frds", frd);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "frd.md"), content);
  }

  it("reads the FRD file of the given folder id", () => {
    writeFrd("frd-02-ideas-board", fixture("frd-with-drift.md"));
    expect(readFrdDrift(project, "frd-02-ideas-board")).toEqual({
      ok: true,
      ids: ["AC-02-010.4", "REQ-03-001", "AC-02-010.8"],
    });
  });

  it("a FRD folder without frd.md is 'missing', distinct from 'no drift'", () => {
    fs.mkdirSync(path.join(project, "docs", "frds", "frd-05-work-orders"), { recursive: true });
    expect(readFrdDrift(project, "frd-05-work-orders")).toEqual({ ok: false, reason: "missing" });
  });

  it("an unreadable frd.md is an explicit 'unreadable', never a silent empty", () => {
    const dir = path.join(project, "docs", "frds", "frd-06-party");
    fs.mkdirSync(path.join(dir, "frd.md"), { recursive: true }); // a directory where a file is expected
    const result = readFrdDrift(project, "frd-06-party");
    expect(result).toMatchObject({ ok: false, reason: "unreadable" });
  });

  it("propagates a malformed list as a typed error", () => {
    writeFrd("frd-07-configuration", frdWith("drift: nope"));
    expect(readFrdDrift(project, "frd-07-configuration")).toMatchObject({
      ok: false,
      reason: "malformed",
    });
  });

  it("refuses an FRD id that is not a folder slug (no path traversal)", () => {
    expect(readFrdDrift(project, "../secrets")).toMatchObject({ ok: false, reason: "missing" });
  });
});
