// Turns a compact project spec into the on-disk layout Mission Control's readers parse:
// .pandacorp/{status.yaml,comms,inbox,accounts,track.jsonl}, docs/** (PRD, FRDs, blueprints,
// work orders, ADRs, data-model.json), DESIGN.md and .env.example. Prose that is not written
// by hand in the spec is composed from the pools below, keyed by id so it never shifts.
import path from "node:path";
import { cap, frontmatter, iso, isoDay, low, pad, pickFor, write, writeJson, y } from "./common.mjs";

const STATUS_TO_FM = { todo: "PLANNED", in_progress: "IN_PROGRESS", review: "IN_REVIEW", done: "VERIFIED", fail: "BLOCKED" };

const SUMMARY_LEADS = [
  "Delivers {t} as a small, testable slice of {f}.",
  "Builds {t} so the {f} feature has one honest source for this behaviour.",
  "Adds {t}, the piece {f} needs before its screens can rely on real data.",
  "Implements {t} end to end, from the reader to the rendered state.",
  "Introduces {t} with typed results instead of silent fallbacks.",
  "Wires {t} into {f} without touching neighbouring features.",
];
const SUMMARY_WHYS = [
  "The blueprint names it as a separate component, so it ships on its own and can be reviewed in isolation.",
  "Keeping it apart lets the FRD gate exercise it together with its siblings.",
  "It removes a manual step the owner was doing by hand during the last iteration.",
  "Every consumer reads the same resolver, so the value cannot drift between screens.",
  "Empty, loading and error states are designed here rather than improvised later.",
  "The change is additive and leaves the existing routes untouched.",
];
const SCOPE_LINES = [
  "Render {t} with the shared tokens and primitives; no new visual scale.",
  "Expose a typed result for every expected failure and render it as a designed state.",
  "Cover the happy path and one malformed input with unit tests written first.",
  "Keep the module under the size limits and document its exported functions.",
  "Reuse the existing reader instead of re-deriving the same value.",
  "Add the keyboard path and an accessible name for every new control.",
  "Persist nothing new; the change only reads what the factory already writes.",
  "Log the invariant it relies on next to the code, not in a separate note.",
];
const OUT_LINES = [
  "Any change to neighbouring features or their routes.",
  "Visual polish beyond the approved prototype.",
  "Writing to factory files; this order stays read-only.",
  "Performance tuning beyond the stated budget.",
];
const AC_LINES = [
  "WHEN {t} has data, the screen SHALL show it using the shared tokens.",
  "WHEN the source is missing, the system SHALL show the designed empty state, not an error.",
  "IF the source cannot be parsed, THEN the system SHALL show an explicit error state.",
  "WHEN the owner uses only the keyboard, every control SHALL be reachable and labelled.",
  "WHILE a value is loading, the layout SHALL NOT shift once it arrives.",
  "WHEN two consumers read the value, they SHALL read the same resolver.",
];
const NOTE_LINES = [
  "**Built:** the slice landed as planned behind the existing route; tests were written first and pass in isolation.",
  "**Built:** one reader, one resolver and two designed states; the reviewer added an adversarial case for malformed input.",
  "**Built:** the component reuses the inventory primitives; no new tokens were needed.",
  "**Built:** the behaviour matches the FRD criteria; a follow-up nit about spacing is on the punch-list, not a blocker.",
];
const NOTE_SEAMS = [
  "**Integration seams:** consumed only by its parent route; no other module imports it.",
  "**Integration seams:** the shared resolver is the only new export.",
  "**Integration seams:** none beyond the props of the parent component.",
];

const fill = (tpl, t, f) => tpl.replaceAll("{t}", low(t)).replaceAll("{f}", f);

function woFile(frd, wo) {
  const id = `WO-${pad(frd.n)}-${pad(wo.n, 3)}`;
  return { id, file: `wo-${pad(frd.n)}-${pad(wo.n, 3)}-${wo.slug}.md` };
}

