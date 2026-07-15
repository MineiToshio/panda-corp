#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".."));
const dirs = readdirSync(path.join(root, "plugin/skills"), { withFileTypes: true }).filter((e) => e.isDirectory() && readdirSync(path.join(root, "plugin/skills", e.name)).includes("SKILL.md")).map((e) => e.name).sort();
const matrix = JSON.parse(readFileSync(path.join(root, "plugin/runtime/skill-capabilities.json"), "utf8"));
const slugs = matrix.skills.map((s) => s.slug).sort();
const fail = (m) => { console.error(`Skill capability gate FAILED: ${m}`); process.exit(2); };
if (JSON.stringify(dirs) !== JSON.stringify(slugs)) fail(`coverage differs: sources=${dirs.length}, matrix=${slugs.length}`);
if (new Set(slugs).size !== slugs.length) fail("duplicate skill row");
for (const skill of matrix.skills) for (const runtime of ["claude", "codex"]) {
  const entry = skill.runtimes[runtime]; if (!entry || !new Set(["PROVEN", "EXPERIMENTAL", "FALLBACK", "UNSUPPORTED"]).has(entry.status)) fail(`${skill.slug}/${runtime} has no valid status`);
  if (entry.status !== "PROVEN" && !entry.fallback) fail(`${skill.slug}/${runtime} lacks a fallback`);
  if (!entry.evidence?.kind || !entry.evidence?.verified_at || !entry.evidence?.verifier) fail(`${skill.slug}/${runtime} lacks dated verifier evidence`);
  if (runtime === "codex" && entry.status === "PROVEN" && entry.evidence.kind === "static-contract-only") fail(`${skill.slug}/codex inflates static evidence to PROVEN`);
}
const expectedInternal = new Set(["bug", "iterate", "new-version", "scaffold", "work-orders"]);
for (const skill of matrix.skills) if (skill.user_invocable === expectedInternal.has(skill.slug)) fail(`${skill.slug} user_invocable projection is wrong`);
for (const skill of matrix.skills) {
  const sidecar = path.join(root, "plugin/skills", skill.slug, "agents/openai.yaml");
  if (expectedInternal.has(skill.slug)) {
    if (!existsSync(sidecar) || !/allow_implicit_invocation:\s*false/.test(readFileSync(sidecar, "utf8"))) fail(`${skill.slug} internal sidecar missing fail-closed policy`);
  } else if (existsSync(sidecar)) fail(`${skill.slug} has an unnecessary Codex sidecar`);
}
const implementCodex = matrix.skills.find((skill) => skill.slug === "implement")?.runtimes.codex;
if (implementCodex?.status !== "EXPERIMENTAL" || implementCodex.profile !== "attended_foreground" || implementCodex.scope !== "targeted-only") fail("implement/Codex promotion is not the exact attended targeted profile");
for (const boundary of ["one FRD", "one ready change", "foreground", "<=7200", "zero automatic restarts", "Bare/global", "hardening", "release", "unattended", "cross-runtime"]) if (!implementCodex.fallback.includes(boundary)) fail(`implement/Codex boundary missing from capability projection: ${boundary}`);
const ownership = JSON.parse(readFileSync(path.join(root, "plugin/runtime/capability-ownership.json"), "utf8"));
const executor = ownership.capabilities?.codex_product_executor;
if (executor?.certification !== "EXPERIMENTAL" || executor.profile !== "attended_foreground" || executor.scope !== "targeted-only") fail("Codex executor ownership disagrees with the promoted skill policy");
console.log(`PASS  exact skill capability coverage ${slugs.length}/${dirs.length}`);
