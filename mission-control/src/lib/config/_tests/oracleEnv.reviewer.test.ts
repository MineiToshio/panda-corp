import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { ENV } from "../env";
import { oracleEnv } from "../oracleEnv";

/** Reviewer-authored (DR-080): the recipe against the real fixture tree of this checkout. */
afterEach(() => vi.unstubAllEnvs());

it("covers the whole environment contract", () => {
  const env = oracleEnv(process.cwd());
  for (const name of Object.values(ENV)) expect(env[name], name).toBeTruthy();
});

it("resolves a relative repo root to absolute paths", () => {
  const env = oracleEnv(".");
  expect(path.isAbsolute(env.PANDACORP_FACTORY_ROOT ?? "")).toBe(true);
  expect(path.isAbsolute(env.HOME ?? "")).toBe(true);
});

it("every required fixture exists; only the Codex stream may be absent", () => {
  const env = oracleEnv(process.cwd());
  for (const name of [
    "PANDACORP_FACTORY_ROOT",
    "HOME",
    "PANDACORP_EVENTS_FILE",
    "PANDACORP_ACCOUNTS_FILE",
    "MC_GIT_FIXTURE",
  ])
    expect(existsSync(env[name] ?? ""), name).toBe(true);
});

it("no value reaches the owner's real home", () => {
  const home = os.homedir();
  for (const value of Object.values(oracleEnv("/checkout")))
    expect(value.startsWith(home)).toBe(false);
});

it("HOME and USERPROFILE agree, so resolveHomeDir cannot escape on either OS", () => {
  const env = oracleEnv("/checkout");
  expect(env.USERPROFILE).toBe(env.HOME);
});
