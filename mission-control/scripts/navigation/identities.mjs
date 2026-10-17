#!/usr/bin/env node
import path from "node:path";
import { applyRegistration, planRegistration } from "./registry.ts";

const args = process.argv.slice(2);
const allowed = new Set([
  "--factory-root",
  "--dry-run",
  "--apply",
  "--rename-kind",
  "--rename-id",
  "--slug",
]);
try {
  const options = new Map();
  for (let i = 0; i < args.length; i += 1) {
    const argument = args[i];
    if (!allowed.has(argument) || options.has(argument))
      throw new Error(`Unknown or duplicate option: ${argument}`);
    const value = argument === "--dry-run" || argument === "--apply" ? true : args[++i];
    if (!value || (typeof value === "string" && value.startsWith("--")))
      throw new Error(`Missing value: ${argument}`);
    options.set(argument, value);
  }
  if (Boolean(options.get("--dry-run")) === Boolean(options.get("--apply")))
    throw new Error("Specify exactly one of --dry-run or --apply");
  const root = path.resolve(
    options.get("--factory-root") || process.env.PANDACORP_FACTORY_ROOT || "..",
  );
  process.env.PANDACORP_FACTORY_ROOT = root;
  let rename;
  if (["--rename-kind", "--rename-id", "--slug"].some((key) => options.has(key))) {
    const kind = options.get("--rename-kind");
    if (
      !["idea", "project"].includes(kind) ||
      !options.has("--rename-id") ||
      !options.has("--slug")
    )
      throw new Error("Rename requires --rename-kind idea|project --rename-id ID --slug SLUG");
    rename = { kind, id: options.get("--rename-id"), slug: options.get("--slug") };
  }
  const plan = options.has("--apply")
    ? applyRegistration(root, rename)
    : planRegistration(root, rename);
  console.log(
    JSON.stringify(
      {
        mode: options.has("--apply") ? "apply" : "dry-run",
        added: plan.added,
        resources: plan.catalog.resources.length,
        changedFiles: [...plan.writes.keys()].map((file) => path.relative(root, file)),
        identities: plan.catalog.resources.map(
          ({ kind, id, slug, aliases, locator, projectId }) => ({
            kind,
            id,
            slug,
            aliases,
            locator,
            projectId,
          }),
        ),
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(String(error));
  process.exitCode = 1;
}