/** One work-order document in the DR-050 frontmatter + EARS body shape the board parses. */
function workOrderDoc(project, frd, wo) {
  const { id } = woFile(frd, wo);
  const f = low(frd.en);
  const acCount = wo.criteria ?? 2 + (Number.parseInt(id.slice(-1), 10) % 2);
  const acs = Array.from({ length: acCount }, (_, k) => `- AC-${pad(frd.n)}-${pad(wo.n, 3)}.${k + 1} — ${fill(pickFor(`${id}ac${k}`, AC_LINES), wo.title, f)}`);
  const scope = [0, 1, 2].map((k) => `- ${fill(pickFor(`${id}sc${k}`, SCOPE_LINES), wo.title, f)}`);
  const built = wo.state === "done" || wo.state === "review";
  const note = built
    ? `${pickFor(`${id}nb`, NOTE_LINES)}\n\n${pickFor(`${id}ns`, NOTE_SEAMS)}`
    : wo.state === "fail"
      ? `**Blocked:** ${wo.blocked ?? "waiting on an owner decision recorded in the decisions inbox."}`
      : `**Planned:** starts once ${wo.deps?.length ? wo.deps.join(", ") : "the FRD's first order"} is verified.`;
  const fm = frontmatter([
    ["id", id],
    ["type", "work-order"],
    ["slug", wo.slug],
    ["title", `${id} — ${wo.title}`],
    ["status", "ACTIVE"],
    ["parent", `FRD-${pad(frd.n)}`],
    ["implementation_status", STATUS_TO_FM[wo.state]],
    ["difficulty", wo.difficulty ?? pickFor(`${id}d`, ["low", "normal", "normal", "high"])],
    ["reopen_count", wo.reopen ?? 0],
    ["artifacts", wo.artifacts ?? [`${project.srcRoot}/${frd.area ?? frd.slug.replace(/^frd-\d+-/, "")}/**`]],
    ["source_requirements", [`REQ-${pad(frd.n)}-${pad(wo.req ?? wo.n, 3)}`]],
    ["dependsOn", wo.deps ?? []],
    ["last_updated", wo.end ? isoDay(wo.end) : project.plannedOn],
  ]);
  return `${fm}
# ${id} — ${wo.title}

## Summary

${fill(pickFor(`${id}s1`, SUMMARY_LEADS), wo.title, f)} ${pickFor(`${id}s2`, SUMMARY_WHYS)}

## Scope

${scope.join("\n")}

**Out of scope:** ${low(pickFor(`${id}o`, OUT_LINES))}

## Acceptance criteria

${acs.join("\n")}

## Status Note

${note}`;
}

/** frd.md: the user contract (REQ + EARS) the build is judged against. */
function frdDoc(frd) {
  const reqs = frd.reqs ?? (frd.wos.length ? frd.wos.slice(0, 3).map((wo) => wo.title) : [frd.en]);
  const body = reqs
    .map((r, k) => `### REQ-${pad(frd.n)}-${pad(k + 1, 3)} — ${cap(r)}\n\n- AC-${pad(frd.n)}-${pad(k + 1, 3)}.1 — WHEN the owner opens the screen, the system SHALL show ${low(r)}.\n- AC-${pad(frd.n)}-${pad(k + 1, 3)}.2 — IF the source is missing, THEN the system SHALL show the designed empty state.`)
    .join("\n\n");
  return `${frontmatter([["id", `FRD-${pad(frd.n)}`], ["title", frd.en], ["status", "APPROVED"], ["ui", frd.tag !== "Infra"]])}
# FRD-${pad(frd.n)} — ${frd.en}

## Overview

${frd.overview ?? `${frd.en} covers ${low(frd.blurb ?? frd.en)}. It is specified as its own feature so it can be built, reviewed and released independently.`}

## Requirements

${body}

## Out of scope

- ${frd.outOfScope ?? "Anything that writes to the factory or calls an external service."}`;
}

function blueprintDoc(frd, project) {
  const wos = frd.wos.map((wo) => `- ${woFile(frd, wo).id} — ${wo.title}`).join("\n");
  return `# Blueprint — FRD-${pad(frd.n)} ${frd.en}

## Approach

${frd.blueprintEn ?? `A thin reader in \`${project.srcRoot}/lib\` feeds one server component; client state is limited to what the interaction needs.`}

## Components

- **CMP-${pad(frd.n)}-view** — the screen that renders the feature with the shared primitives.
- **CMP-${pad(frd.n)}-reader** — the typed reader; it returns a result, never a silent empty list.

## Interfaces

- **IF-${pad(frd.n)}-read** — \`read${frd.en.replace(/[^A-Za-z]/g, "")}()\` returns \`{ ok: true, value } | { ok: false, reason }\`.

## Work orders

${wos}`;
}

function adrDoc(adr) {
  return `${frontmatter([["id", `ADR-${pad(adr.n, 4)}`], ["title", adr.title], ["status", "accepted"], ["date", adr.date]])}
# ADR-${pad(adr.n, 4)} — ${adr.title}

## Context

${adr.context}

## Decision

${adr.decision}

## Consequences

${adr.consequences ?? "The choice is reversible at the next version; the blueprint records the migration path."}`;
}

