#!/usr/bin/env node
// test-product-floor.mjs — the fast lane's product-risk floor (product-floor.mjs, reached through
// `classify-change.mjs --product-floor`; proposal 39 C3/C6). The contract: FLOOR means real product
// risk (auth, money, personal-data persistence, secrets, destructive data ops) in the FRD's CODE —
// never prose, test fixtures, framework config or the factory's oracle surfaces. /change's own mode
// is untouched (its suite, test-classify-change.sh, is the proof of that; one cross-check here).
// Run: node plugin/scripts/test-product-floor.mjs

import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PRODUCT_FLOOR_RULES, pathTokens, productFloor } from './product-floor.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CLASSIFIER = path.join(__dirname, 'classify-change.mjs')
let pass = 0
let fail = 0
const ok = (cond, msg) => { if (cond) { pass++; console.log(`  ✓ ${msg}`) } else { fail++; console.log(`  ✗ ${msg}`) } }

/** A landed-diff context: { path: body } → every line is an added line. */
const landed = (files) => ({ files: Object.keys(files).map((p) => ({ path: p, added: files[p].split('\n').length, deleted: 0, status: 'A' })), addedByFile: new Map(Object.entries(files).map(([p, b]) => [p, b.split('\n')])), linesKnown: true })
/** A plan-time context: declared paths only, no body. */
const declared = (paths) => ({ files: paths.map((p) => ({ path: p, added: 0, deleted: 0, status: 'M' })), addedByFile: new Map(), linesKnown: false })
const sig = (v) => v.floor_hits.map((h) => h.signal).sort().join(',')
const show = (v) => JSON.stringify(v.floor_hits.map((h) => `${h.signal}: ${h.detail}`))

// The bench F-1 app: a client-only 6-field registration form that only console.logs.
const F1_FRD = `---\nid: FRD-01\n---\n# Registration form\n\n- REQ-01-001 The form SHALL NOT call any auth provider; no auth, no persistence.\n- AC-01-001.1 WHEN the user types Ana@Example.COM the system SHALL accept it.\n`
const F1_FORM = `'use client'\nimport { useState } from 'react'\nexport function RegistrationForm() {\n  const [email, setEmail] = useState('')\n  const [phone, setPhone] = useState('')\n  function handleSubmit(e) { e.preventDefault(); console.log({ email, phone, firstName: 'x' }) }\n  return null\n}\n`
const F1_E2E = `import { expect, test } from '@playwright/test'\ntest('registers', async ({ page }) => {\n  await page.getByLabel('Email').fill('Maria@Example.COM')\n  await expect(page.getByRole('status')).toBeVisible()\n})\n`
const F1_NEXT_CONFIG = `import createNextIntlPlugin from 'next-intl/plugin'\nconst withNextIntl = createNextIntlPlugin()\nexport default withNextIntl({ reactStrictMode: true })\n`
const F1_SETUP = `import '@testing-library/jest-dom/vitest'\nimport { cleanup } from '@testing-library/react'\nimport { afterEach } from 'vitest'\nafterEach(() => cleanup())\n`

console.log('F-1 (the measured defect): a client-only form is NOT floor, at plan time or landed')
{
  const plan = productFloor({ ...declared(['next.config.ts', 'src/test/setup.ts', 'e2e/registration.spec.ts', 'src/app/[locale]/register/page.tsx', 'src/components/core/TextField.tsx', 'messages/en.json']), addedByFile: new Map([['docs/frds/frd-01-registration-form/frd.md', F1_FRD.split('\n')]]) })
  ok(!plan.floor, `plan time (declared paths + frd.md text with 'auth' and 'Ana@Example.COM') → not floor (got ${show(plan)})`)
  const land = productFloor(landed({ 'e2e/registration.spec.ts': F1_E2E, 'next.config.ts': F1_NEXT_CONFIG, 'src/test/setup.ts': F1_SETUP, 'src/app/[locale]/register/_components/RegistrationForm.tsx': F1_FORM, 'docs/frds/frd-01-registration-form/frd.md': F1_FRD }))
  ok(!land.floor, `landed (e2e 'Maria@Example.COM', next.config.ts, src/test/setup.ts, a form holding email/phone in state) → not floor (got ${show(land)})`)
}

