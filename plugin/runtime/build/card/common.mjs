// card/common.mjs: card vocabularies, the frontmatter regexes, the error helper and the injected-dependency resolver.
import * as nodeFs from "node:fs/promises";
import os from "node:os";

/** Card `type` values accepted by Mission Control. */
export const CARD_TYPES = Object.freeze(["bug", "feature", "change"]);
/** Card `class` values (urgency, DR-069). */
export const CARD_CLASSES = Object.freeze(["expedite", "standard", "intangible", "fixed-date"]);
/** Card `status` values inside Mission Control's enum; `obsolete` is a read alias of `discarded`, never written. */
export const CARD_STATUSES = Object.freeze(["ready", "draft", "building", "closing", "done", "discarded"]);
/** Slug grammar of a card file stem (the reconciler and `build-state.mjs` require it). */
export const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;
/** Frontmatter keys v2 must never write (their meaning belongs to the default engine). */
export const V1_ONLY_KEYS = Object.freeze(["integration_paths", "integration_transaction"]);
export const FRD_RE = /^frd-[a-z0-9-]+$/;
export const KEY_NAME_RE = /^[A-Za-z_][A-Za-z0-9_-]*$/;
export const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);
export const FM_RE = /^﻿?---[ \t]*\r?\n(?:([\s\S]*?)\r?\n)?---[ \t]*(?:\r?\n|$)/;
export const CITATION_RE = /"[^"\n]{3,}"|“[^”\n]{3,}”|«[^»\n]{3,}»/;
export const PLAIN_ENUM_KEYS = new Set(["status", "type", "class", "engine", "origin"]);
export const SHA_RE = /^[0-9a-f]{7,40}$/;

export const fail = (code, message, extra = {}) => Object.assign(new Error(message), { code, ...extra });

/**
 * Normalize the injected dependencies. Tests pass real `node:fs/promises` against mkdtemp trees.
 * @param {{fs?: object, env?: object, homedir?: string, now?: () => number, isTracked?: (abs: string) => Promise<boolean>}} [deps]
 * @returns {{fs: object, env: object, homedir: string, now: () => number, isTracked: null | ((abs: string) => Promise<boolean>)}}
 */
export function resolveDeps(deps = {}) {
  const env = deps.env ?? process.env;
  const now = deps.now ?? (() => {
    const hooked = env.PANDACORP_NOW ? Date.parse(env.PANDACORP_NOW) : Number.NaN;
    return Number.isFinite(hooked) ? hooked : Date.now();
  });
  return { fs: deps.fs ?? nodeFs, env, homedir: deps.homedir ?? os.homedir(), now, isTracked: deps.isTracked ?? null };
}
