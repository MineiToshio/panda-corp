#!/usr/bin/env node
import { spawn } from "node:child_process";
import { lstat, mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const arg = (name) => { const i = process.argv.indexOf(`--${name}`); return i < 0 ? "" : process.argv[i + 1] || ""; };
const project = await realpath(path.resolve(arg("project") || ".")).catch(() => ""); const frd = arg("frd");
const commits = arg("commits").split(",").filter((sha) => /^[0-9a-f]{7,40}$/.test(sha)); const timeoutMs = Number(arg("timeout-ms") || 600000);
const fail = (message) => { process.stderr.write(`mutation gate: ${message}\n`); process.exit(2); };
if (!project || !/^frd-[a-z0-9-]+$/.test(frd) || !commits.length || !Number.isSafeInteger(timeoutMs) || timeoutMs < 1000) fail("canonical project, FRD, implementation commits and timeout are required");
const run = (cwd, cmd, args, limit = 0) => new Promise((resolve) => { const child = spawn(cmd, args, { cwd, stdio: ["ignore", "pipe", "pipe"], detached: Boolean(limit) && process.platform !== "win32" }); let out = "", err = "", timedOut = false, closed = false, code = null, signal = null; child.stdout.on("data", (v) => out += v); child.stderr.on("data", (v) => err += v); const killTree=(sig)=>{try{if(process.platform!=="win32"&&limit)process.kill(-child.pid,sig);else child.kill(sig);}catch{}}; const finish=()=>{if(closed&&(!timedOut||killDone)){resolve({code,signal,out,err,timedOut});}}; let killDone=false; const timer = limit ? setTimeout(() => { timedOut = true; killTree("SIGTERM"); setTimeout(()=>{killTree("SIGKILL");killDone=true;finish();},300); }, limit) : null; child.on("close", (c, s) => { closed=true;code=c;signal=s;if(timer&&!timedOut)clearTimeout(timer);finish(); }); child.on("error", (error) => { closed=true;err=error.message;killDone=true;finish(); }); });
const statusBefore = (await run(project, "git", ["status", "--porcelain=v1", "-z"])).out;
const changed = new Set(); for (const sha of commits) { const shown = await run(project, "git", ["show", "--pretty=", "--name-only", "-z", sha]); if (shown.code) fail("cannot resolve implementation commit paths"); for (const file of shown.out.split("\0").filter(Boolean)) changed.add(file); }
const candidates = [...changed].filter((file) => /\.(?:[cm]?[jt]sx?|py|rb|go|rs|java|kt|swift)$/i.test(file) && !/(^|\/)(tests?|__tests__|e2e)(\/|$)|\.(?:test|spec)\./i.test(file));
const worktree = await mkdtemp(path.join(os.tmpdir(), "pandacorp-mutation-")); let attached = false; let fatal = ""; let killed = 0, survived = 0;
const mutations = [[/===/, "!=="], [/!==/, "==="], [/\btrue\b/, "false"], [/\bfalse\b/, "true"], [/&&/, "||"], [/\|\|/, "&&"], [/(?<!\+)\+(?![+=])/, "-"], [/(?<!-)\-(?![-=>])/, "+"], [/>=/, "<"], [/<=/, ">"]];
try {
  const added = await run(project, "git", ["worktree", "add", "--detach", worktree, "HEAD"]); if (added.code) throw new Error(`cannot create isolated mutation worktree: ${added.err}`); attached = true;
  const deps = path.join(project, "node_modules"); if (await lstat(deps).then((e) => e.isDirectory() && !e.isSymbolicLink()).catch(() => false)) await symlink(deps, path.join(worktree, "node_modules"), "dir");
  const baseline = await run(worktree, "bash", [".pandacorp/verify.sh"], timeoutMs); if (baseline.timedOut) throw new Error("baseline verifier timed out"); if (baseline.code !== 0 || baseline.signal) throw new Error("baseline verifier is red; mutation score is invalid");
  outer: for (const file of candidates) {
    const absolute = path.join(worktree, file); const entry = await lstat(absolute).catch(() => null); if (!entry?.isFile() || entry.isSymbolicLink()) continue; const original = await readFile(absolute, "utf8");
    for (const [pattern, replacement] of mutations) { if (!pattern.test(original)) continue; await writeFile(absolute, original.replace(pattern, replacement)); const result = await run(worktree, "bash", [".pandacorp/verify.sh"], timeoutMs); await writeFile(absolute, original); if (result.timedOut) { fatal = "mutation verifier timed out"; break outer; } if (result.code === 0 && !result.signal) survived++; else killed++; if (killed + survived >= 5) break outer; }
  }
} catch (error) { fatal = error.message; }
finally { if (attached) { const removed = await run(project, "git", ["worktree", "remove", "--force", worktree]); if (removed.code) fatal = `${fatal ? `${fatal}; ` : ""}cannot remove isolated mutation worktree`; } await rm(worktree,{recursive:true,force:true}); }
const statusAfter = (await run(project, "git", ["status", "--porcelain=v1", "-z"])).out; if (statusAfter !== statusBefore) fail("isolated mutation gate changed the main checkout"); if (fatal) fail(fatal);
const total = killed + survived; if (!total) { process.stdout.write(`${JSON.stringify({ schema: 1, frd, verdict: "green", not_applicable: true, reason: "no mutable production logic in the FRD implementation delta", killed: 0, survived: 0, total: 0, score: 100 })}\n`); process.exit(0); }
const score = killed / total * 100; if (score < 60) fail(`mutation score ${score.toFixed(2)} is below 60% (${survived} survivor(s))`);
process.stdout.write(`${JSON.stringify({ schema: 1, frd, verdict: "green", not_applicable: false, killed, survived, total, score })}\n`);
