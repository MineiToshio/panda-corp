/**
 * FRD-20 — Project overlay freshness.
 *
 * The badge fires "behind" ONLY when the project's `overlay_version` (status.yaml)
 * is strictly older than the factory's `plugin/templates/OVERLAY_VERSION`. Equal or
 * newer → "up-to-date". Any missing/unparseable input → "unknown" (no false alarm).
 *
 * Traceability: IF-20-freshness → REQ-20-001 (verdict), REQ-20-003 (read-only/defensive).
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getOverlayFreshness,
  readFactoryOverlayVersion,
  UPGRADE_COMMAND,
} from "../overlay-freshness";

// ---------------------------------------------------------------------------
// Temp-filesystem helpers
// ---------------------------------------------------------------------------

function mkTmp(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

/** Write `<factoryRoot>/plugin/templates/OVERLAY_VERSION` with the given raw content. */
function writeOverlayVersion(factoryRoot: string, raw: string): void {
  const dir = path.join(factoryRoot, "plugin", "templates");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "OVERLAY_VERSION"), raw, "utf-8");
}

// ---------------------------------------------------------------------------
// readFactoryOverlayVersion — defensive parsing (REQ-20-003, never throws)
// ---------------------------------------------------------------------------

describe("readFactoryOverlayVersion", () => {
  let factoryRoot: string;
  beforeEach(() => {
    factoryRoot = mkTmp("pc-factory-");
  });
  afterEach(() => {
    fs.rmSync(factoryRoot, { recursive: true, force: true });
  });

  it("returns the trimmed version from the OVERLAY_VERSION file", () => {
    writeOverlayVersion(factoryRoot, "8.42.3\n");
    expect(readFactoryOverlayVersion(factoryRoot)).toBe("8.42.3");
  });

  it("returns null when the file is missing", () => {
    expect(readFactoryOverlayVersion(factoryRoot)).toBeNull();
  });

  it("returns null when the file is empty / whitespace-only", () => {
    writeOverlayVersion(factoryRoot, "   \n");
    expect(readFactoryOverlayVersion(factoryRoot)).toBeNull();
  });

  it("never throws on an unreadable root", () => {
    expect(() => readFactoryOverlayVersion("/nonexistent/path/xyz")).not.toThrow();
    expect(readFactoryOverlayVersion("/nonexistent/path/xyz")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getOverlayFreshness — the verdict (REQ-20-001)
// ---------------------------------------------------------------------------

describe("getOverlayFreshness", () => {
  let factoryRoot: string;
  beforeEach(() => {
    factoryRoot = mkTmp("pc-factory-");
  });
  afterEach(() => {
    fs.rmSync(factoryRoot, { recursive: true, force: true });
  });

  it("reports 'behind' when the project overlay is strictly older than the factory", () => {
    writeOverlayVersion(factoryRoot, "8.42.3");
    const state = getOverlayFreshness("8.42.1", factoryRoot);
    expect(state.reason).toBe("behind");
    expect(state.projectVersion).toBe("8.42.1");
    expect(state.factoryVersion).toBe("8.42.3");
    expect(state.upgradeCommand).toBe(UPGRADE_COMMAND);
    expect(state.detail).toContain("8.42.1");
    expect(state.detail).toContain("8.42.3");
  });

  it("reports 'behind' across a minor/major gap", () => {
    writeOverlayVersion(factoryRoot, "9.0.0");
    expect(getOverlayFreshness("8.99.99", factoryRoot).reason).toBe("behind");
    writeOverlayVersion(factoryRoot, "8.43.0");
    expect(getOverlayFreshness("8.42.9", factoryRoot).reason).toBe("behind");
  });

  it("reports 'up-to-date' when the project overlay equals the factory", () => {
    writeOverlayVersion(factoryRoot, "8.42.3");
    const state = getOverlayFreshness("8.42.3", factoryRoot);
    expect(state.reason).toBe("up-to-date");
    expect(state.detail).toContain("8.42.3");
  });

  it("reports 'up-to-date' when the project overlay is newer than the factory (never 'behind')", () => {
    writeOverlayVersion(factoryRoot, "8.42.3");
    expect(getOverlayFreshness("8.43.0", factoryRoot).reason).toBe("up-to-date");
  });

  it("tolerates a leading 'v' on either side", () => {
    writeOverlayVersion(factoryRoot, "v8.42.3");
    expect(getOverlayFreshness("v8.42.1", factoryRoot).reason).toBe("behind");
    expect(getOverlayFreshness("v8.42.3", factoryRoot).reason).toBe("up-to-date");
  });

  it("reports 'unknown' when the project overlay version is absent", () => {
    writeOverlayVersion(factoryRoot, "8.42.3");
    expect(getOverlayFreshness(undefined, factoryRoot).reason).toBe("unknown");
    expect(getOverlayFreshness(null, factoryRoot).reason).toBe("unknown");
    expect(getOverlayFreshness("   ", factoryRoot).reason).toBe("unknown");
  });

  it("reports 'unknown' when the factory OVERLAY_VERSION is unreadable", () => {
    // no OVERLAY_VERSION written
    expect(getOverlayFreshness("8.42.1", factoryRoot).reason).toBe("unknown");
  });

  it("reports 'unknown' when either version is unparseable (no false alarm)", () => {
    writeOverlayVersion(factoryRoot, "not-a-version");
    expect(getOverlayFreshness("8.42.1", factoryRoot).reason).toBe("unknown");
    writeOverlayVersion(factoryRoot, "8.42.3");
    expect(getOverlayFreshness("garbage", factoryRoot).reason).toBe("unknown");
  });

  it("never throws on any input", () => {
    expect(() => getOverlayFreshness("8.42.1", "/nonexistent/xyz")).not.toThrow();
    expect(getOverlayFreshness("8.42.1", "/nonexistent/xyz").reason).toBe("unknown");
  });
});
