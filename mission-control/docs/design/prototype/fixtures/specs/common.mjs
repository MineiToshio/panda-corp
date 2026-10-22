// Shared helpers for the fixture specs: a seeded PRNG, fixed-clock dates and the small
// writers every spec uses. Everything here is deterministic so a regeneration is a no-op diff.
import fs from "node:fs";
import path from "node:path";

/** The frozen capture instant every fixture-derived timestamp is anchored to. */
export const CLOCK = "2026-10-21T00:20:00.000Z";
export const CLOCK_MS = Date.parse(CLOCK);

/** mulberry32: tiny, seedable, stable across Node versions. */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable string hash used to derive per-item seeds from ids. */
export function hash(text) {
  let h = 2166136261;
  for (const ch of text) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

/** Pick one entry deterministically for `key` (same key → same pick). */
export const pickFor = (key, list) => list[hash(key) % list.length];

export const pad = (n, width = 2) => String(n).padStart(width, "0");
export const isoDay = (ms) => new Date(ms).toISOString().slice(0, 10);
export const iso = (ms) => new Date(ms).toISOString();
export const addMinutes = (ms, min) => ms + Math.round(min * 60_000);

/** YAML scalar: JSON strings are valid YAML double-quoted scalars. */
export const y = (value) => (typeof value === "string" ? JSON.stringify(value) : String(value));
export const yList = (items) => `[${items.map((i) => y(i)).join(", ")}]`;

/** Frontmatter block from ordered [key, value] pairs; arrays become block lists. */
export function frontmatter(pairs) {
  const lines = ["---"];
  for (const [key, value] of pairs) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      if (value.length === 0) lines.push(`${key}: []`);
      else {
        lines.push(`${key}:`);
        for (const item of value) lines.push(`  - ${y(item)}`);
      }
    } else lines.push(`${key}: ${value === null ? "" : y(value)}`);
  }
  lines.push("---");
  return lines.join("\n");
}

/** Write a file (creating parents), normalising to one trailing newline. */
export function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${content.replace(/\s+$/, "")}\n`, "utf8");
}

export const writeJson = (file, value) => write(file, JSON.stringify(value, null, 2));

/** kebab-case slug from free text. */
export const slugify = (text) =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** Sentence-case a phrase (first letter upper). */
export const cap = (text) => text.charAt(0).toUpperCase() + text.slice(1);

/** Lower-case the first letter so a title reads inside a sentence. */
export const low = (text) => text.charAt(0).toLowerCase() + text.slice(1);