console.log('P3 · persistence of personal data')
{
  ok(sig(productFloor(landed({ 'prisma/schema.prisma': 'model Contact {\n  id    Int    @id\n  email String @unique\n}\n' }))) === 'P3', 'a Prisma schema adding an email field → floor P3')
  ok(sig(productFloor(landed({ 'prisma/migrations/20261001_contact/migration.sql': 'ALTER TABLE "Contact" ADD COLUMN "phoneNumber" TEXT;\n' }))) === 'P3', 'a migration adding a phone column → floor P3')
  ok(sig(productFloor(landed({ 'src/db/schema.ts': "export const people = sqliteTable('people', { id: integer('id'), firstName: text('first_name'), birthDate: text('birth_date') })\n" }))) === 'P3', 'a drizzle schema adding first_name / birth_date → floor P3')
  const write = productFloor(landed({ 'src/app/register/_actions/register.ts': "'use server'\nexport async function register(fd) {\n  await prisma.contact.create({ data: { email: String(fd.get('email')) } })\n}\n" }))
  ok(sig(write) === 'P3' && /prisma\.contact\.create/.test(show(write)), `a data-layer write of an email → floor P3, hit explained (got ${show(write)})`)
  ok(!productFloor(landed({ 'prisma/schema.prisma': 'model Project {\n  id   Int    @id\n  name String\n  description String?\n}\n' })).floor, 'a schema with a bare project `name` (not a person) → not floor')
}

console.log('P1 · authentication / authorization / session')
{
  ok(sig(productFloor(declared(['src/app/api/auth/[...nextauth]/route.ts']))) === 'P1', 'plan time: a declared src/app/api/auth/... route → floor P1')
  ok(sig(productFloor(declared(['src/app/[locale]/login/page.tsx', 'src/lib/useSession.ts']))) === 'P1', 'login/ and useSession (camelCase token) → floor P1')
  ok(sig(productFloor(landed({ 'src/lib/guard.ts': "import { getServerSession } from 'next-auth'\nexport const g = getServerSession\n" }))) === 'P1', 'an auth-library import (next-auth) → floor P1')
  ok(sig(productFloor(landed({ 'src/middleware.ts': "import { NextResponse } from 'next/server'\nexport function middleware(req) {\n  if (!req.cookies.get('session')) return NextResponse.redirect(new URL('/login', req.url))\n}\n" }))) === 'P1', 'a middleware.ts that gates access → floor P1')
  ok(!productFloor(landed({ 'src/middleware.ts': "import createMiddleware from 'next-intl/middleware'\nimport { routing } from './i18n/routing'\nexport default createMiddleware(routing)\n" })).floor, 'an i18n middleware.ts → not floor')
  const dm = productFloor(declared(['src/middleware.ts']))
  ok(!dm.floor && dm.notes.some((n) => /deferred.*middleware/.test(n)), 'plan time: a declared middleware.ts is deferred to the landed diff (noted), not guessed')
  ok(!productFloor(landed({ 'src/app/authors/page.tsx': 'export default function Authors() { return null }\n', 'docs/adr/0001-auth.md': 'We will add auth later.\n' })).floor, 'authors/ (a substring, not a token) and an ADR mentioning auth → not floor')
  ok(JSON.stringify(pathTokens('src/app/sign-in/useAuthForm.tsx')) === JSON.stringify(['src', 'app', 'sign', 'in', 'use', 'auth', 'form', 'tsx']), 'pathTokens splits on separators and camelCase')
}

console.log('P2 · payments / money')
{
  ok(sig(productFloor(landed({ 'src/lib/pay.ts': "import Stripe from 'stripe'\nexport const s = new Stripe(key)\n" }))) === 'P2', 'a Stripe import → floor P2')
  ok(sig(productFloor(landed({ 'src/lib/pay.ts': "import { Polar } from '@polar-sh/sdk'\nexport const p = Polar\n" }))) === 'P2', 'a Polar import → floor P2')
  ok(sig(productFloor(declared(['src/app/[locale]/checkout/page.tsx']))) === 'P2', 'plan time: a checkout/ route → floor P2')
}

