#!/usr/bin/env node
/**
 * Exact dependency versions for the architecture install step (DR-102 pin at the install point, SEC-4 cooldown).
 * For every requested package it picks the highest STABLE version (x.y.z, never a prerelease, even when a prerelease
 * holds the npm `latest` dist-tag) published at least `--cooldown-days` before `--now`, optionally inside a requested
 * major (or major.minor), and prints the exact `pnpm add --save-exact` command for it.
 * Alignment notes, from the picked versions' own metadata:
 *  - FAIL  a picked version's peerDependencies name another requested package whose pick does not satisfy the range;
 *  - WARN  packages of one family (same npm scope, `prisma` + `@prisma/*`, `react` + `react-dom`, `@types/x` + `x`)
 *          resolve to different majors (e.g. `@sentry/node` must follow `@sentry/nextjs`).
 * `--node <major>` constrains an unpinned `@types/node` to the project's Node major.
 *
 * Usage: node resolve-versions.mjs [--now ISO] [--cooldown-days 7] [--node 24] [--json]
 *          [--registry https://registry.npmjs.org] [--packuments <dir>] [--timeout-ms 120000] <pkg>[@<major>[.<minor>]] ...
 *   --packuments reads <dir>/<name with "/" as "__">.json instead of the network (offline runs and tests).
 *   --timeout-ms bounds each registry fetch (default 120000: full packuments of big packages are tens of MB).
 * Prints a markdown table (paste it into the project's versions record) or JSON.
 * Exit 0 every package resolved and no peer conflict, 1 otherwise, 2 when the registry cannot be read.
 */
import fs from "node:fs";
import path from "node:path";
import { parseArgs, runCli } from "./lib-plan.mjs";

const STABLE = /^\d+\.\d+\.\d+$/;
const parts = (v) => v.split(".").map(Number);
/** Numeric x.y.z comparison. */
export const cmp = (a, b) => {
  const x = parts(a);
  const y = parts(b);
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
};
const major = (v) => parts(v)[0];

/** `react@19` → {name: "react", want: "19"}; `@scope/pkg` → {name: "@scope/pkg", want: ""}. */
export function parseSpec(spec) {
  const at = spec.lastIndexOf("@");
  return at > 0 ? { name: spec.slice(0, at), want: spec.slice(at + 1) } : { name: spec, want: "" };
}

/** Expands one comparator (`^1.2.3`, `~1.2`, `>=1.0.0`, `1.x`, `*`) into [op, version] pairs. */
function comparators(token) {
  const t = token.trim();
  if (!t || t === "*" || t === "x") return [];
  const m = /^(\^|~|>=|<=|>|<|=)?\s*v?(\d+|x|\*)(?:\.(\d+|x|\*))?(?:\.(\d+|x|\*))?(-[\w.-]+)?$/.exec(t);
  if (!m) return [["invalid", t]];
  const [, op = "", M, mi, pa, pre] = m;
  // An exact prerelease (`19.0.0-rc-1`) never matches a stable version; elsewhere the prerelease tag is ignored.
  if (pre && (op === "" || op === "=")) return [["never", t]];
  const wild = (s) => s === undefined || s === "x" || s === "*";
  const v = `${M}.${wild(mi) ? 0 : mi}.${wild(pa) ? 0 : pa}`;
  if (wild(M)) return [];
  if (op === "^") {
    const [a, b, c] = parts(v);
    const upper = a > 0 ? `${a + 1}.0.0` : b > 0 ? `0.${b + 1}.0` : `0.0.${c + 1}`;
    return [[">=", v], ["<", upper]];
  }
  if (op === "~" || (op === "" && !wild(mi) && wild(pa)) || (op === "" && wild(mi))) {
    const [a, b] = parts(v);
    const upper = wild(mi) ? `${a + 1}.0.0` : `${a}.${b + 1}.0`;
    return [[">=", v], ["<", upper]];
  }
  return [[op || "=", v]];
}

