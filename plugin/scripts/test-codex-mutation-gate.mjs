#!/usr/bin/env node
import { chmod, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";

const root = path.resolve(new URL("../..", import.meta.url).pathname);
const runner = path.join(root, "plugin/scripts/run-frd-mutation-gate.mjs");
const run = (cwd, cmd, args) => new Promise((resolve) => { const child = spawn(cmd, args, { cwd, stdio: ["ignore", "pipe", "pipe"] }); let out="",err=""; child.stdout.on("data",d=>out+=d); child.stderr.on("data",d=>err+=d); child.on("close",code=>resolve({code,out,err})); });
const must = (value, message) => { if (!value) throw new Error(message); };
async function fixture(verify) {
  const project = await mkdtemp(path.join(os.tmpdir(), "pc-mutation-gate-")); await mkdir(path.join(project,".pandacorp")); await mkdir(path.join(project,"src"));
  await writeFile(path.join(project,".pandacorp/verify.sh"),`#!/bin/sh\n${verify}\n`); await chmod(path.join(project,".pandacorp/verify.sh"),0o755);
  await writeFile(path.join(project,"src/add.js"),"export const add = (a, b) => a + b;\n");
  for (const args of [["init","-q"],["config","user.email","mutation@example.invalid"],["config","user.name","Mutation"],["add","-A"],["commit","-qm","feat: add"]]) must((await run(project,"git",args)).code===0,`git ${args[0]} failed`);
  const sha=(await run(project,"git",["rev-parse","HEAD"])).out.trim(); return {project,sha};
}
async function check(name, verify, expectedCode, expectedPattern, timeout="5000") {
  const fx=await fixture(verify); const beforeStatus=(await run(fx.project,"git",["status","--porcelain=v1","-z"])).out; const beforeTrees=(await run(fx.project,"git",["worktree","list","--porcelain"])).out;
  const result=await run(fx.project,"node",[runner,"--project",fx.project,"--frd","frd-test","--commits",fx.sha,"--timeout-ms",timeout]);
  must(result.code===expectedCode,`${name}: exit ${result.code}\n${result.out}\n${result.err}`); must(expectedPattern.test(`${result.out}\n${result.err}`),`${name}: unexpected evidence\n${result.out}\n${result.err}`);
  must((await readFile(path.join(fx.project,"src/add.js"),"utf8"))==="export const add = (a, b) => a + b;\n",`${name}: main source changed`);
  must((await run(fx.project,"git",["status","--porcelain=v1","-z"])).out===beforeStatus,`${name}: main status changed`); must((await run(fx.project,"git",["worktree","list","--porcelain"])).out===beforeTrees,`${name}: temp worktree leaked`);
  console.log(`PASS  ${name}`);
}

await check("kills a real operator mutant in an isolated worktree","grep -q 'a + b' src/add.js",0,/"verdict":"green"/);
await check("rejects a red baseline before scoring mutants","exit 1",2,/baseline verifier is red/);
await check("fails closed when the verifier lets mutants survive","exit 0",2,/below 60%/);
await check("contains verifier side effects inside the disposable worktree","echo rogue > rogue-source.js\ngrep -q 'a + b' src/add.js",0,/"verdict":"green"/);
await check("TERM/KILLs a stubborn verifier group and removes the worktree","trap '' TERM\nsleep 5 & wait",2,/timed out/,"1000");
console.log("RESULT: 5 passed, 0 failed");
