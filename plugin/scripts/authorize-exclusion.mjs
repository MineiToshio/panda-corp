#!/usr/bin/env node
// OWNER ONLY. Agents must never invoke this command, including with an allocated TTY.
import { readFileSync, writeFileSync, existsSync, mkdirSync, lstatSync } from 'node:fs';
import { generateKeyPairSync, sign } from 'node:crypto';
import { homedir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { binding, exclusionsPath, flakySuspects, projectIdentity } from '../templates/shared/.pandacorp/test-gate-policy.mjs';
try {
  const [id,...args] = process.argv.slice(2);
  const option = name => args[args.indexOf(name)+1];
  const reason = args.includes('--reason') ? option('--reason') : '';
  const days = args.includes('--days') ? Number(option('--days')) : 14;
  if (!id || !reason.trim() || !Number.isInteger(days) || days < 1 || days > 14) throw new Error('usage: authorize-exclusion.mjs <exact-id> --reason <reason> [--days 1..14] (run in project)');
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error('owner authorization requires interactive TTY confirmation; non-interactive process refused');
  if (lstatSync('.pandacorp').isSymbolicLink() || !lstatSync('.pandacorp').isDirectory()) throw new Error('real .pandacorp directory required');
  for (const file of [exclusionsPath,'.pandacorp/exclusion-owner.pub']) if (existsSync(file) && (lstatSync(file).isSymbolicLink() || !lstatSync(file).isFile())) throw new Error('regular policy/key files required');
  const project = projectIdentity(process.cwd());
  const suspects = flakySuspects(readFileSync(resolve(project,'.pandacorp/run/test-outcomes.jsonl'),'utf8'));
  if (!suspects.some(s=>s.project===project && s.test_id===id)) throw new Error('id is not a ledger suspect');
  const now = new Date(), start = now.toISOString().slice(0,10);
  const entry = {id,reason,authorized_by:'owner',authorized_at:start,expires:new Date(Date.parse(start)+days*86400000).toISOString().slice(0,10)};
  const rl = createInterface({input:process.stdin,output:process.stdout});
  let answer;
  try { answer = await rl.question(`Exclude exactly ${id}\nReason: ${reason}\nExpires (UTC midnight): ${entry.expires}\nType AUTHORIZE to confirm as owner: `); } finally { rl.close(); }
  if (answer !== 'AUTHORIZE') throw new Error('owner did not confirm; nothing written');
  const keyPath = resolve(homedir(), '.config/pandacorp/exclusion-owner-key.pem');
  if (!existsSync(keyPath)) {
    const keys = generateKeyPairSync('ed25519');
    mkdirSync(dirname(keyPath), {recursive:true,mode:0o700});
    writeFileSync(keyPath, keys.privateKey.export({type:'pkcs8',format:'pem'}), {mode:0o600,flag:'wx'});
  }
  const { createPublicKey } = await import('node:crypto');
  const privateKey = readFileSync(keyPath), publicKey = createPublicKey(privateKey).export({type:'spki',format:'pem'});
  const publicPath = '.pandacorp/exclusion-owner.pub';
  if (existsSync(publicPath) && readFileSync(publicPath,'utf8') !== publicKey) throw new Error('project owner key differs; reviewed key rotation required');
  writeFileSync(publicPath, publicKey);
  entry.authorization = 'tty-v1:' + sign(null, Buffer.from(binding(entry)), privateKey).toString('base64');
  const entries = existsSync(exclusionsPath) ? JSON.parse(readFileSync(exclusionsPath,'utf8')) : [];
  if (!Array.isArray(entries)) throw new Error('exclusions must be an array');
  writeFileSync(exclusionsPath, JSON.stringify([...entries.filter(e=>e.id!==id),entry],null,2)+'\n');
  console.log('Owner confirmation recorded. Review and commit the exclusions file before verification.');
} catch (error) { console.error(error.message); process.exitCode=1; }
