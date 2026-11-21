// Independent-review regressions: synthetic paths, no production flags outside fixtures.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import { constants } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { spawnJob, runJobWrapper } from '../runtime/build/jobs.mjs';
import * as overlay from './stage-managed-overlay.mjs';

test('review 1: every detached job strips production order, including low-level callers', async () => {
  const project = await fs.mkdtemp(path.join(os.tmpdir(),'p43-review-env-'));
  try {
    for (const kind of ['land','g2']) {
      let options;
      await spawnJob({ project, kind, cmd:['true'], cwd:project, jobId:'job-'+kind }, {
        env:{...process.env,PANDACORP_OWNER_RELEASE_OK:'1'},
        spawn:(_cmd,_args,opts)=>{options=opts;return {pid:process.pid,on(){},unref(){}};},
      });
      assert.equal(options.env.PANDACORP_OWNER_RELEASE_OK,undefined,kind+' cannot inherit order');
    }
  } finally { await fs.rm(project,{recursive:true,force:true}); }
});

test('review 1: wrapper defense strips an ambient order even when invoked directly', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(),'p43-review-wrapper-'));
  const previous=process.env.PANDACORP_OWNER_RELEASE_OK;
  try {
    await fs.writeFile(path.join(dir,'cmd.json'),JSON.stringify({cmd:['true'],cwd:dir,h_slot:false}));
    process.env.PANDACORP_OWNER_RELEASE_OK='1';
    let options;
    await runJobWrapper(dir,{spawn:(_cmd,_args,opts)=>{options=opts;const child=new EventEmitter();queueMicrotask(()=>child.emit('close',0,null));return child;}});
    assert.equal(options.env.PANDACORP_OWNER_RELEASE_OK,undefined);
  } finally {
    if(previous===undefined)delete process.env.PANDACORP_OWNER_RELEASE_OK;else process.env.PANDACORP_OWNER_RELEASE_OK=previous;
    await fs.rm(dir,{recursive:true,force:true});
  }
});

test('review 5: unchanged 100644 helpers gain executable mode before conformance gates', async () => {
  const project=await fs.mkdtemp(path.join(os.tmpdir(),'p43-review-mode-'));
  try {
    const dir=path.join(project,'.pandacorp');await fs.mkdir(dir);
    for(const file of ['verify.sh','canary.sh','merge-queue.sh']) await fs.writeFile(path.join(dir,file),'#!/bin/sh\nexit 0\n',{mode:0o644});
    assert.equal(typeof overlay.ensureOverlayExecutables,'function','upgrade needs a deterministic mode repair helper');
    await overlay.ensureOverlayExecutables(project);
    for(const file of ['verify.sh','canary.sh','merge-queue.sh']) {
      await fs.access(path.join(dir,file),constants.X_OK);
      assert.equal(await fs.readFile(path.join(dir,file),'utf8'),'#!/bin/sh\nexit 0\n');
    }
    await fs.chmod(path.join(dir,'verify.sh'),0o644);
    await overlay.ensureOverlayExecutables(project);
    await fs.access(path.join(dir,'verify.sh'),constants.X_OK);
  } finally {await fs.rm(project,{recursive:true,force:true});}
});

test('review 5: executable-only CLI repairs equal content without staging and rejects symlinks', async () => {
  const project=await fs.mkdtemp(path.join(os.tmpdir(),'p43-review-mode-cli-'));
  try {
    const dir=path.join(project,'.pandacorp');await fs.mkdir(dir);
    const file=path.join(dir,'verify.sh');await fs.writeFile(file,'#!/bin/sh\nexit 0\n',{mode:0o644});
    const {spawnSync}=await import('node:child_process');
    const cli=spawnSync(process.execPath,['plugin/scripts/stage-managed-overlay.mjs','--project',project,'--ensure-executable'],{encoding:'utf8'});
    assert.equal(cli.status,0,cli.stderr);
    await fs.access(file,constants.X_OK);
    // No .git exists: mode-only conformance cannot accidentally stage or require it.
    await fs.unlink(file);await fs.symlink(path.join(project,'outside'),file);
    assert.throws(()=>overlay.ensureOverlayExecutables(project),/regular file/);
    const skill=await fs.readFile('plugin/skills/upgrade/SKILL.md','utf8');
    assert.ok(skill.indexOf('--ensure-executable')<skill.indexOf('3a. **Prove'), 'mode conformance precedes canary/project gates');
    assert.match(skill,/chmod \+x \.pandacorp\/verify\.sh/);
    assert.match(skill,/test -x \.pandacorp\/verify\.sh/);
  } finally {await fs.rm(project,{recursive:true,force:true});}
});

