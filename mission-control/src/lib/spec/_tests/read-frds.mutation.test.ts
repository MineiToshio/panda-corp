import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { readPublishedWorkOrders } from "@/lib/work-orders/published";
import { readArtifact, readSpecArtifacts } from "../read-artifacts";
import { readDigestFrds } from "../read-frds";

let root: string;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "digest-mutation-"));
});
afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});
function write(relative: string, content: string) {
  const file = path.join(root, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

it("preserves feature metadata, sorted identity, authored summary and matching live orders", () => {
  write(
    "docs/frds/frd-02-z/frd.md",
    "---\nid: FRD-02\ntitle: Zed\nui: false\n---\n# Ignored title\n",
  );
  write("docs/frds/frd-01-a/frd.md", "---\nui: api\n---\n# Alpha\n");
  write(
    "docs/frds/frd-01-a/blueprint.md",
    "---\nowner: architect\n---\n# Blueprint\n\nowner: hidden\n---\nAuthored summary.\nSecond line.\n",
  );
  write(
    "docs/frds/frd-02-z/work-orders/wo-02-001.md",
    "---\nimplementation_status: VERIFIED\n---\n# Order\n",
  );
  write("docs/frds/notes/frd.md", "# Ignore this folder");
  write("docs/frds/frd-not-directory", "Ignore this file");
  write(".pandacorp/comms/spec-resumen.md", "## FRDs\n### FRD-02 · Zed\nNarrative summary.\n");
  const orders = readPublishedWorkOrders(root).items;
  const result = readDigestFrds(root, orders);
  expect(
    result.map(({ id, title, slug, ui, blueprint, workOrders }) => ({
      id,
      title,
      slug,
      ui,
      blueprint,
      orders: workOrders.map((order) => order.id),
    })),
  ).toEqual([
    {
      id: "FRD-01",
      title: "Alpha",
      slug: "frd-01-a",
      ui: "api",
      blueprint: "Authored summary.",
      orders: [],
    },
    {
      id: "FRD-02",
      title: "Zed",
      slug: "frd-02-z",
      ui: false,
      blueprint: "",
      orders: ["WO-02-001"],
    },
  ]);
  expect(result[1]?.detail?.summary).toBe("Narrative summary.");
});

it("uses folder identity for missing or invalid metadata and never fabricates blueprint prose", () => {
  write("docs/frds/frd-03-empty/frd.md", "---\nid: 3\ntitle: 12\nui: 12\n---\n");
  write("docs/frds/frd-03-empty/blueprint.md", "# Heading\n\n---\n");
  expect(readDigestFrds(root, [])).toEqual([
    {
      id: "FRD-03",
      title: "frd-03-empty",
      slug: "frd-03-empty",
      ui: undefined,
      detail: undefined,
      blueprint: "",
      workOrders: [],
    },
  ]);
});

it("keeps missing input deliberately empty and makes malformed feature input explicit", () => {
  expect(readDigestFrds(root, [])).toEqual([]);
  write("docs/frds/frd-01-broken/frd.md", "---\ntitle: [\n---\n");
  const result = readSpecArtifacts(root);
  expect(result.frds).toEqual([]);
  expect(result.sourceErrors.frds).toBeTruthy();
  expect(result.sourceErrors.workOrders).toBeUndefined();
});

it("retains error identity for both Error and non-Error failures", () => {
  expect(readArtifact(() => 7, 0)).toEqual({ value: 7 });
  expect(
    readArtifact(() => {
      throw new Error("source failed");
    }, 0),
  ).toEqual({ value: 0, error: "source failed" });
  expect(
    readArtifact(() => {
      throw "non-error failure";
    }, 0),
  ).toEqual({ value: 0, error: "non-error failure" });
});

it("reports source-directory failure with empty fallback collections and both band errors", () => {
  write("docs/frds", "not a directory");
  const result = readSpecArtifacts(root);
  expect(result.workOrders).toEqual([]);
  expect(result.frds).toEqual([]);
  expect(result.sourceErrors.workOrderFiles).toEqual([]);
  expect(result.sourceErrors.workOrders).toContain("directory could not be listed");
  expect(result.sourceErrors.frds).toContain("ENOTDIR");
});

it("joins every malformed work-order file into an explicit source message", () => {
  write("docs/frds/frd-01-example/frd.md", "# Feature\n");
  write("docs/frds/frd-01-example/work-orders/wo-01-001.md", "");
  write(
    "docs/frds/frd-01-example/work-orders/wo-01-002.md",
    "---\nimplementation_status: INVALID\n---\n# Invalid\n",
  );
  expect(readSpecArtifacts(root).sourceErrors.workOrders).toBe(
    "docs/frds/frd-01-example/work-orders/wo-01-001.md: file is empty; docs/frds/frd-01-example/work-orders/wo-01-002.md: invalid implementation_status",
  );
});
