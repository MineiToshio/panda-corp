import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  classifyRequest,
  ledgerActionIds,
  sharedStateFingerprint,
} from "../../../../e2e/_read-only-state";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});
function fixture(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mc-read-only-"));
  roots.push(root);
  fs.writeFileSync(path.join(root, "status.yaml"), "phase: implementation\n");
  return root;
}
const manifest = {
  node: {
    ledger: {
      filename: "src/app/_actions/snapshotLedger.ts",
      exportedName: "snapshotGamificationLedger",
    },
    discard: { filename: "src/app/board/actions/actions.ts", exportedName: "discardIdea" },
  },
};
const mutation = {
  method: "POST",
  url: "http://127.0.0.1:3927/board",
  origin: "http://127.0.0.1:3927",
  action: "ledger",
  ledgerIds: () => ledgerActionIds(manifest),
};

describe("read-only parallel boundary", () => {
  it("isolates only the named ledger action from the current build", () => {
    expect(classifyRequest(mutation)).toBe("isolated-ledger");
    expect(classifyRequest({ ...mutation, action: "discard" })).toBe("forbidden");
    expect(classifyRequest({ ...mutation, action: undefined })).toBe("forbidden");
    expect(classifyRequest({ ...mutation, method: "DELETE" })).toBe("forbidden");
    expect(classifyRequest({ ...mutation, url: "https://foreign.example/board" })).toBe(
      "forbidden",
    );
    expect(classifyRequest({ ...mutation, method: "GET" })).toBe("read");
  });
  it("fails closed on unknown/missing action metadata", () => {
    expect(() =>
      ledgerActionIds({ node: { ledger: { exportedName: "snapshotGamificationLedger" } } }),
    ).toThrow(/identify/);
    expect(() =>
      ledgerActionIds({
        node: {
          ledger: {
            filename: "other/snapshotLedger.ts",
            exportedName: "snapshotGamificationLedger",
          },
        },
      }),
    ).toThrow(/identify/);
  });
  it("accepts concurrent readers without confusing access-time updates with mutations", async () => {
    const root = fixture();
    const before = sharedStateFingerprint(root);
    await Promise.all(
      Array.from({ length: 3 }, () => fs.promises.readFile(path.join(root, "status.yaml"))),
    );
    expect(sharedStateFingerprint(root)).toBe(before);
  });
  it("detects a write even after original bytes are restored", () => {
    const root = fixture();
    const file = path.join(root, "status.yaml");
    const original = fs.readFileSync(file);
    const before = sharedStateFingerprint(root);
    fs.writeFileSync(file, "phase: release\n");
    fs.writeFileSync(file, original);
    expect(sharedStateFingerprint(root)).not.toBe(before);
  });
  it("detects a live-refresh utimes without a content change", () => {
    const root = fixture();
    const file = path.join(root, "status.yaml");
    const before = sharedStateFingerprint(root);
    fs.utimesSync(file, new Date(0), new Date(0));
    expect(sharedStateFingerprint(root)).not.toBe(before);
  });
  it("detects even a transient ledger lock directory", () => {
    const root = fixture();
    const before = sharedStateFingerprint(root);
    fs.mkdirSync(path.join(root, "gamification-ledger.json.lock"));
    fs.rmdirSync(path.join(root, "gamification-ledger.json.lock"));
    expect(sharedStateFingerprint(root)).not.toBe(before);
  });
});

it("rejects unsafe additions to the parallel tier before launching a browser", () => {
  const e2e = path.resolve("e2e");
  const specs = JSON.parse(
    fs.readFileSync(path.join(e2e, "parallel-safe.json"), "utf8"),
  ) as string[];
  const nativeReaders = new Set(["headers.spec.ts", "hydration.spec.ts", "shell-ssr.spec.ts"]);
  const visited = new Set<string>();
  function audit(file: string): void {
    if (visited.has(file)) return;
    visited.add(file);
    const source = fs.readFileSync(file, "utf8");
    expect(source, file).not.toMatch(/node:child_process|(?:\b|\/)_(?:ledger|live-refresh)["']/);
    expect(source, file).not.toMatch(
      /\b(?:writeFile(?:Sync)?|appendFile(?:Sync)?|utimes(?:Sync)?|mkdir(?:Sync)?|unlink(?:Sync)?|rename(?:Sync)?|rm(?:Sync)?|rmdir(?:Sync)?|newContext|newPage|launchPersistentContext|toHaveScreenshot|toMatchSnapshot)\s*\(/,
    );
    expect(source, file).not.toMatch(/\bstorageState\s*:/);
    for (const match of source.matchAll(/from\s+["'](\.[^"']+)["']/g)) {
      const target = path.resolve(path.dirname(file), `${match[1]}.ts`);
      if (fs.existsSync(target)) audit(target);
    }
  }
  for (const spec of specs) {
    const file = path.join(e2e, spec);
    if (!nativeReaders.has(spec)) {
      expect(fs.readFileSync(file, "utf8"), spec).toMatch(
        /import \{ test \} from "\.\/_read-only"/,
      );
    }
    audit(file);
  }
});

it("keeps isolated mutations inside the slot boundary", () => {
  const e2e = path.resolve("e2e");
  const isolated = JSON.parse(
    fs.readFileSync(path.join(e2e, "isolated-specs.json"), "utf8"),
  ) as Record<string, string>;
  const safe = JSON.parse(
    fs.readFileSync(path.join(e2e, "parallel-safe.json"), "utf8"),
  ) as string[];
  const serial = JSON.parse(fs.readFileSync(path.join(e2e, "serial-specs.json"), "utf8")) as Record<
    string,
    string
  >;
  const visited = new Set<string>();
  function audit(file: string): void {
    if (visited.has(file) || file === path.join(e2e, "_slot.ts")) return;
    visited.add(file);
    const source = fs.readFileSync(file, "utf8");
    expect(source, file).not.toMatch(
      /e2e\/fixtures|git\s+show\s+HEAD|["']show["']\s*,\s*["']HEAD:/,
    );
    if (source.includes("node:child_process")) {
      // Conservative allowance: every subprocess must inline its slot-root argument array.
      // Shell execution and indirect argv builders require a separate isolation review.
      expect(source, file).toMatch(
        /import\s*\{[^}]*FACTORY_ROOT[^}]*\}\s*from\s*["']\.\/_slot["']/,
      );
      expect(source, file).not.toMatch(/\b(?:exec|execSync|spawn|spawnSync)\s*\(/);
      const calls = [...source.matchAll(/\bexecFile(?:Sync)?\s*\(([^;]+)/g)];
      expect(calls.length, file).toBeGreaterThan(0);
      for (const call of calls)
        expect(call[1], file).toMatch(
          /^\s*process\.execPath\s*,\s*\[[^\]]*["']--factory-root["']\s*,\s*FACTORY_ROOT\s*[,\]]/,
        );
    }
    for (const match of source.matchAll(/from\s+["'](\.[^"']+)["']/g)) {
      const target = path.resolve(path.dirname(file), `${match[1]}.ts`);
      if (fs.existsSync(target)) audit(target);
    }
  }
  for (const [spec, reason] of Object.entries(isolated)) {
    expect(reason.trim()).not.toBe("");
    expect(spec).not.toBe("visual.spec.ts");
    expect(safe).not.toContain(spec);
    expect(serial).not.toHaveProperty(spec);
    audit(path.join(e2e, spec));
  }
});
