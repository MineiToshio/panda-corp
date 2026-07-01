import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readBacklog } from "../backlog";

/**
 * backlog.ts reader tests (FRD-22, DR-078 fail-loud boundary).
 *
 * Each test builds a real factory root in a temp dir, points
 * PANDACORP_FACTORY_ROOT at it, and exercises readBacklog() against real and
 * malformed fixtures — the malformed one MUST surface in errors[], not vanish.
 */

let tmpRoot: string;
let backlogDir: string;
const prevEnv = process.env.PANDACORP_FACTORY_ROOT;

function writeItem(filename: string, body: string): void {
  fs.writeFileSync(path.join(backlogDir, filename), body, "utf-8");
}

const VALID_ITEM = `---
id: BL-0001
type: bug
area: build-engine
title: A real closeable defect
status: open
severity: p1
opened: 2026-06-30
closed:
source: LESSON-0002
closes:
links: [LESSON-0002, DR-073]
---
**Problem:** something is wrong.
`;

beforeEach(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mc-backlog-"));
  backlogDir = path.join(tmpRoot, "factory", "backlog");
  fs.mkdirSync(backlogDir, { recursive: true });
  process.env.PANDACORP_FACTORY_ROOT = tmpRoot;
});

afterEach(() => {
  if (prevEnv === undefined) delete process.env.PANDACORP_FACTORY_ROOT;
  else process.env.PANDACORP_FACTORY_ROOT = prevEnv;
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe("readBacklog — real fixtures", () => {
  it("parses a valid BL-*.md item with all fields", () => {
    writeItem("BL-0001-real.md", VALID_ITEM);
    const { items, errors } = readBacklog();
    expect(errors).toEqual([]);
    expect(items).toHaveLength(1);
    const item = items[0];
    expect(item).toMatchObject({
      id: "BL-0001",
      type: "bug",
      area: "build-engine",
      title: "A real closeable defect",
      status: "open",
      severity: "p1",
      source: "LESSON-0002",
    });
    // opened is coerced from a YAML date to an ISO string
    expect(item?.opened).toBe("2026-06-30");
    expect(item?.closed).toBeNull();
    expect(item?.links).toEqual(["LESSON-0002", "DR-073"]);
  });

  it("skips README.md and _item-template.md", () => {
    writeItem("BL-0001-real.md", VALID_ITEM);
    writeItem("README.md", "# not an item");
    writeItem("_item-template.md", "---\nid: BL-NNNN\n---\n");
    const { items, errors } = readBacklog();
    expect(errors).toEqual([]);
    expect(items.map((i) => i.id)).toEqual(["BL-0001"]);
  });

  it("defaults severity to null and closed to null when absent", () => {
    writeItem(
      "BL-0002-change.md",
      `---
id: BL-0002
type: change
area: plugin-skill
title: An adjustment with no severity
status: doing
---
body
`,
    );
    const { items, errors } = readBacklog();
    expect(errors).toEqual([]);
    expect(items[0]?.severity).toBeNull();
    expect(items[0]?.closed).toBeNull();
    expect(items[0]?.status).toBe("doing");
  });

  it("returns an empty (not errored) result when the backlog dir is absent", () => {
    fs.rmSync(backlogDir, { recursive: true, force: true });
    const { items, errors } = readBacklog();
    expect(items).toEqual([]);
    expect(errors).toEqual([]);
  });
});

describe("readBacklog — fail-loud on malformed items (DR-078)", () => {
  it("surfaces malformed YAML frontmatter in errors[], does not drop it silently", () => {
    writeItem("BL-0001-real.md", VALID_ITEM);
    writeItem("BL-0009-broken.md", "---\nid: BL-0009\ntype: bug\n  bad: [unclosed\n---\nbody");
    const { items, errors } = readBacklog();
    // The valid item still parses...
    expect(items.map((i) => i.id)).toEqual(["BL-0001"]);
    // ...and the broken one is surfaced, never silently vanished.
    expect(errors).toHaveLength(1);
    expect(errors[0]?.file).toBe("BL-0009-broken.md");
    expect(errors[0]?.reason).toMatch(/malformed/i);
  });

  it("surfaces a missing required field (status) as an error", () => {
    writeItem(
      "BL-0003-nostatus.md",
      `---
id: BL-0003
type: bug
area: hooks
title: Missing status
---
body
`,
    );
    const { items, errors } = readBacklog();
    expect(items).toEqual([]);
    expect(errors).toHaveLength(1);
    expect(errors[0]?.reason).toMatch(/status/i);
  });

  it("surfaces an out-of-range enum (type) as an error", () => {
    writeItem(
      "BL-0004-badtype.md",
      `---
id: BL-0004
type: feature
area: templates
title: Invalid type
status: open
---
body
`,
    );
    const { items, errors } = readBacklog();
    expect(items).toEqual([]);
    expect(errors[0]?.reason).toMatch(/type/i);
  });

  it("surfaces a duplicate id fail-loud and keeps only the first (BL-0013, DR-078)", () => {
    // Two different files claiming the same id is a data-integrity defect: the second
    // must NOT produce a second item (which would render duplicate React keys) — it is
    // reported in errors[], naming the file that first defined the id.
    writeItem("BL-0010-a.md", VALID_ITEM.replace("BL-0001", "BL-0010"));
    writeItem("BL-0010-b.md", VALID_ITEM.replace("BL-0001", "BL-0010"));
    const { items, errors } = readBacklog();
    // Exactly one item with that id (unique keys guaranteed for the UI).
    expect(items.filter((i) => i.id === "BL-0010")).toHaveLength(1);
    // The other file is surfaced fail-loud, naming the file that first defined the id
    // (order-independent: whichever readdir yields second is the reported duplicate).
    const dupError = errors.find((e) => e.reason.includes("duplicate id BL-0010"));
    expect(dupError).toBeDefined();
    expect(dupError?.file).toMatch(/^BL-0010-[ab]\.md$/);
    expect(dupError?.reason).toMatch(/already defined in BL-0010-[ab]\.md/);
  });
});
