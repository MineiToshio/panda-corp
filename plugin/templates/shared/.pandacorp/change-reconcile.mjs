#!/usr/bin/env node
// change-reconcile.mjs — keeps the change queue (.pandacorp/inbox/changes/) equal to reality (DR-147, BL-0307).
//
// A card is the owner's request; the work that answers it can land through ANY door (the build engine, a
// direct chat session, a launch plan's WOs, an owner decision that makes it moot). This script reads the
// durable traces those doors leave and closes or flags the cards they answer. Deterministic: git + files,
// no model, no network.
//
// Evidence ladder — a status changes ONLY on strong, explicit links; anything weaker is a flag:
//   STRONG (applied by --apply)
//     T1  a commit reachable from the default branch carries the trailer `Change: <slug>`      → done
//     T2  a commit reachable from the default branch carries `Supersedes-Change: <slug>`        → discarded
//     T3  ≥1 work order declares `source_change: <slug>` and every such WO is VERIFIED          → done
//   WEAK (flag only: `stale_suspect` frontmatter; Mission Control shows it as "¿Ya hecho?", the build
//        never drains it, the owner decides)
//     W1  the slug is named in a commit message (not as a trailer) or in docs/decision-log.md
//     W2  every WO of the card's FRDs is VERIFIED and at least one of them was added on/after the card date
//   HINT (`stale_hint` frontmatter: the card STAYS ready/drainable; Mission Control marks it "¿ya hecho?")
//     H1  the frd.md of one of the card's FRDs changed on/after the card date (its contract moved). Too
//         noisy to hide a card on (an unrelated change to the same feature also moves it), measured on
//         funko-tracker 2026-11-10: it caught both direct-chat cards but also 3 genuinely pending ones.
// Only `ready`/`draft` cards are reconciled; `building`/`closing` belong to the engine / sync close-out.
// Cards are MOVED to done/, never deleted (the inbox is gitignored: a delete is permanent loss).
//
// Usage (run from the project's MAIN checkout — the inbox lives only there):
//   node .pandacorp/change-reconcile.mjs                 report (read-only; exit 0)
//   node .pandacorp/change-reconcile.mjs --apply         close strong, flag weak, clear vanished flags
//   node .pandacorp/change-reconcile.mjs --json          machine-readable report (combinable with --apply)
//   node .pandacorp/change-reconcile.mjs --confirm-done <slug> --evidence "<text>"   owner confirms shipped
//   node .pandacorp/change-reconcile.mjs --supersede <slug> --reason "<text>"        owner says obsolete
//   node .pandacorp/change-reconcile.mjs --dismiss <slug>    owner says still pending: clears a flag or a hint
//                                                            (it comes back only on NEW evidence)
// Options: --project <dir> (default cwd) · --ref <git ref> (default main|master|HEAD) · --in-build (the
// build engine itself is calling; otherwise writes are refused while a build is live).
// Exit: 0 ok · 2 usage · 3 refused (live build) · 4 a card could not be written (reported, others proceed).
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

const RECONCILED = new Set(["ready", "draft"]);
const BUILD_TTL_MS = 10 * 60 * 1000;

function parseArgs(argv) {
  const opts = { project: process.cwd(), apply: false, json: false, inBuild: false };
  const valued = { "--project": "project", "--ref": "ref", "--confirm-done": "confirm", "--supersede": "supersede", "--dismiss": "dismiss", "--evidence": "evidence", "--reason": "reason" };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--apply") opts.apply = true;
    else if (arg === "--json") opts.json = true;
    else if (arg === "--in-build") opts.inBuild = true;
    else if (valued[arg] && argv[i + 1] !== undefined) opts[valued[arg]] = argv[++i];
    else throw usage(`unknown or incomplete argument: ${arg}`);
  }
  for (const key of ["confirm", "supersede", "dismiss"]) if (opts[key] !== undefined && !/^[a-z0-9][a-z0-9-]*$/.test(opts[key])) throw usage(`invalid slug: ${opts[key]}`);
  if (opts.confirm && !opts.evidence?.trim()) throw usage("--confirm-done needs --evidence");
  if (opts.supersede && !opts.reason?.trim()) throw usage("--supersede needs --reason");
  return opts;
}
const usage = (message) => Object.assign(new Error(message), { exit: 2 });

