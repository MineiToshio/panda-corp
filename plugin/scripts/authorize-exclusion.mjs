#!/usr/bin/env node
// OWNER ONLY: never run this command or answer Keychain dialogs as an agent.
import { readFileSync, writeFileSync, existsSync, mkdirSync, lstatSync } from 'node:fs';
import { createPublicKey, generateKeyPairSync, sign } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createInterface } from 'node:readline/promises';
import { binding, exclusionsPath, flakySuspects, TEST_ID_ENCODING, readTestId, ownerPublicKey, ownerGit, projectIdentity } from '../templates/shared/.pandacorp/test-gate-policy.mjs';
const service = 'pandacorp.exclusions.signing';
const account = 'owner';
const loginKeychain = () => resolve(homedir(),'Library/Keychains/login.keychain-db');
// Absolute binary prevents a project-owned PATH shim from obtaining the key.
const security = args => execFileSync('/usr/bin/security',args,{encoding:'utf8',stdio:['ignore','pipe','pipe']});
export function signWithKeychain(entry, pinnedPem, {platform=process.platform,runSecurity=security} = {}) {
  if (platform !== 'darwin') throw new Error('owner signing requires macOS login Keychain');
  let secret;
  try { secret = runSecurity(['find-generic-password','-s',service,'-a',account,'-w',loginKeychain()]); }
  catch { throw new Error('Keychain access denied or owner item missing; owner must approve the macOS authorization dialog'); }
  const privateKey = Buffer.from(secret.trim(),'base64');
  const pem = privateKey;
  try {
    const actual = createPublicKey(pem).export({type:'spki',format:'der'});
    const pinned = createPublicKey(pinnedPem).export({type:'spki',format:'der'});
    if (!actual.equals(pinned)) throw new Error('Keychain key does not match pinned factory main key');
    return 'tty-v1:' + sign(null,Buffer.from(binding(entry)),pem).toString('base64');
  } finally { privateKey.fill(0); pem.fill(0); secret = undefined; }
}
export function bootstrapOwnerKey(factory, {platform=process.platform,runSecurity=security} = {}) {
  if (platform !== 'darwin') throw new Error('owner bootstrap requires macOS login Keychain');
  const branch = ownerGit(factory,'symbolic-ref','--short','HEAD');
  if (branch !== 'main') throw new Error('bootstrap must run against the factory main checkout');
  const file = resolve(factory,'factory/owner-keys/exclusions.pub');
  if (existsSync(file)) throw new Error('owner key already exists; rotation requires a separately reviewed factory change');
  const keys = generateKeyPairSync('ed25519');
  const privatePem = keys.privateKey.export({type:'pkcs8',format:'pem'});
  try {
    // No -U and no -A: never overwrite an item or grant an application silent access.
    // An empty trusted-app list requires macOS authorization on every later retrieval.
    runSecurity(['add-generic-password','-s',service,'-a',account,'-w',Buffer.from(privatePem).toString('base64'),'-T','',loginKeychain()]);
  } catch { throw new Error('Keychain item creation failed; no public key written (existing items are never replaced)'); }
  mkdirSync(dirname(file),{recursive:true});
  writeFileSync(file,keys.publicKey.export({type:'spki',format:'pem'}),{flag:'wx'});
  console.log('Public key written. Review and commit factory/owner-keys/exclusions.pub on factory main. No key was committed by this command.');
}
export function replaceAuthorizedExclusion(entries,entry) {
  if (!Array.isArray(entries)) throw new Error('exclusions must be an array');
  const id=readTestId(entry.id,entry.id_encoding);
  return [...entries.filter(e=>readTestId(e.id,e.id_encoding)!==id),entry];
}
async function main() {
  if (process.platform !== 'darwin') throw new Error('owner authorization requires macOS login Keychain');
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error('owner authorization requires interactive TTY confirmation; non-interactive process refused');
  const [id,...args] = process.argv.slice(2);
  const rl = createInterface({input:process.stdin,output:process.stdout});
  if (id === '--bootstrap-owner') {
    try { if (args.length !== 1 || await rl.question('Create the owner-only Keychain item? Type BOOTSTRAP: ') !== 'BOOTSTRAP') throw new Error('owner bootstrap not confirmed'); }
    finally { rl.close(); }
    bootstrapOwnerKey(resolve(args[0])); return;
  }
  const option = name => args[args.indexOf(name)+1];
  const reason = args.includes('--reason') ? option('--reason') : '';
  const days = args.includes('--days') ? Number(option('--days')) : 14;
  if (!id || typeof reason !== 'string' || !reason.trim() || !Number.isInteger(days) || days < 1 || days > 14) { rl.close(); throw new Error('usage: authorize-exclusion.mjs <exact-id> --reason <reason> [--days 1..14]'); }
  try {
    if (lstatSync('.pandacorp').isSymbolicLink() || !lstatSync('.pandacorp').isDirectory()) throw new Error('real .pandacorp directory required');
    if (existsSync(exclusionsPath) && (lstatSync(exclusionsPath).isSymbolicLink() || !lstatSync(exclusionsPath).isFile())) throw new Error('regular policy file required');
    readTestId(id,TEST_ID_ENCODING); // owner copies the canonical id printed by flaky-suspects
    const project = projectIdentity(process.cwd());
    const suspects = flakySuspects(readFileSync(resolve(project,'.pandacorp/run/test-outcomes.jsonl'),'utf8'));
    if (!suspects.some(s=>s.project===project && s.test_id===id)) throw new Error('id is not a ledger suspect');
    const pinned = ownerPublicKey(process.cwd());
    console.log('owner exclusion key: SHA256:' + pinned.fingerprint + ' (factory committed main)');
    const start = new Date().toISOString().slice(0,10);
    const entry = {id,id_encoding:TEST_ID_ENCODING,reason,authorized_by:'owner',authorized_at:start,expires:new Date(Date.parse(start)+days*86400000).toISOString().slice(0,10)};
    if (await rl.question(`Exclude exactly ${id}\nReason: ${reason}\nExpires (UTC midnight): ${entry.expires}\nType AUTHORIZE, then approve the macOS Keychain dialog: `) !== 'AUTHORIZE') throw new Error('owner did not confirm; nothing written');
    entry.authorization = signWithKeychain(entry,pinned.pem);
    const entries = existsSync(exclusionsPath) ? JSON.parse(readFileSync(exclusionsPath,'utf8')) : [];
    writeFileSync(exclusionsPath,JSON.stringify(replaceAuthorizedExclusion(entries,entry),null,2)+'\n');
    console.log('Owner confirmation recorded. Review and commit the exclusions file before verification.');
  } finally { rl.close(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error=>{console.error(error.message);process.exitCode=1;});
}