console.log('P4 · secrets / env (.env.example decision: a secret-shaped key → floor, plain config → not)')
{
  ok(!productFloor(landed({ '.env.example': 'PORT=3000\nNEXT_PUBLIC_SITE_URL=\nDATABASE_URL=file:./dev.db\n' })).floor, '.env.example adding PORT / NEXT_PUBLIC_* / a sqlite DATABASE_URL → not floor')
  ok(sig(productFloor(landed({ '.env.example': 'STRIPE_SECRET_KEY=\n' }))).includes('P4'), '.env.example adding STRIPE_SECRET_KEY → floor P4')
  ok(!productFloor(landed({ '.env': 'DATABASE_URL="file:./dev.db"\n' })).floor, 'a committed .env with only a local sqlite URL → not floor (the bench Tablero foundation)')
  ok(sig(productFloor(landed({ '.env': 'DATABASE_URL="postgres://app:hunter2@db.internal:5432/app"\n' }))) === 'P4', 'a .env URL with user:password@ → floor P4')
  ok(sig(productFloor(landed({ 'src/lib/mail.ts': 'export const key = process.env.RESEND_API_KEY\n' }))) === 'P4', 'code reading process.env.RESEND_API_KEY → floor P4')
  ok(!productFloor(landed({ 'src/lib/env.ts': 'export const url = process.env.NEXT_PUBLIC_SITE_URL\nexport const runtime = process.env.NEXT_RUNTIME\n' })).floor, 'code reading NEXT_PUBLIC_* / NEXT_RUNTIME → not floor')
  ok(!productFloor(landed({ 'scripts/_tests/fixtures/redact.json': '{"k":"sk-abcdefghijklmnopqrstuvwxyz012345"}\n' })).floor, 'a fake key in a test fixture → not floor (test data)')
  ok(!productFloor(declared(['.env.example'])).floor, 'plan time: a declared .env.example is deferred to the landed diff')
}

console.log('P5 · destructive data (the bench-medium Tablero decision: single-row and cascade delete are CRUD)')
{
  const tablero = productFloor(landed({
    'prisma/schema.prisma': 'model Project {\n  id    Int    @id\n  name  String\n  tasks Task[]\n}\nmodel Task {\n  id        Int     @id\n  title     String\n  status    String\n  project   Project @relation(fields: [projectId], references: [id], onDelete: Cascade)\n  projectId Int\n}\n',
    'prisma/migrations/20261001202818_init/migration.sql': 'CREATE TABLE "Task" (\n  "id" INTEGER PRIMARY KEY,\n  "projectId" INTEGER NOT NULL,\n  CONSTRAINT "Task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE\n);\n',
    'src/app/api/v1/tasks/[taskId]/route.ts': 'export async function DELETE(_req, { params }) {\n  await prisma.task.delete({ where: { id: Number(params.taskId) } })\n  return new Response(null, { status: 204 })\n}\n',
    'src/lib/queries/projects.ts': 'export function removeProject(db, id) {\n  return db.prepare(\'DELETE FROM "Project" WHERE id = ?\').run(id)\n}\nexport const truncateLabel = (s) => truncate(s, 40)\n',
    'scripts/dbReset.mjs': 'export function reset(db) {\n  db.exec(\'DELETE FROM "Task"\')\n  db.exec(\'DELETE FROM "Project"\')\n}\n',
  }))
  ok(!tablero.floor, `Tablero (project/task CRUD, single-row DELETE, cascade, a scripts/dbReset dev tool, truncate() helper) → not floor (got ${show(tablero)})`)
  ok(sig(productFloor(landed({ 'prisma/migrations/2_drop/migration.sql': 'DROP TABLE "Task";\n' }))) === 'P5', 'a DROP TABLE migration → floor P5')
  ok(sig(productFloor(landed({ 'prisma/migrations/3_trunc/migration.sql': 'TRUNCATE TABLE "Task";\n' }))) === 'P5', 'a TRUNCATE migration → floor P5')
  ok(sig(productFloor(landed({ 'src/app/api/v1/tasks/route.ts': 'export async function DELETE() {\n  await prisma.task.deleteMany()\n  return new Response(null, { status: 204 })\n}\n' }))) === 'P5', 'an unfiltered deleteMany() bulk-delete endpoint → floor P5')
  ok(!productFloor(landed({ 'src/lib/queries/tasks.ts': 'export const clear = (projectId) => prisma.task.deleteMany({ where: { projectId } })\n' })).floor, 'a filtered deleteMany({ where }) (cascade by hand) → not floor')
  ok(sig(productFloor(landed({ 'src/lib/queries/tasks.ts': "export const wipe = () => db.exec('DELETE FROM \"Task\";')\n" }))) === 'P5', 'a DELETE FROM with no WHERE in product code → floor P5')
  ok(sig(productFloor(landed({ 'src/lib/queries/tasks.ts': 'export const wipe = () => db.delete(tasks)\n' }))) === 'P5', 'a drizzle db.delete(t) with no .where( → floor P5')
  ok(!productFloor(landed({ 'src/lib/queries/tasks.ts': 'export const rm = (id) => db.delete(tasks)\n  .where(eq(tasks.id, id))\n' })).floor, 'a drizzle db.delete(t).where(...) → not floor')
}

