import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { performanceJournalPath, readPerformance } from "../performance";
import type { BuildSourceError } from "../types";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

it("pins the e2e host journal to the fixture's designed missing-history state", () => {
  const env = JSON.parse(fs.readFileSync("e2e/server-env.json", "utf8")) as {
    PANDACORP_FACTORY_ROOT: string;
    PANDACORP_HOST_DIR: string;
  };
  const factory = path.resolve(env.PANDACORP_FACTORY_ROOT);
  const host = path.resolve(env.PANDACORP_HOST_DIR);
  expect(path.relative(factory, host)).toBe("host");
  vi.stubEnv("PANDACORP_HOST_DIR", host);
  const home = vi.spyOn(os, "homedir");
  const file = performanceJournalPath();
  expect(file).toBe(path.join(host, "perf/journal.jsonl"));
  const errors: BuildSourceError[] = [];
  expect(readPerformance(path.join(factory, "mission-control"), file, errors)).toEqual([]);
  expect(errors).toEqual([]);
  expect(home).not.toHaveBeenCalled();
});
