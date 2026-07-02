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

/**
 * The project's declared deploy target (DR-085): `external` = publicly reachable production,
 * `internal` = owner-only (127.0.0.1 / LAN). Read the same way as target_platforms; missing /
 * unreadable → `internal` (conservative — the header-scan gate stays ADVISORY, never a surprise RED).
 */
export type DeployTarget = "internal" | "external";

const DEPLOY_RE = /^\s*deploy_target:\s*([a-z]+)/m;

export function readDeployTarget(): DeployTarget {
  try {
    const raw = readFileSync(STATUS_PATH, "utf8");
    const value = DEPLOY_RE.exec(raw)?.[1];
    if (value === "external") return "external";
  } catch {
    // status.yaml absent/unreadable → conservative default below
  }
  return "internal";
}

export const DEPLOY_TARGET: DeployTarget = readDeployTarget();

/** The responsive (mobile-width) checks apply only when the target includes mobile. */
export const TARGETS_MOBILE: boolean =
  TARGET_PLATFORM === "mobile" || TARGET_PLATFORM === "responsive";

/** The mobile viewport width the responsive gate asserts at. */
export const MOBILE_WIDTH = 390;
