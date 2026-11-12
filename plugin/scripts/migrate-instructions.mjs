#!/usr/bin/env node
// DEC-13: consolidate project instructions before replacing CLAUDE.md with its import shim.
import * as nodeFs from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";

const SHIM = "@AGENTS.md\n";
const MANAGED_IMPORTS = new Set(["@AGENTS.md", "@docs/rules/README.md", "@.pandacorp/guide.md"]);
const lines = text => text.split(/\r?\n/);
// Only live imports are managed. Import-shaped examples in Markdown code belong to the owner.
const ownLines = text => {
  let fence;
  return lines(text).filter(line => {
    if (fence) {
      const close = /^ {0,3}(`{3,}|~{3,})[ \t]*$/.exec(line);
      if (close && close[1][0] === fence[0] && close[1].length >= fence.length) fence = undefined;
      return true;
    }
    // Four spaces or a tab (including a tab after up to three spaces) means indented code.
    if (/^( {4}| {0,3}\t)/.test(line)) return true;
    const open = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (open && (open[1][0] !== "`" || !open[2].includes("`"))) {
      fence = open[1];
      return true;
    }
    return !MANAGED_IMPORTS.has(line.trim());
  });
};
const failure = (code, notes_es, exitCode = 3) => Object.assign(new Error(notes_es), { code, notes_es, exitCode });

/** Line-level loss guard: only managed imports outside Markdown code may disappear. */
export function assertPreserved(oldClaude, nextAgents) {
  const present = new Set(lines(nextAgents));
  const missing = ownLines(oldClaude).filter(line => line.trim() && !present.has(line));
  if (missing.length) throw failure("CONTENT_LOSS", `Migración rechazada: faltan ${missing.length} líneas de CLAUDE.md en AGENTS.md.`);
}

async function inspect(file, fs) {
  let stat;
  try { stat = await fs.lstat(file); }
  catch (error) { if (error.code === "ENOENT") return null; throw error; }
  if (!stat.isFile() || stat.isSymbolicLink()) throw failure("UNSAFE_FILE", `Migración rechazada: ${path.basename(file)} debe ser un archivo normal, sin enlace simbólico.`);
  return { text: await fs.readFile(file, "utf8"), mode: stat.mode & 0o777 };
}

function addNotes(agents, notes) {
  if (!notes.trim() || agents.includes(notes)) return agents;
  const heading = /^## Project notes[ \t]*\r?$/m.exec(agents);
  if (!heading) return `${agents}${agents.endsWith("\n") ? "\n" : "\n\n"}## Project notes\n\n${notes}\n`;
  const start = heading.index + heading[0].length;
  const next = /^## /m.exec(agents.slice(start));
  const offset = next ? start + next.index : agents.length;
  const prefix = agents.slice(0, offset);
  return `${prefix}${prefix.endsWith("\n") ? "\n" : "\n\n"}${notes}\n${next ? "\n" : ""}${agents.slice(offset)}`;
}

/** Plan and apply one project migration. All loss/concurrency checks precede either replacement. */
export async function migrateInstructions({ project, dryRun = false }, { fs = nodeFs } = {}) {
  const dir = path.resolve(project);
  const claudeFile = path.join(dir, "CLAUDE.md");
  const agentsFile = path.join(dir, "AGENTS.md");
  const localFile = path.join(dir, "CLAUDE.local.md");
  const checkLocal = async () => {
    let local;
    try { local = await fs.lstat(localFile); }
    catch (error) { if (error.code !== "ENOENT") throw error; }
    if (local) throw failure("LOCAL_OVERRIDE", "Migración rechazada: existe CLAUDE.local.md y desactiva AGENTS.md según DEC-13. Resuelve ese archivo antes de migrar.");
  };
  await checkLocal();
  const oldClaude = await inspect(claudeFile, fs);
  const oldAgents = await inspect(agentsFile, fs);
  if (!oldClaude && !oldAgents) throw failure("NO_INSTRUCTIONS", "Migración rechazada: no existe CLAUDE.md ni AGENTS.md.");
  const notes = ownLines(oldClaude?.text || "").join("\n").replace(/^\n+|\n+$/g, "");
  const nextAgents = addNotes(oldAgents?.text ?? "# Project instructions\n", notes);
  assertPreserved(oldClaude?.text || "", nextAgents);
  const moves = notes.trim() && nextAgents !== oldAgents?.text ? ["CLAUDE.md -> AGENTS.md: ## Project notes"] : [];
  const changes = [];
  if (nextAgents !== oldAgents?.text) changes.push({ file: agentsFile, text: nextAgents, mode: oldAgents?.mode ?? 0o644 });
  if (oldClaude?.text !== SHIM) changes.push({ file: claudeFile, text: SHIM, mode: oldClaude?.mode ?? 0o644 });
  const result = {
    ok: true, project: dir, dry_run: dryRun, changed: changes.length > 0,
    moves, files: changes.map(change => path.basename(change.file)),
    preserved_lines: ownLines(oldClaude?.text || "").filter(line => line.trim()).length,
    notes_es: changes.length ? "Instrucciones consolidadas en AGENTS.md; CLAUDE.md queda como importación de una línea." : "Las instrucciones ya están consolidadas en AGENTS.md.",
  };
  // Recheck before writing, so a concurrent owner edit cannot be replaced by the shim.
  const checkSources = async () => {
    await checkLocal();
    for (const [file, old] of [[claudeFile, oldClaude], [agentsFile, oldAgents]]) {
      const current = await inspect(file, fs);
      if (current?.text !== old?.text) throw failure("SOURCE_CHANGED", "Migración rechazada: las instrucciones cambiaron durante la lectura. Reintenta con el proyecto en reposo.");
    }
  };
  await checkSources();
  if (dryRun || !changes.length) return result;
  const staged = [];
  try {
    for (const change of changes) {
      const tmp = `${change.file}.migrate-${randomBytes(8).toString("hex")}`;
      staged.push({ ...change, tmp });
      await fs.writeFile(tmp, change.text, { flag: "wx", mode: change.mode });
      if (change.file === agentsFile) assertPreserved(oldClaude?.text || "", await fs.readFile(tmp, "utf8"));
    }
    await checkSources();
    // AGENTS is installed first: even if replacing CLAUDE fails, its owner text is safe in both places.
    for (const change of staged) await fs.rename(change.tmp, change.file);
  } finally {
    for (const change of staged) await fs.rm(change.tmp, { force: true });
  }
  return result;
}

async function main(argv) {
  let project;
  let dryRun = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--dry-run" && !dryRun) dryRun = true;
    else if (argv[i] === "--project" && !project && argv[i + 1] && !argv[i + 1].startsWith("--")) project = argv[++i];
    else throw failure("USAGE", "Uso: migrate-instructions.mjs --project <directorio> [--dry-run]", 2);
  }
  if (!project) throw failure("USAGE", "Falta --project <directorio>.", 2);
  return migrateInstructions({ project, dryRun });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(JSON.stringify(await main(process.argv.slice(2)))); }
  catch (error) {
    console.log(JSON.stringify({ ok: false, code: error.code || "MIGRATION_ERROR", notes_es: error.notes_es || "No se pudo migrar. Revisa los permisos y los archivos de instrucciones." }));
    process.exitCode = error.exitCode || 3;
  }
}