/** The upper comparator of a hyphen range: a partial `2` or `2.3` means "below the next major/minor". */
function hyphenUpper(v) {
  const p = v.split(".").map(Number);
  if (p.length === 1) return `<${p[0] + 1}.0.0`;
  if (p.length === 2) return `<${p[0]}.${p[1] + 1}.0`;
  return `<=${v}`;
}

/**
 * Does a stable version satisfy an npm range? Covers `||`, space-joined comparators, `^ ~ >= <= > < =`, x-ranges and
 * hyphen ranges; anything else is reported as unknown (null) rather than guessed.
 * @returns {boolean | null}
 */
export function satisfies(version, range) {
  for (const alt of range.split("||")) {
    let ok = true;
    const hy = /^\s*(\S+)\s+-\s+(\S+)\s*$/.exec(alt);
    const tokens = hy ? [`>=${hy[1]}`, hyphenUpper(hy[2])] : alt.trim().replace(/(>=|<=|>|<|=)\s+/g, "$1").split(/\s+/);
    for (const tok of tokens)
      for (const [op, v] of comparators(tok)) {
        if (op === "invalid") return null;
        if (op === "never") {
          ok = false;
          continue;
        }
        const c = cmp(version, v);
        const pass = { ">=": c >= 0, "<=": c <= 0, ">": c > 0, "<": c < 0, "=": c === 0 }[op];
        if (!pass) ok = false;
      }
    if (ok) return true;
  }
  return false;
}

/** The family a package aligns with (for the major-alignment note), or null. */
export function familyOf(name, requested) {
  if (name === "prisma" || name.startsWith("@prisma/")) return "prisma";
  if (name === "react" || name === "react-dom") return "react";
  if (name.startsWith("@types/")) {
    const base = name.slice(7).replace(/^(.+)__(.+)$/, "@$1/$2");
    if (requested.has(base)) return familyOf(base, requested) ?? base;
    return null;
  }
  if (name.startsWith("@")) return name.split("/")[0];
  return null;
}

/**
 * Picks the version for one packument.
 * @param {{versions: object, time: object, "dist-tags": object}} doc npm packument
 * @param {string} want "" | major | major.minor
 * @param {number} cutoff epoch ms: newest allowed publish time
 */
export function pickVersion(doc, want, cutoff) {
  const latest = doc["dist-tags"]?.latest ?? "";
  const candidates = Object.keys(doc.versions ?? {})
    .filter((v) => STABLE.test(v))
    .filter((v) => !want || v === want || v.startsWith(`${want}.`))
    .filter((v) => doc.time?.[v] && Date.parse(doc.time[v]) <= cutoff)
    .sort(cmp);
  const pick = candidates.at(-1) ?? null;
  const notes = [];
  if (latest && !STABLE.test(latest)) notes.push(`latest tag ${latest} is a prerelease: skipped`);
  else if (latest && pick && latest !== pick) {
    const t = doc.time?.[latest] ? Date.parse(doc.time[latest]) : 0;
    if (t > cutoff) notes.push(`latest ${latest} (${doc.time[latest].slice(0, 10)}) is inside the cooldown`);
    else if (want && major(latest) !== major(pick)) notes.push(`latest ${latest} is another major`);
  }
  return { latest, pick, published: pick ? doc.time[pick].slice(0, 10) : "", notes };
}