// ── frontmatter (line-based: the cards are flat key: value YAML; we never reflow the body) ──────────
function splitCard(raw) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---(\r?\n|$)/.exec(raw);
  if (!m) return null;
  return { fm: m[1], rest: raw.slice(m[0].length), nl: raw.includes("\r\n") ? "\r\n" : "\n" };
}
function fmGet(fm, key) {
  const m = new RegExp(`^${key}:[ \\t]*(.*)$`, "m").exec(fm);
  if (!m) return "";
  return m[1].replace(/\s+#.*$/, "").trim().replace(/^(["'])(.*)\1$/, "$2");
}
function fmList(fm, key) {
  return fmGet(fm, key).replace(/^\[|\]$/g, "").split(",").map((s) => s.trim().replace(/^(["'])(.*)\1$/, "$2")).filter(Boolean);
}
function fmSet(fm, key, value, nl) {
  const line = `${key}: ${value}`;
  const re = new RegExp(`^${key}:.*$`, "m");
  return re.test(fm) ? fm.replace(re, line) : `${fm}${nl}${line}`;
}
const fmDel = (fm, key) => fm.replace(new RegExp(`^${key}:.*(\\r?\\n|$)`, "m"), "").replace(/\r?\n$/, "");
const quote = (s) => JSON.stringify(String(s).replace(/\s+/g, " ").trim().slice(0, 300));

// ── git ─────────────────────────────────────────────────────────────────────────────────────────────
function git(project, args) {
  return execFileSync("git", args, { cwd: project, encoding: "utf8", maxBuffer: 256 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
}
function resolveRef(project, ref) {
  if (ref) return ref;
  for (const candidate of ["refs/heads/main", "refs/heads/master"]) {
    try { git(project, ["rev-parse", "--verify", "--quiet", candidate]); return candidate; } catch { /* try next */ }
  }
  return "HEAD";
}
// One pass over history: every commit with its short sha, day, subject and full body.
function readCommits(project, ref) {
  let out = "";
  try { out = git(project, ["log", ref, "--format=%h%x1f%cs%x1f%s%x1f%B%x1e"]); } catch { return []; }
  return out.split("\x1e").map((rec) => rec.replace(/^\n/, "")).filter(Boolean).map((rec) => {
    const [sha, day, subject, body] = rec.split("\x1f");
    return { sha, day, subject, body: body ?? "" };
  });
}
// The day each path first entered history, and the days it changed (cheap per FRD; few FRDs per card).
function pathDays(project, ref, relPath, { added = false } = {}) {
  try {
    const args = ["log", ref, "--format=%cs", ...(added ? ["--diff-filter=A"] : []), "--", relPath];
    return git(project, args).split("\n").filter(Boolean);
  } catch { return []; }
}
const TRAILER = (key) => new RegExp(`^${key}:[ \\t]*([a-z0-9][a-z0-9-]*)[ \\t]*$`, "gim");

// ── project state ───────────────────────────────────────────────────────────────────────────────────
function buildIsLive(project) {
  const file = path.join(project, ".pandacorp/status.yaml");
  if (!existsSync(file)) return false;
  const yaml = readFileSync(file, "utf8");
  const running = /^running:[ \t]*([^\s#]*)/m.exec(yaml)?.[1];
  if (running !== "true") return false;
  const stamps = ["supervisor_heartbeat", "last_event_at"].map((key) => Date.parse((new RegExp(`^${key}:[ \\t]*["']?([^"'\\s#]*)`, "m").exec(yaml) ?? [])[1] ?? ""));
  const fresh = stamps.filter(Number.isFinite);
  return fresh.length === 0 || fresh.some((ms) => Date.now() - ms < BUILD_TTL_MS);
}
function readWorkOrders(project) {
  const root = path.join(project, "docs/frds");
  const all = [];
  if (!existsSync(root)) return all;
  for (const frd of readdirSync(root)) {
    const dir = path.join(root, frd, "work-orders");
    if (!/^frd-/.test(frd) || !existsSync(dir)) continue;
    for (const name of readdirSync(dir)) {
      if (!/^wo-.*\.md$/.test(name)) continue;
      const split = splitCard(readFileSync(path.join(dir, name), "utf8"));
      if (!split) continue;
      all.push({ frd, rel: `docs/frds/${frd}/work-orders/${name}`, status: fmGet(split.fm, "implementation_status"), sourceChanges: fmList(split.fm, "source_change") });
    }
  }
  return all;
}
function readCards(project) {
  const dir = path.join(project, ".pandacorp/inbox/changes");
  if (!existsSync(dir)) return [];
  const cards = [];
  for (const name of readdirSync(dir).sort()) {
    if (!/^[a-z0-9][a-z0-9-]*\.md$/.test(name) || name === "README.md") continue;
    const file = path.join(dir, name);
    if (!lstatSync(file).isFile()) continue;
    const raw = readFileSync(file, "utf8");
    const split = splitCard(raw);
    if (!split) continue;
    const frds = [...new Set([...fmList(split.fm, "frd"), ...fmList(split.fm, "affected_frds")])].filter((f) => /^frd-[a-z0-9-]+$/.test(f));
    cards.push({ slug: name.slice(0, -3), file, raw, ...split, status: fmGet(split.fm, "status"), date: fmGet(split.fm, "date").slice(0, 10), frds, flagged: fmGet(split.fm, "stale_suspect"), hinted: fmGet(split.fm, "stale_hint"), dismissed: fmGet(split.fm, "stale_dismissed") });
  }
  return cards;
}

// ── evidence ────────────────────────────────────────────────────────────────────────────────────────
function assess(card, ctx) {
  if (!RECONCILED.has(card.status)) return { verdict: "owned", evidence: [] };
  const done = ctx.doneTrailers.get(card.slug);
  if (done) return { verdict: "done", sha: done.sha, evidence: [`commit ${done.sha} carries "Change: ${card.slug}" (${done.subject})`] };
  const sup = ctx.supersedeTrailers.get(card.slug);
  if (sup) return { verdict: "superseded", sha: sup.sha, evidence: [`commit ${sup.sha} carries "Supersedes-Change: ${card.slug}" (${sup.subject})`] };
  const linked = ctx.workOrders.filter((wo) => wo.sourceChanges.includes(card.slug));
  if (linked.length && linked.every((wo) => wo.status === "VERIFIED")) {
    const sha = ctx.lastTouch(linked.map((wo) => wo.rel));
    return { verdict: "done", sha, evidence: [`its ${linked.length} work order(s) with source_change: ${card.slug} are all VERIFIED (${linked.map((wo) => path.basename(wo.rel, ".md")).join(", ")})`] };
  }
  const weak = [];
  const mention = new RegExp(`(^|[^a-z0-9-])${card.slug}([^a-z0-9-]|$)`, "i");
  const named = ctx.commits.find((c) => mention.test(c.body.replace(TRAILER("(?:Change|Supersedes-Change)"), "")) || mention.test(c.subject));
  if (named) weak.push(`commit ${named.sha} names this card (${named.subject})`);
  if (mention.test(ctx.decisionLog)) weak.push("docs/decision-log.md names this card");
  if (card.date && card.frds.length) {
    const wos = ctx.workOrders.filter((wo) => card.frds.includes(wo.frd));
    const added = wos.filter((wo) => ctx.addedDay(wo.rel) >= card.date);
    if (wos.length && wos.every((wo) => wo.status === "VERIFIED") && added.length)
      weak.push(`every work order of ${card.frds.join(", ")} is VERIFIED and ${added.length} of them were planned on/after the card (${card.date})`);
  }
  const hints = [];
  if (card.date && card.frds.length) {
    const moved = card.frds.filter((frd) => ctx.changedDays(`docs/frds/${frd}/frd.md`).some((day) => day >= card.date));
    if (moved.length) hints.push(`the contract of ${moved.join(", ")} (frd.md) changed on/after the card (${card.date})`);
  }
  const evidence = weak.length ? weak : hints;
  if (!evidence.length) return { verdict: "pending", evidence: [] };
  const fingerprint = createHash("sha256").update(evidence.join("\n")).digest("hex").slice(0, 12);
  if (card.dismissed === fingerprint) return { verdict: "pending", evidence: [], dismissedFingerprint: fingerprint };
  return { verdict: weak.length ? "suspect" : "hint", evidence, fingerprint };
}

function buildContext(project, ref) {
  const commits = readCommits(project, ref);
  const doneTrailers = new Map();
  const supersedeTrailers = new Map();
  for (const c of commits) { // newest first: keep the first (latest) hit
    for (const m of c.body.matchAll(TRAILER("(?:Closes-)?Change"))) if (!doneTrailers.has(m[1].toLowerCase())) doneTrailers.set(m[1].toLowerCase(), c);
    for (const m of c.body.matchAll(TRAILER("Supersedes-Change"))) if (!supersedeTrailers.has(m[1].toLowerCase())) supersedeTrailers.set(m[1].toLowerCase(), c);
  }
  const memo = new Map();
  const cached = (key, fn) => (memo.has(key) ? memo.get(key) : memo.set(key, fn()).get(key));
  const decisionFile = path.join(project, "docs/decision-log.md");
  return {
    commits, doneTrailers, supersedeTrailers,
    workOrders: readWorkOrders(project),
    decisionLog: existsSync(decisionFile) ? readFileSync(decisionFile, "utf8") : "",
    addedDay: (rel) => cached(`a:${rel}`, () => pathDays(project, ref, rel, { added: true }).at(-1) ?? ""),
    changedDays: (rel) => cached(`c:${rel}`, () => pathDays(project, ref, rel)),
    lastTouch: (rels) => { try { return git(project, ["log", "-1", ref, "--format=%h", "--", ...rels]).trim(); } catch { return ""; } },
  };
}

// ── writes ──────────────────────────────────────────────────────────────────────────────────────────
const today = () => new Date().toISOString().slice(0, 10);
function writeCard(card, fm) { writeFileSync(card.file, `---${card.nl}${fm}${card.nl}---${card.nl}${card.rest}`); }
function archive(project, card, { sha, evidence, closedBy }) {
  const doneDir = path.join(path.dirname(card.file), "done");
  const target = path.join(doneDir, path.basename(card.file));
  if (existsSync(target)) throw new Error(`done/${path.basename(card.file)} already exists`);
  let fm = card.fm;
  for (const key of ["stale_suspect", "stale_fingerprint", "stale_hint", "stale_dismissed"]) fm = fmDel(fm, key);
  fm = fmSet(fm, "status", "done", card.nl);
  fm = fmSet(fm, "shipped_sha", quote(sha || "unknown"), card.nl);
  fm = fmSet(fm, "shipped_at", quote(today()), card.nl);
  fm = fmSet(fm, "closed_by", quote(closedBy), card.nl);
  fm = fmSet(fm, "closed_evidence", quote(evidence), card.nl);
  if (!existsSync(doneDir)) execFileSync("mkdir", [doneDir]);
  writeCard(card, fm);
  renameSync(card.file, target); // a move, never a delete
  updateIndex(project, card.slug, "done", true);
}
function supersede(project, card, { sha, reason, closedBy }) {
  let fm = card.fm;
  for (const key of ["stale_suspect", "stale_fingerprint", "stale_hint", "stale_dismissed"]) fm = fmDel(fm, key);
  fm = fmSet(fm, "status", "discarded", card.nl);
  fm = fmSet(fm, "status_before_discard", card.status, card.nl);
  fm = fmSet(fm, "discard_reason", quote(reason), card.nl);
  if (sha) fm = fmSet(fm, "superseded_by", quote(sha), card.nl);
  fm = fmSet(fm, "closed_by", quote(closedBy), card.nl);
  writeCard(card, fm);
  updateIndex(project, card.slug, "discarded", false);
}
function setFlag(card, assessment) {
  let fm = fmSet(fmDel(card.fm, "stale_hint"), "stale_suspect", quote(assessment.evidence.join("; ")), card.nl);
  fm = fmSet(fm, "stale_fingerprint", quote(assessment.fingerprint), card.nl);
  if (fm !== card.fm) writeCard(card, fm);
}
function setHint(card, assessment) {
  const fm = fmSet(fmDel(fmDel(card.fm, "stale_suspect"), "stale_fingerprint"), "stale_hint", quote(assessment.evidence.join("; ")), card.nl);
  if (fm !== card.fm) writeCard(card, fm);
}
function clearFlag(card) {
  const fm = fmDel(fmDel(fmDel(card.fm, "stale_suspect"), "stale_fingerprint"), "stale_hint");
  if (fm !== card.fm) writeCard(card, fm);
}
// Best-effort: keep the human README index in step (link into done/, status cell).
function updateIndex(project, slug, status, moved) {
  const file = path.join(project, ".pandacorp/inbox/changes/README.md");
  if (!existsSync(file)) return;
  const lines = readFileSync(file, "utf8").split("\n");
  let touched = false;
  const out = lines.map((line) => {
    if (!line.startsWith("|") || !(line.includes(`(${slug}.md)`) || line.includes(`| ${slug} |`))) return line;
    touched = true;
    let next = moved ? line.replace(`(${slug}.md)`, `(done/${slug}.md)`) : line;
    return next.replace(/\|\s*(ready|draft)\s*\|\s*$/, `| ${status} |`);
  });
  if (touched) writeFileSync(file, out.join("\n"));
}

// ── main ────────────────────────────────────────────────────────────────────────────────────────────
function main() {
  const opts = parseArgs(process.argv.slice(2));
  const project = path.resolve(opts.project);
  const ref = resolveRef(project, opts.ref);
  const writes = opts.apply || opts.confirm || opts.supersede || opts.dismiss;
  if (writes && !opts.inBuild && buildIsLive(project)) {
    console.error("change-reconcile: a build is live (status.yaml running: true, fresh heartbeat) — the engine is the queue's writer; nothing changed. Re-run after it ends.");
    return 3;
  }
  const cards = readCards(project);
  const owner = opts.confirm || opts.supersede || opts.dismiss;
  if (owner) {
    const card = cards.find((c) => c.slug === owner);
    if (!card) throw usage(`no active card ${owner}.md in .pandacorp/inbox/changes/`);
    if (!RECONCILED.has(card.status)) throw usage(`${owner} is ${card.status}; only ready/draft cards are reconciled here`);
    if (opts.confirm) archive(project, card, { sha: "", evidence: `owner confirmed: ${opts.evidence}`, closedBy: "owner" });
    else if (opts.supersede) supersede(project, card, { sha: "", reason: `owner: ${opts.reason}`, closedBy: "owner" });
    else {
      const a = assess(card, buildContext(project, ref));
      if (a.verdict !== "suspect" && a.verdict !== "hint") throw usage(`${owner} is not flagged (${a.verdict}); nothing to dismiss`);
      writeCard(card, fmSet(fmDel(fmDel(fmDel(card.fm, "stale_suspect"), "stale_fingerprint"), "stale_hint"), "stale_dismissed", quote(a.fingerprint), card.nl));
    }
    console.log(`change-reconcile: ${owner} → ${opts.confirm ? "done/" : opts.supersede ? "discarded" : "flag dismissed"}`);
    return 0;
  }
  const ctx = buildContext(project, ref);
  const report = [];
  let failed = 0;
  for (const card of cards) {
    const a = assess(card, ctx);
    const row = { slug: card.slug, status: card.status, verdict: a.verdict, evidence: a.evidence, action: "none" };
    if (opts.apply) {
      try {
        if (a.verdict === "done") { archive(project, card, { sha: a.sha, evidence: a.evidence.join("; "), closedBy: "change-reconcile" }); row.action = "archived"; }
        else if (a.verdict === "superseded") { supersede(project, card, { sha: a.sha, reason: a.evidence.join("; "), closedBy: "change-reconcile" }); row.action = "discarded"; }
        else if (a.verdict === "suspect") { setFlag(card, a); row.action = "flagged"; }
        else if (a.verdict === "hint") { setHint(card, a); row.action = card.flagged ? "flag→hint" : "hinted"; }
        else if (a.verdict === "pending" && (card.flagged || card.hinted)) { clearFlag(card); row.action = "unflagged"; }
      } catch (error) { failed++; row.action = "error"; row.error = error.message; }
    }
    report.push(row);
  }
  if (opts.json) console.log(JSON.stringify({ ref, apply: opts.apply, cards: report }, null, 2));
  else {
    const interesting = report.filter((r) => r.verdict !== "pending" && r.verdict !== "owned" || r.action !== "none");
    console.log(`change-reconcile: ${cards.length} active card(s) on ${ref}; ${interesting.length} need attention${opts.apply ? "" : " (report only — --apply to act)"}`);
    for (const r of interesting) console.log(`  ${r.verdict.padEnd(10)} ${r.slug}${r.action !== "none" ? ` [${r.action}]` : ""}${r.evidence.length ? ` — ${r.evidence.join("; ")}` : ""}${r.error ? ` — ${r.error}` : ""}`);
  }
  return failed ? 4 : 0;
}

try { process.exitCode = main(); }
catch (error) { console.error(`change-reconcile: ${error.message}`); process.exitCode = error.exit ?? 1; }
