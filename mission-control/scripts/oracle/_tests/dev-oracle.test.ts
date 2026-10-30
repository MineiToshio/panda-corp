import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { expect, it } from "vitest";

it("REQ-01-011: refuses missing fixtures with a regeneration command before starting Next", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "mc-oracle-"));
  try {
    mkdirSync(path.join(root, "scripts/oracle"), { recursive: true });
    const script = path.join(root, "scripts/oracle/dev-oracle.mjs");
    writeFileSync(
      script,
      readFileSync("scripts/oracle/dev-oracle.mjs", "utf8").replace(
        "../../src/lib/config/oracleEnv.ts",
        pathToFileURL(path.resolve("src/lib/config/oracleEnv.ts")).href,
      ),
    );
    expect(() =>
      execFileSync(
        process.execPath,
        ["--loader", path.resolve("scripts/read-model/ts-loader.mjs"), script],
        { stdio: "pipe", timeout: 5000 },
      ),
    ).toThrow(/node docs\/design\/prototype\/scripts\/make-fixtures.mjs/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