console.log('rule table')
ok(PRODUCT_FLOOR_RULES.map((r) => r.signal).join() === 'P1,P2,P3,P4,P5' && PRODUCT_FLOOR_RULES.every((r) => r.domain && r.floor), 'five explained rules, P1..P5')

console.log('CLI: classify-change.mjs --product-floor on a real git range (and /change mode left as it was)')
{
  const dir = mkdtempSync(path.join(os.tmpdir(), 'pf-'))
  const G = (...a) => execFileSync('git', ['-C', dir, '-c', 'user.email=t@example.com', '-c', 'user.name=T', '-c', 'commit.gpgsign=false', ...a], { encoding: 'utf8' })
  const write = (rel, body) => { mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); writeFileSync(path.join(dir, rel), body) }
  const cli = (...a) => { const r = spawnSync(process.execPath, [CLASSIFIER, '--repo', dir, ...a], { encoding: 'utf8' }); let v = null; try { v = JSON.parse(r.stdout.trim().split('\n').pop()) } catch { v = null } return { code: r.status, v } }
  try {
    G('init', '-q', '-b', 'main'); write('README.md', 'x\n'); G('add', '-A'); G('commit', '-qm', 'base')
    const base = G('rev-parse', 'HEAD').trim()
    write('e2e/registration.spec.ts', F1_E2E); write('next.config.ts', F1_NEXT_CONFIG); write('src/test/setup.ts', F1_SETUP)
    write('src/app/register/_components/RegistrationForm.tsx', F1_FORM); write('docs/frds/frd-01-registration-form/frd.md', F1_FRD)
    G('add', '-A'); G('commit', '-qm', 'F-1')
    const p = cli('--range', `${base}..HEAD`, '--product-floor')
    ok(p.code === 0 && p.v && p.v.mode === 'product-floor' && p.v.floor === false && p.v.floor_hits.length === 0, `F-1 landed range → exit 0, not floor (got ${p.code} ${JSON.stringify(p.v && p.v.floor_hits)})`)
    const c = cli('--range', `${base}..HEAD`)
    ok(c.v && c.v.rigor === 'critical' && ['S6', 'S7', 'S9'].every((s) => c.v.floor_hits.some((h) => h.signal === s)), '/change mode on the same range is unchanged: still critical on S6/S7/S9 (it protects the factory, not product risk)')
    const t = cli('--files', 'next.config.ts,src/test/setup.ts,e2e/registration.spec.ts', '--text', 'docs/frds/frd-01-registration-form/frd.md', '--product-floor')
    ok(t.v && t.v.floor === false, 'F-1 plan time through the CLI (--files + --text frd.md) → not floor')
    write('src/app/api/auth/login/route.ts', "import { SignJWT } from 'jose'\nexport const POST = () => SignJWT\n"); G('add', '-A'); G('commit', '-qm', 'auth')
    const a = cli('--range', 'HEAD^..HEAD', '--product-floor')
    ok(a.v && a.v.floor === true && a.v.rigor === 'critical' && a.v.floor_hits.every((h) => h.level === 'critical') && a.v.floor_hits.some((h) => h.signal === 'P1'), 'an auth route lands → floor P1, every hit critical (the caller reads level === critical)')
    const bad = cli('--range', 'nope..HEAD', '--product-floor')
    ok(bad.code !== 0 && bad.v && bad.v.floor_hits.some((h) => h.signal === 'FAILCLOSED'), 'an unreadable range fails closed (FAILCLOSED critical)')
    const mix = cli('--range', 'HEAD^..HEAD', '--product-floor', '--attempts', '1')
    ok(mix.code !== 0 && mix.v && mix.v.floor_hits.some((h) => h.signal === 'FAILCLOSED'), '--product-floor with a /change-only flag fails closed')
    const empty = cli('--range', 'HEAD..HEAD', '--product-floor')
    ok(empty.code !== 0 && empty.v && empty.v.floor_hits.some((h) => h.signal === 'FAILCLOSED'), 'an empty range fails closed')
  } finally { rmSync(dir, { recursive: true, force: true }) }
}

console.log(`\npassed: ${pass}   failed: ${fail}`)
process.exit(fail ? 1 : 0)
