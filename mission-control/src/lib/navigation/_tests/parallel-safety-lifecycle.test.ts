import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { BrowserContext, Route } from "@playwright/test";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({
  fixture: undefined as unknown,
  root: "",
  manifest: "",
  softFailures: [] as unknown[],
  softValues: [] as unknown[],
}));

vi.mock("@playwright/test", async () => {
  const { expect: assert } = await import("vitest");
  const fixtureExpect = Object.assign(
    (actual: unknown, message?: string) => assert(actual, message),
    {
      soft: (actual: unknown, message?: string) => ({
        toEqual(expected: unknown) {
          harness.softValues.push(actual);
          try {
            assert(actual, message).toEqual(expected);
          } catch (error) {
            // Observe the fixture's failing assertion without failing the adversarial test.
            harness.softFailures.push(error);
          }
        },
      }),
    },
  );
  return {
    expect: fixtureExpect,
    test: {
      extend(fixtures: { readOnlyState: readonly unknown[] }) {
        harness.fixture = fixtures.readOnlyState[0];
        return {};
      },
    },
  };
});

vi.mock("node:path", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:path")>();
  return {
    ...actual,
    default: {
      ...actual,
      resolve(...parts: string[]) {
        if (parts.length === 1 && parts[0] === "e2e/fixtures") return harness.root;
        if (
          parts.length === 1 &&
          parts[0] !== undefined &&
          /^\.next\/(?:dev\/)?server\/server-reference-manifest\.json$/.test(parts[0])
        )
          return harness.manifest;
        return actual.resolve(...parts);
      },
    },
  };
});

// Import the actual fixture: the hoisted Playwright mock captures its callback unchanged.
import "../../../../e2e/_read-only";

type FixtureCallback = (
  options: { context: BrowserContext; baseURL: string },
  use: (value: undefined) => Promise<void>,
) => Promise<void>;
type Interceptor = (route: Route) => Promise<void>;

const origin = "http://127.0.0.1:3927";
let temporary = "";

beforeEach(() => {
  temporary = fs.mkdtempSync(path.join(os.tmpdir(), "mc-read-only-lifecycle-"));
  harness.root = path.join(temporary, "fixtures");
  harness.manifest = path.join(temporary, "server-reference-manifest.json");
  harness.softFailures.length = 0;
  harness.softValues.length = 0;
  fs.mkdirSync(harness.root);
  fs.writeFileSync(path.join(harness.root, "status.yaml"), "phase: implementation\n");
  fs.writeFileSync(
    harness.manifest,
    JSON.stringify({
      node: {
        "current-build-ledger": {
          filename: "src/app/_actions/snapshotLedger.ts",
          exportedName: "snapshotGamificationLedger",
        },
      },
    }),
  );
});

afterEach(() => {
  fs.rmSync(temporary, { recursive: true, force: true });
});

function context(onClose: () => void = () => {}) {
  let intercepted: Interceptor | undefined;
  const route = vi.fn(async (_pattern: string, handler: Interceptor) => {
    intercepted = handler;
  });
  const close = vi.fn(async () => onClose());
  return {
    value: { route, close } as unknown as BrowserContext,
    close,
    dispatch(request: Route) {
      if (!intercepted) throw new Error("Fixture did not install its request interceptor");
      return intercepted(request);
    },
  };
}

function action(id: string) {
  const fallback = vi.fn(async () => {});
  const fulfill = vi.fn(async () => {});
  const abort = vi.fn(async () => {});
  return {
    value: {
      request: () => ({
        method: () => "POST",
        url: () => `${origin}/board`,
        headers: () => ({ "next-action": id }),
      }),
      fallback,
      fulfill,
      abort,
    } as unknown as Route,
    fallback,
    fulfill,
    abort,
  };
}

function run(contextValue: BrowserContext, body: () => Promise<void>) {
  if (typeof harness.fixture !== "function") throw new Error("Fixture callback was not captured");
  return (harness.fixture as FixtureCallback)({ context: contextValue, baseURL: origin }, body);
}

it("isolates the ledger action without forwarding it and closes the context", async () => {
  const browser = context();
  const request = action("current-build-ledger");
  await run(browser.value, async () => browser.dispatch(request.value));
  expect(request.fallback).not.toHaveBeenCalled();
  expect(request.abort).not.toHaveBeenCalled();
  expect(request.fulfill).toHaveBeenCalledWith({
    status: 200,
    contentType: "text/plain",
    body: "Read-only UI boundary",
  });
  expect(browser.close).toHaveBeenCalledOnce();
  expect(harness.softFailures).toEqual([]);
});

it("blocks an unexpected mutation and records a failing test assertion", async () => {
  const browser = context();
  const request = action("discard-idea");
  await run(browser.value, async () => browser.dispatch(request.value));
  expect(request.fallback).not.toHaveBeenCalled();
  expect(request.fulfill).toHaveBeenCalledOnce();
  expect(harness.softFailures).toHaveLength(1);
  expect(harness.softValues).toEqual([[`Unexpected mutation: POST ${origin}/board`]]);
  expect(browser.close).toHaveBeenCalledOnce();
});

it("fingerprints after context shutdown so a late write cannot escape", async () => {
  const file = path.join(harness.root, "status.yaml");
  const browser = context(() => fs.writeFileSync(file, "phase: release\n"));
  await expect(run(browser.value, async () => {})).rejects.toThrow(
    "Shared e2e fixtures changed in a read-only spec",
  );
  expect(browser.close).toHaveBeenCalledOnce();
  expect(fs.readFileSync(file, "utf8")).toBe("phase: release\n");
});

it("closes the context and preserves a rejected test body's error", async () => {
  const browser = context();
  const rejected = new Error("body rejection sentinel");
  await expect(
    run(browser.value, async () => {
      throw rejected;
    }),
  ).rejects.toBe(rejected);
  expect(browser.close).toHaveBeenCalledOnce();
  expect(harness.softFailures).toEqual([]);
});

it("aborts and records a test failure when the running manifest is missing", async () => {
  fs.unlinkSync(harness.manifest);
  const browser = context();
  const request = action("current-build-ledger");
  await run(browser.value, async () => browser.dispatch(request.value));
  expect(request.fallback).not.toHaveBeenCalled();
  expect(request.fulfill).not.toHaveBeenCalled();
  expect(request.abort).toHaveBeenCalledOnce();
  expect(harness.softFailures).toHaveLength(1);
  expect(harness.softValues).toEqual([[expect.stringContaining("ENOENT")]]);
  expect(browser.close).toHaveBeenCalledOnce();
});
