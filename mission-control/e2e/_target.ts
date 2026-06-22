import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Reads the project's declared target platform from `.pandacorp/status.yaml` (DR-074).
 *
 * PER-PROJECT, NOT conformance-checked — each project's value differs (it is a product decision
 * set by `spec`/`adopt`). The gate (responsive.spec.ts) reads this ONLY to decide WHICH widths to
 * assert: the mobile-width responsive checks run only when the target includes mobile; for a
 * desktop-only / API / scraper project the responsive spec is a vacuous pass.
 *
 * Tiny hand-rolled read (no YAML dep): one `target_platforms: <value>` line. Missing/unreadable →
 * defaults to `desktop` (conservative — never turns the new mobile gate red by accident).
 */

export type TargetPlatform = "desktop" | "mobile" | "responsive";

const STATUS_PATH = resolve(process.cwd(), ".pandacorp", "status.yaml");
const TARGET_RE = /^\s*target_platforms:\s*([a-z]+)/m;

export function readTargetPlatform(): TargetPlatform {
  try {
    const raw = readFileSync(STATUS_PATH, "utf8");
    const match = TARGET_RE.exec(raw);
    const value = match?.[1];
    if (value === "mobile" || value === "responsive" || value === "desktop") return value;
  } catch {
    // status.yaml absent/unreadable → conservative default below
  }
  return "desktop";
}

export const TARGET_PLATFORM: TargetPlatform = readTargetPlatform();

/** The responsive (mobile-width) checks apply only when the target includes mobile. */
export const TARGETS_MOBILE: boolean =
  TARGET_PLATFORM === "mobile" || TARGET_PLATFORM === "responsive";

/** The mobile viewport width the responsive gate asserts at. */
export const MOBILE_WIDTH = 390;
