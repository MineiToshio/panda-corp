import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { readBuildSchema } from "../schema-source";
import type { BuildSourceError } from "../types";

const roots: string[] = [];
afterEach(() => {
  vi.unstubAllEnvs();
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true });
});

it.each([
  "file",
  "parent directory",
])("rejects an escaping schema symlink through its %s before using a cached schema", (kind) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mc-schema-containment-"));
  roots.push(root);
  const factory = path.join(root, "factory");
  const schemaDir = "plugin/runtime/build/schemas";
  const dir = path.join(factory, schemaDir);
  const file = path.join(dir, "state.schema.json");
  const external = path.join(root, "factory-external");
  fs.mkdirSync(dir, { recursive: true });
  fs.mkdirSync(external);
  fs.copyFileSync(path.resolve(process.cwd(), "..", schemaDir, "state.schema.json"), file);
  fs.copyFileSync(file, path.join(external, "state.schema.json"));
  vi.stubEnv("PANDACORP_FACTORY_ROOT", factory);
  const errors: BuildSourceError[] = [];
  expect(readBuildSchema("state", errors)).not.toBeNull();
  if (kind === "file") {
    fs.unlinkSync(file);
    fs.symlinkSync(path.join(external, "state.schema.json"), file);
  } else {
    fs.renameSync(dir, `${dir}-original`);
    fs.symlinkSync(external, dir, "dir");
  }
  expect(readBuildSchema("state", errors)).toBeNull();
  expect(errors).toEqual([{ path: file, reason: expect.any(String) }]);
});
