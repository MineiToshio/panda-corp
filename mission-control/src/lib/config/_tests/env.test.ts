import { readFileSync } from "node:fs";
import { afterEach, expect, it, vi } from "vitest";
import { ENV, resolveHomeDir } from "../env";

afterEach(() => vi.unstubAllEnvs());
it("REQ-01-011: every contract variable is documented once with its own comment", () => {
  const lines = readFileSync(".env.example", "utf8").split("\n");
  for (const name of Object.values(ENV)) {
    const matches = lines.flatMap((line, index) => (line.startsWith(`# ${name}=`) ? [index] : []));
    expect(matches).toHaveLength(1);
    expect(lines[(matches[0] ?? 0) - 1]).toMatch(/^# [^#]/);
  }
  vi.stubEnv("HOME", "/fixture/home");
  vi.stubEnv("USERPROFILE", "/fixture/windows");
  expect(resolveHomeDir()).toBe("/fixture/home");
  vi.stubEnv("HOME", undefined);
  expect(resolveHomeDir()).toBe("/fixture/windows");
  vi.stubEnv("USERPROFILE", undefined);
  expect(resolveHomeDir).toThrow();
});
