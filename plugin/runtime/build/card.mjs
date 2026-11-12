/**
 * Pandacorp build engine v2 — change-queue cards (BUILD-8, D17, D18, PLAN 3.16 A3).
 *
 * A card is `.pandacorp/inbox/changes/<slug>.md`: flat YAML frontmatter + a Markdown body. The queue is a FILE
 * FORMAT shared with Mission Control (`changes.ts`), the DR-147 reconciler (`change-reconcile.mjs`), doc-lint and the
 * default engine's `build-state.mjs`; this module is the only v2 reader and writer of it, and it stays readable by all
 * of them: writers touch single `key: value` lines and never reflow the body, `status` is written as a plain word
 * (the v1 reader matches `^status:\s*(draft|ready|building|done)\s*$`), lists are written as one-line JSON flow
 * sequences (the reconciler only reads that shape), and `integration_paths` / `integration_transaction` (v1 meaning)
 * are never written.
 *
 * Frontmatter is read by a small SAFE parser (`parseYamlSubset`): scalars, quoted strings, one-line flow lists,
 * block lists and block scalars. Anchors, aliases, tags, merge keys, flow maps and nested maps are never expanded or
 * evaluated: they are reported as `unsupported`, and the card check turns them into errors.
 *
 * Pure with respect to its inputs: every side effect goes through `deps` (`resolveDeps`): `fs` (a `node:fs/promises`
 * compatible object), `env`, `homedir`, `now`, and an optional `isTracked(absPath)` guard (D1) that makes a write to a
 * git-tracked card fail closed.
 *
 * This file is the public entry; the code lives under `./card/` (common, yaml, frontmatter, parse, read, write,
 * lifecycle). Nothing below `./card/` imports this file.
 */
export { CARD_CLASSES, CARD_STATUSES, CARD_TYPES, resolveDeps, SLUG_RE, V1_ONLY_KEYS } from "./card/common.mjs";
export { updateFrontmatter } from "./card/frontmatter.mjs";
export { archiveCard, buildingCardAction, markCardBuilding, resetCardReady, setCardDocsSha } from "./card/lifecycle.mjs";
export { cardPaths, parseCardRef, parseCardText } from "./card/parse.mjs";
export { cardCheckCommand, checkCard, checkCardText, listCards, readCard } from "./card/read.mjs";
export { createCard, renderCard, updateCard } from "./card/write.mjs";
export { frontmatterList, parseYamlSubset, splitFrontmatter } from "./card/yaml.mjs";