test('review 1: attended receipt adoption rejects wrong SHA, ordering, scope and partial publication', async () => {
  const { prepareAttendedLanding }=await import('../runtime/build/land/harvest.mjs');
  const project='/synthetic-project',sha='a'.repeat(40),branch='lane/review/integration';
  const ctx={project,runId:'review',paths:{integrationBranch:()=>branch}};
  const state={jobs:[{kind:'land',state:'done',exit:21}],integration:{worktree:project}};
  const common={v:1,project,attempt:'same-attempt',branch};
  const valid=[{...common,event:'start',owner_release_ok:1},{...common,event:'ff',sha,result:'ok'},{...common,event:'push',sha,result:'ok'},{...common,event:'end',exit:0}];
  const observe=rows=>prepareAttendedLanding(ctx,state,{fs:{realpath:async p=>p,readFile:async()=>rows.map(r=>JSON.stringify(r)).join('\n')+'\n'},exec:async()=>({code:0,stdout:sha,stderr:''})});
  assert.equal((await observe(valid)).tip,sha);
  for(const change of [r=>r[1].sha='b'.repeat(40),r=>r[2].attempt='other',r=>r[0].owner_release_ok=0,r=>r.reverse(),r=>r[3].exit=13,r=>r[0].branch='other',r=>r[0].project='/other',r=>r.splice(2,1),r=>r.push({...r[0]})]) {
    const rows=structuredClone(valid);change(rows);assert.equal(await observe(rows),null);
  }
  await assert.rejects(()=>prepareAttendedLanding(ctx,state,{fs:{realpath:async p=>p,readFile:async()=>'\n'},exec:async()=>({code:0,stdout:sha})}),/malformed/);
});

test('re-review: attended receipts compare physical project paths and reject different existing projects', async t => {
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'p43-project-alias-'));
  t.after(()=>fs.rm(root,{recursive:true,force:true}));
  const project=path.join(root,'project'),alias=path.join(root,'project-alias'),other=path.join(root,'other');
  await fs.mkdir(path.join(project,'.pandacorp/run'),{recursive:true});await fs.mkdir(other);
  await fs.symlink(project,alias,'dir');
  const physical=await fs.realpath(project),sha='a'.repeat(40),branch='lane/alias/integration';
  const state={jobs:[{kind:'land',state:'done',exit:21}],integration:{worktree:physical}};
  const ctx={project:alias,runId:'alias',paths:{integrationBranch:()=>branch}};
  const {prepareAttendedLanding}=await import('../runtime/build/land/harvest.mjs');
  const writeReceipt=async receiptProject=>{
    const common={v:1,project:receiptProject,attempt:'alias-receipt',branch};
    const rows=[{...common,event:'start',owner_release_ok:1},{...common,event:'ff',sha,result:'ok'},{...common,event:'push',sha,result:'ok'},{...common,event:'end',exit:0}];
    await fs.writeFile(path.join(project,'.pandacorp/run/queue-log.jsonl'),rows.map(row=>JSON.stringify(row)).join('\n')+'\n');
  };
  const deps={fs,exec:async()=>({code:0,stdout:sha,stderr:''})};
  await writeReceipt(physical);
  assert.equal((await prepareAttendedLanding(ctx,state,deps))?.tip,sha,'--project alias must accept physical Git receipt');
  await writeReceipt(alias);
  assert.equal((await prepareAttendedLanding({...ctx,project:physical},state,deps))?.tip,sha,'either spelling must identify the same project');
  await writeReceipt(other);assert.equal(await prepareAttendedLanding(ctx,state,deps),null,'existing different project remains rejected');
  await writeReceipt(path.join(root,'missing'));assert.equal(await prepareAttendedLanding(ctx,state,deps),null,'missing foreign project cannot be evidence');
});
