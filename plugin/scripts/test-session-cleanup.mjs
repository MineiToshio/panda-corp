#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync, copyFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { create, register, finish } from './session-cleanup.mjs';
const tmp = realpathSync(mkdtempSync(path.join(os.tmpdir(), 'cleanup-test-')));
const repo = path.join(tmp, 'repo'); mkdirSync(repo);
const env = { ...process.env, GIT_AUTHOR_NAME:'test', GIT_AUTHOR_EMAIL:'test@example.org', GIT_COMMITTER_NAME:'test', GIT_COMMITTER_EMAIL:'test@example.org' };
const git = (cwd, ...args) => { const r = spawnSync('git', args, { cwd, env, encoding:'utf8' }); assert.equal(r.status, 0, r.stderr); return r.stdout.trim(); };
let count=0; const check = (x, msg) => { assert.ok(x,msg); count++; console.log(`ok ${count} - ${msg}`); };
const sessions=[];
try {
  git(repo,'init','-qb','main'); writeFileSync(path.join(repo,'.gitignore'),'node_modules/\n.next/\n.pandacorp/\n'); git(repo,'add','.'); git(repo,'commit','-qm','base');
  const wt = name => { const p=path.join(tmp,name); git(repo,'worktree','add','-qb',name,p); return p; };
  const merged=wt('merged'), dirty=wt('dirty'), unmerged=wt('unmerged'), other=wt('other-session'), locked=wt('locked'), owner=wt('owner'), index=wt('index-lock');
  writeFileSync(path.join(unmerged,'feature'),'unmerged'); git(unmerged,'add','.'); git(unmerged,'commit','-qm','feature');
  writeFileSync(path.join(dirty,'untracked'),'keep'); git(repo,'worktree','lock',locked);
  mkdirSync(path.join(owner,'.pandacorp/run'),{recursive:true}); writeFileSync(path.join(owner,'.pandacorp/run/evidence'),'keep');
  const gd=git(index,'rev-parse','--absolute-git-dir'); writeFileSync(path.join(gd,'index.lock'),'worker');
  for(const dir of ['node_modules','.next']) {mkdirSync(path.join(merged,dir)); writeFileSync(path.join(merged,dir,'cache'),'generated');}
  const session=await create(repo); sessions.push(session.root);
  for(const target of [merged,dirty,unmerged,locked,owner,index]) await register(session.root,target);
  writeFileSync(path.join(session.root,'artifacts/log'),'owned');
  const dry=await finish(session.root,{dryRun:true,self:repo});
  check(dry.removed.some(x=>x.path===merged)&&existsSync(merged),'dry run reports merged recent target without deleting');
  const result=await finish(session.root,{self:repo});
  check(!existsSync(merged),'removes complete merged clean worktree including ignored node_modules/.next');
  for(const [p,why] of [[dirty,'dirty'],[unmerged,'unmerged'],[locked,'locked'],[owner,'owner state'],[index,'index.lock']]) check(existsSync(p)&&result.kept.some(x=>x.path===p),`retains ${why}`);
  check(existsSync(other),'never removes unregistered parallel session even merged clean');
  check(existsSync(path.join(session.root,'artifacts/log')),'retains artifacts when work is pending');
  check(existsSync(path.join(gd,'index.lock')),'never removes lock files');
  const clean=await create(repo); sessions.push(clean.root); const done=wt('done'); await register(clean.root,done); writeFileSync(path.join(clean.root,'artifacts/log'),'log');
  const doneResult=await finish(clean.root,{self:repo}); check(doneResult.artifactsRemoved&&!existsSync(clean.root)&&!existsSync(done),'successful close removes owned artifacts and empty receipt container');
  check(git(repo,'rev-parse','--verify','done')!=='','retains branch refs (no branch -D)');
  const self=await create(repo); sessions.push(self.root); const own=wt('self');await register(self.root,own);const kept=await finish(self.root,{self:own});check(kept.kept[0].reason==='self'&&existsSync(own),'never deletes invoking session cwd');
  const invalid=await create(repo);sessions.push(invalid.root);mkdirSync(path.join(invalid.root,'artifacts/.git'));await assert.rejects(finish(invalid.root,{self:repo}),/protected or unregistered/);check(existsSync(invalid.root),'unregistered repository copies in tmp are preserved');
  check(readFileSync(path.join(gd,'index.lock'),'utf8')==='worker','lock contents untouched');
  const outputs=await create(repo);sessions.push(outputs.root);const outputWt=wt('generated-output');
  writeFileSync(path.join(repo,'.git/info/exclude'),'.env.local\n.claude/launch.json\n');
  mkdirSync(path.join(outputWt,'.claude'));writeFileSync(path.join(outputWt,'.claude/launch.json'),'{}');writeFileSync(path.join(outputWt,'.env.local'),'SYNTHETIC=generated');
  await register(outputs.root,outputWt,{generatedFiles:['.claude/launch.json','.env.local']});
  writeFileSync(path.join(outputWt,'.env.local'),'SYNTHETIC=owner-edit');
  const changedOutput=await finish(outputs.root,{dryRun:true,self:repo});check(changedOutput.kept.some(i=>i.path===outputWt),'edits to a registered generated file prevent removal');
  writeFileSync(path.join(outputWt,'.env.local'),'SYNTHETIC=generated');
  const generatedDone=await finish(outputs.root,{self:repo});check(generatedDone.artifactsRemoved&&!existsSync(outputWt),'unchanged generator-recorded launch/env files are reclaimable without exposing values');
  // Real bootstrap + thin overlay transport: no manual register call in this case.
  const plugin=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
  mkdirSync(path.join(repo,'.pandacorp'),{recursive:true});
  for(const name of ['worktree-bootstrap.sh','session-cleanup.sh']) copyFileSync(path.join(plugin,'templates/shared/.pandacorp',name),path.join(repo,'.pandacorp',name));
  git(repo,'add','-f','.pandacorp/worktree-bootstrap.sh','.pandacorp/session-cleanup.sh');git(repo,'commit','-qm','fixture overlay');
  mkdirSync(path.join(repo,'.claude'),{recursive:true});writeFileSync(path.join(repo,'.claude/launch.json'),JSON.stringify({configurations:[{name:'fixture',runtimeExecutable:'node',runtimeArgs:['fixture.js','--port','1234']}]}));
  const bootSession=await create(repo);sessions.push(bootSession.root);const bootWt=wt('bootstrapped');
  const boot=spawnSync('bash',['.pandacorp/worktree-bootstrap.sh'],{cwd:bootWt,encoding:'utf8',env:{...env,PANDACORP_CLEANUP_SESSION:bootSession.root,PANDACORP_PLUGIN_ROOT:plugin}});
  check(boot.status===0,`real bootstrap registers without manual call: ${boot.stderr}`);
  const bootReceipt=JSON.parse(readFileSync(path.join(bootSession.root,'session.json'),'utf8'));
  check(Boolean(bootReceipt.worktrees[0]?.generatedFiles['.claude/launch.json']),'bootstrap records only its generated launch output hash');
  const bootDone=await finish(bootSession.root,{self:repo});check(bootDone.artifactsRemoved&&!existsSync(bootWt),'real bootstrapped merged worktree is reclaimed through canonical engine');
  console.log(`${count} passed, 0 failed`);
} finally {
  // All removals here are this test's own disposable fixtures, never owner worktrees.
  for(const s of sessions) if(existsSync(s)) rmSync(s,{recursive:true,force:true});
  rmSync(tmp,{recursive:true,force:true});
}
