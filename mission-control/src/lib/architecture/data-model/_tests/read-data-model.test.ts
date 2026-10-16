import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readDataModel } from "../read-data-model";

const projects: string[] = [];
function fixture(content?: string | Uint8Array): string {
  const project = mkdtempSync(join(tmpdir(), "data-model-"));
  projects.push(project);
  mkdirSync(join(project, "docs", "product"), { recursive: true });
  if (content !== undefined)
    writeFileSync(join(project, "docs", "product", "data-model.json"), content);
  return project;
}

afterEach(() => {
  for (const project of projects.splice(0)) rmSync(project, { recursive: true, force: true });
});

describe("readDataModel", () => {
  it("reports a missing canonical file explicitly", () => {
    expect(readDataModel(fixture())).toEqual({ kind: "missing" });
  });

  it("reads the canonical JSON source", () => {
    const raw = { schemaVersion: 1, persistence: "relational", entities: [], relationships: [] };
    expect(readDataModel(fixture(JSON.stringify(raw)))).toEqual({
      kind: "ready",
      model: raw,
      source: "docs/product/data-model.json",
    });
  });

  it.each([
    "",
    "{ invalid json",
    "null",
    "{}",
  ])("distinguishes malformed JSON from missing: %j", (raw) => {
    expect(readDataModel(fixture(raw)).kind).toBe("error");
  });

  it("rejects input over the byte cap", () => {
    expect(readDataModel(fixture(" ".repeat(1024 * 1024 + 1)))).toEqual({
      kind: "error",
      message: "Data model exceeds the 1 MiB size limit.",
    });
  });

  it("accepts valid JSON at exactly the byte limit", () => {
    const json = JSON.stringify({
      schemaVersion: 1,
      persistence: "none",
      entities: [],
      relationships: [],
    });
    expect(readDataModel(fixture(json.padEnd(1024 * 1024)))).toEqual({ kind: "none" });
  });

  it("rejects invalid UTF-8 instead of replacing bytes silently", () => {
    expect(readDataModel(fixture(Uint8Array.from([0xff, 0xfe])))).toEqual({
      kind: "error",
      message: "Data model is not valid UTF-8 JSON.",
    });
  });

  it("treats a directory at the artifact path as an IO error without exposing absolute paths", () => {
    const project = fixture();
    mkdirSync(join(project, "docs", "product", "data-model.json"));
    const result = readDataModel(project);
    expect(result.kind).toBe("error");
    expect(JSON.stringify(result)).not.toContain(project);
  });
});
