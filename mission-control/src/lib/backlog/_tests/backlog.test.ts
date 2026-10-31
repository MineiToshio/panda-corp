import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readBacklog } from "../backlog";

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
title: Fallo real del motor
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
  it("AC-22-001.1: parses a valid BL-*.md item with all fields", () => {
    writeItem("BL-0001-real.md", VALID_ITEM);
    const { items, errors } = readBacklog();
    expect(errors).toEqual([]);
    expect(items).toHaveLength(1);
    const item = items[0];
    expect(item).toMatchObject({
      id: "BL-0001",
      type: "bug",
      area: "build-engine",
      title: "Fallo real del motor",
      status: "open",
      severity: "p1",
      source: "LESSON-0002",
    });
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

  it("accepts the discarded status (REQ-22-007)", () => {
    writeItem(
      "BL-0005-discarded.md",
      `---
id: BL-0005
type: bug
area: hooks
title: A discarded item
status: discarded
status_before_discard: open
---
body
`,
    );
    const { items, errors } = readBacklog();
    expect(errors).toEqual([]);
    expect(items[0]?.status).toBe("discarded");
  });
});

describe("readBacklog — ordering (REQ-22-008: priority, then id)", () => {
  it("sorts by severity (p0 before p1 before p2 before none), then by id ascending", () => {
    writeItem("BL-0005-b.md", VALID_ITEM.replace("BL-0001", "BL-0005").replace("p1", "p1"));
    writeItem(
      "BL-0002-a.md",
      `---
id: BL-0002
type: bug
area: hooks
title: p0 higher id
status: open
severity: p0
---
body
`,
    );
    writeItem(
      "BL-0010-c.md",
      `---
id: BL-0010
type: bug
area: hooks
title: p0 lower id
status: open
severity: p0
---
body
`,
    );
    writeItem(
      "BL-0001-noseverity.md",
      `---
id: BL-0001
type: change
area: hooks
title: no severity at all
status: open
---
body
`,
    );
    const { items, errors } = readBacklog();
    expect(errors).toEqual([]);
    expect(items.map((i) => i.id)).toEqual(["BL-0002", "BL-0010", "BL-0005", "BL-0001"]);
  });
});

describe("readBacklog — fail-loud on malformed items (DR-078)", () => {
  it("AC-22-004.1: surfaces malformed YAML frontmatter in errors[], does not drop it silently", () => {
    writeItem("BL-0001-real.md", VALID_ITEM);
    writeItem("BL-0009-broken.md", "---\nid: BL-0009\ntype: bug\n  bad: [unclosed\n---\nbody");
    const { items, errors } = readBacklog();
    expect(items.map((i) => i.id)).toEqual(["BL-0001"]);
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

  it("AC-22-004.3: surfaces a duplicate id fail-loud and keeps only the first (BL-0013, DR-078)", () => {
    writeItem("BL-0010-a.md", VALID_ITEM.replace("BL-0001", "BL-0010"));
    writeItem("BL-0010-b.md", VALID_ITEM.replace("BL-0001", "BL-0010"));
    const { items, errors } = readBacklog();
    expect(items.filter((i) => i.id === "BL-0010")).toHaveLength(1);
    const dupError = errors.find((e) => e.reason.includes("duplicate id BL-0010"));
    expect(dupError).toBeDefined();
    expect(dupError?.file).toMatch(/^BL-0010-[ab]\.md$/);
    const first = fs.readdirSync(backlogDir).find((file) => file !== dupError?.file);
    expect(errors).toEqual([
      { file: dupError?.file, reason: `duplicate id BL-0010 (already defined in ${first})` },
    ]);
  });
});

it.each([
  false,
  true,
])("AC-22-008.1: groups priority and history independently (reverse=%s)", (reverse) => {
  const cases: [string, string, string, string][] = [
    ["BL-0011", "doing", "p2", ""],
    ["BL-0010", "doing", "p0", ""],
    ["BL-0013", "open", "p1", ""],
    ["BL-0012", "open", "p1", ""],
    ["BL-0014", "open", "", ""],
    ["BL-0015", "open", "p2", ""],
    ["BL-0016", "done", "p0", "2026-10-01T01:00:00+02:00"],
    ["BL-0017", "discarded", "p2", "2026-10-01T00:00:00Z"],
    ["BL-0018", "done", "p0", ""],
    ["BL-0019", "discarded", "p1", ""],
  ];
  for (const [index, [id, status, severity, closed]] of (reverse
    ? [...cases].reverse()
    : cases
  ).entries()) {
    writeItem(
      `BL-${String(index).padStart(4, "0")}-fixture.md`,
      VALID_ITEM.replace("BL-0001", id)
        .replace("status: open", `status: ${status}`)
        .replace("severity: p1", severity ? `severity: ${severity}` : "")
        .replace("closed:", `closed: '${closed}'`),
    );
  }
  const { items, errors } = readBacklog();
  expect(errors).toEqual([]);
  expect(items.map((item) => item.id)).toEqual([
    "BL-0010",
    "BL-0011",
    "BL-0012",
    "BL-0013",
    "BL-0015",
    "BL-0014",
    "BL-0017",
    "BL-0016",
    ...(reverse ? ["BL-0019", "BL-0018"] : ["BL-0018", "BL-0019"]),
  ]);
});

it.each([
  "",
  VALID_ITEM.replace("area: build-engine", ""),
  VALID_ITEM.replace("status: open", "status: unknown"),
  VALID_ITEM.replace("severity: p1", "severity: p9"),
])("AC-22-004.1: reports malformed file %s", (raw) => {
  writeItem("BL-0001-bad.md", raw);
  expect(readBacklog()).toMatchObject({ items: [], errors: [{ file: "BL-0001-bad.md" }] });
});

it("AC-22-004.1: reports an unreadable item entry", () => {
  fs.mkdirSync(path.join(backlogDir, "BL-0020-unreadable.md"));
  expect(readBacklog()).toEqual({
    items: [],
    errors: [{ file: "BL-0020-unreadable.md", reason: "file could not be read" }],
  });
});

it("AC-22-008.1: preserves time precision for native YAML timestamp history", () => {
  writeItem(
    "BL-0021.md",
    VALID_ITEM.replace("BL-0001", "BL-0021")
      .replace("status: open", "status: done")
      .replace("closed:", "closed: 2026-10-01T01:00:00Z"),
  );
  writeItem(
    "BL-0022.md",
    VALID_ITEM.replace("BL-0001", "BL-0022")
      .replace("status: open", "status: done")
      .replace("closed:", "closed: 2026-10-01T02:00:00Z"),
  );
  expect(readBacklog().items.map((item) => item.id)).toEqual(["BL-0022", "BL-0021"]);
});