async function packument(name, { registry, dir, timeoutMs }) {
  if (dir) {
    const file = path.join(dir, `${name.replace("/", "__")}.json`);
    if (!fs.existsSync(file)) throw new Error(`no packument fixture for ${name} (${file})`);
    return JSON.parse(fs.readFileSync(file, "utf8"));
  }
  const url = `${registry.replace(/\/$/, "")}/${name.replace("/", "%2f")}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`${name}: registry answered HTTP ${res.status} (${url})`);
  return res.json();
}

/**
 * Resolves every spec.
 * @param {string[]} specs `pkg[@major]` list
 * @param {{now: number, cooldownDays: number, node?: string, registry?: string, packuments?: string}} opts
 */
export async function resolveVersions(specs, { now, cooldownDays, node, registry = "https://registry.npmjs.org", packuments, timeoutMs = 120000 }) {
  const cutoff = now - cooldownDays * 86400000;
  const parsed = specs.map(parseSpec).map((s) => (s.name === "@types/node" && !s.want && node ? { ...s, want: String(node) } : s));
  const requested = new Set(parsed.map((s) => s.name));
  const docs = await Promise.all(parsed.map((s) => packument(s.name, { registry, dir: packuments, timeoutMs })));
  const rows = parsed.map((s, i) => ({ name: s.name, want: s.want, doc: docs[i], ...pickVersion(docs[i], s.want, cutoff) }));
  const picks = new Map(rows.filter((r) => r.pick).map((r) => [r.name, r.pick]));
  const failures = rows.filter((r) => !r.pick).map((r) => `${r.name}${r.want ? `@${r.want}` : ""}: no stable version published before ${new Date(cutoff).toISOString().slice(0, 10)}`);
  const warnings = [];
  for (const r of rows) {
    if (!r.pick) continue;
    for (const [peer, range] of Object.entries(r.doc.versions[r.pick]?.peerDependencies ?? {})) {
      if (!picks.has(peer)) continue;
      const ok = satisfies(picks.get(peer), range);
      if (ok === false) failures.push(`${r.name}@${r.pick} needs peer ${peer} ${range}, but ${peer} resolves to ${picks.get(peer)}`);
      if (ok === null) warnings.push(`${r.name}@${r.pick} peer ${peer} range "${range}" not understood: check it by hand`);
    }
  }
  const families = new Map();
  for (const r of rows) {
    const f = r.pick && familyOf(r.name, requested);
    if (f) families.set(f, [...(families.get(f) ?? []), r]);
  }
  for (const [f, members] of families) {
    const majors = new Set(members.map((m) => major(m.pick)));
    if (members.length > 1 && majors.size > 1) warnings.push(`family ${f}: different majors (${members.map((m) => `${m.name}@${m.pick}`).join(", ")}); align them unless the packages version independently`);
  }
  return {
    cutoff: new Date(cutoff).toISOString(),
    rows: rows.map(({ doc, ...rest }) => ({ ...rest, command: rest.pick ? `pnpm add --save-exact ${rest.name}@${rest.pick}` : "" })),
    failures,
    warnings,
  };
}

runCli(import.meta.url, async () => {
  const args = parseArgs(process.argv.slice(2), ["json"]);
  if (!args._.length) throw new Error("usage: resolve-versions.mjs [--now ISO] [--cooldown-days 7] [--node N] [--json] [--packuments dir] <pkg>[@major] ...");
  const now = args.now ? Date.parse(args.now) : Date.now();
  if (Number.isNaN(now)) throw new Error(`--now is not a date: ${args.now}`);
  const cooldownDays = args["cooldown-days"] === undefined ? 7 : Number(args["cooldown-days"]);
  const out = await resolveVersions(args._, { now, cooldownDays, node: args.node, registry: args.registry, packuments: args.packuments, timeoutMs: args["timeout-ms"] ? Number(args["timeout-ms"]) : undefined });
  if (args.json) console.log(JSON.stringify(out, null, 2));
  else {
    console.log(`Cooldown cutoff: ${out.cutoff} (${cooldownDays} days before ${new Date(now).toISOString()}); stable versions only.\n`);
    console.log("| Package | Exact version | Published | npm `latest` tag | Note | Command |");
    console.log("|---|---|---|---|---|---|");
    for (const r of out.rows) console.log(`| ${r.name} | ${r.pick ?? "NONE"} | ${r.published} | ${r.latest} | ${r.notes.join("; ")} | \`${r.command}\` |`);
    for (const w of out.warnings) console.log(`WARN  ${w}`);
    for (const f of out.failures) console.log(`FAIL  ${f}`);
    console.log(out.failures.length ? `VERSIONS NOT RESOLVED: ${out.failures.length} failing` : "VERSIONS RESOLVED");
  }
  return out.failures.length ? 1 : 0;
});