/** A change-queue card (.pandacorp/inbox/changes/), the format readChangeQueue parses. */
function changeDoc(c) {
  const fm = frontmatter([
    ["type", c.type],
    ["class", c.cls ?? "standard"],
    ["status", c.status],
    ["date", c.date],
    ["frd", c.frd ?? ""],
    ["depends_on", c.dependsOn ?? ""],
    ["rebuilds_verified", c.rebuildsVerified ?? false],
    ["implemented_sha", c.status === "done" ? (c.sha ?? "") : ""],
  ]);
  return `${fm}
# ${c.title}

## Qué pasa

${c.what}

## Qué se espera

${c.expect ?? "Que el cambio quede construido con su prueba y documentado en el FRD que toca."}`;
}

/** Track lines the build engine appends (.pandacorp/track.jsonl), derived from WO start/end. */
function trackLines(project) {
  const lines = [];
  for (const frd of project.frds) {
    const timed = frd.wos.filter((wo) => wo.start != null);
    for (const wo of timed) {
      const { id } = woFile(frd, wo);
      lines.push({ at: wo.start, kind: "wo_start", frd: frd.slug, wo: id });
      if (wo.end != null) lines.push({ at: wo.end, kind: "wo_end", frd: frd.slug, wo: id, state: STATUS_TO_FM[wo.state === "done" ? "review" : wo.state] });
    }
    if (frd.review) {
      lines.push({ at: frd.review.start, kind: "review_start", frd: frd.slug });
      lines.push({ at: frd.review.end, kind: "review_end", frd: frd.slug, verdict: frd.review.verdict });
      if (frd.review.verdict === "pass") lines.push({ at: frd.review.end + 60_000, kind: "frd_end", frd: frd.slug });
    }
  }
  return lines
    .sort((a, b) => a.at - b.at || a.kind.localeCompare(b.kind))
    .map(({ at, ...rest }) => JSON.stringify({ kind: rest.kind, frd: rest.frd, ...(rest.wo ? { wo: rest.wo } : {}), ...(rest.state ? { state: rest.state } : {}), ...(rest.verdict ? { verdict: rest.verdict } : {}), at: iso(at) }))
    .join("\n");
}

/** Write one project tree under `root`. */
export function writeProject(root, project) {
  const p = (...parts) => path.join(root, ...parts);
  write(p(".pandacorp", "status.yaml"), project.status);
  if (project.specDigest) write(p(".pandacorp", "comms", "spec-resumen.md"), project.specDigest);
  if (project.archDigest) write(p(".pandacorp", "comms", "arquitectura-resumen.md"), project.archDigest);
  if (project.progress?.length) write(p(".pandacorp", "comms", "progress.md"), `# Bitácora del motor\n\n${project.progress.map((e) => `- ${e}`).join("\n")}`);
  if (project.decisions) write(p(".pandacorp", "inbox", "decisions.md"), project.decisions);
  for (const c of project.changes ?? []) write(p(".pandacorp", "inbox", "changes", ...(c.status === "done" ? ["done"] : []), `${c.id}.md`), changeDoc(c));
  for (const raw of project.rawChanges ?? []) write(p(".pandacorp", "inbox", "changes", raw.file), raw.content);
  if (project.services) write(p(".pandacorp", "accounts", "services.yaml"), JSON.stringify(project.services, null, 2));
  if (project.frds.some((f) => f.wos.some((wo) => wo.start != null))) write(p(".pandacorp", "track.jsonl"), trackLines(project));
  if (project.env) write(p(".env.example"), project.env);
  if (project.model) writeJson(p("docs", "product", "data-model.json"), project.model);
  for (const [rel, body] of Object.entries(project.docs ?? {})) write(p(rel), body);
  for (const adr of project.adrs ?? []) write(p("docs", "adr", `adr-${pad(adr.n, 4)}-${adr.slug}.md`), adrDoc(adr));
  for (const frd of project.frds) {
    const dir = p("docs", "frds", frd.slug);
    write(path.join(dir, "frd.md"), frdDoc(frd));
    if (project.blueprints !== false) write(path.join(dir, "blueprint.md"), blueprintDoc(frd, project));
    if (frd.fdd) write(path.join(dir, "fdd.md"), frd.fdd);
    for (const wo of frd.wos) write(path.join(dir, "work-orders", woFile(frd, wo).file), workOrderDoc(project, frd, wo));
  }
}

/** The ids, verified dates and states the git-state and stats fixtures derive from. */
export function orderFacts(project) {
  return project.frds.flatMap((frd) => frd.wos.map((wo) => ({ id: woFile(frd, wo).id, frd: frd.slug, state: wo.state, end: wo.end ?? null, rel: `docs/frds/${frd.slug}/work-orders/${woFile(frd, wo).file}` })));
}

export const woId = (frd, wo) => woFile(frd, wo).id;
export { y };
