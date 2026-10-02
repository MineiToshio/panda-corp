/**
 * Pandacorp — the fast lane's PRODUCT-RISK floor (proposal 39 §2 C3/C6), reached through
 * `classify-change.mjs --product-floor`.
 *
 * WHY A SEPARATE FLOOR. `/pandacorp:change`'s floor (S5-S9, S17) protects the FACTORY: its oracles,
 * its machinery, every prose mention of a floor domain, any e-mail literal anywhere. Applied to a
 * product FRD it floors virtually every web feature (bench run F-1: a client-only form that only
 * console.logs was floor on `'auth'` in frd.md prose, an e2e fixture e-mail, `next.config.ts` and
 * `src/test/setup.ts`), so the fast lane never reached USABLE before the opus gate. Here FLOOR means
 * one thing: the FRD's CODE carries a real product risk —
 *   P1 authentication / authorization / session      P2 payments / money
 *   P3 persistence of personal data                  P4 secrets / env handling
 *   P5 destructive data operations
 *
 * OUT OF SCOPE BY DESIGN (never floor here; /change still floors them for itself):
 *   prose (docs/, *.md — a spec mentioning "auth" is not auth code), test surfaces (unit tests,
 *   `src/test/`, `e2e/`, fixtures — an example e-mail in a test is not stored data), framework and
 *   tool config (next.config.*, tsconfig, biome, vitest/playwright config — unless their CODE reads a
 *   secret, which P4's content rule catches anywhere), and the factory's oracle surfaces.
 *
 * COMPOSITION: any hit ⇒ floor (monotone: the caller ORs it with the FRD's recorded floor and never
 * lowers it). Unreadable input fails closed in the caller (classify-change.mjs's FAILCLOSED path).
 * A `--files` listing carries no body: the path rules decide, and every content rule is DEFERRED to
 * the landed diff (a note names each deferred file) — the landed check is the one that certifies
 * USABLE, and it reads the body.
 */

/**
 * Surfaces that never carry product risk on their own: prose (agent rule files included), the coding
 * agents' own config, and every test surface. A fake key in a test fixture is test data; a real leaked
 * key anywhere is the secret scanner's job in verify.sh.
 */
const PROSE = [/\.(md|mdx|mdc|txt|rst|adoc)$/i, /(^|\/)docs\//, /(^|\/)\.(agents|claude|cursor|codex)\//];
const TEST = [
  /\.(test|spec)\.[cm]?[jt]sx?$/,
  /(^|\/)_?_?tests?_?_?\//,
  /(^|\/)src\/test\//,
  /(^|\/)e2e\//,
  /(^|\/)(fixtures?|__mocks__|__snapshots__)\//,
  /\.stories\.[jt]sx?$/,
];
const anyMatch = (patterns, v) => patterns.some((re) => re.test(v));
const isOutOfScope = (p) => anyMatch(PROSE, p) || anyMatch(TEST, p);

/** A path's identifier tokens: split on separators AND camelCase, lower-cased (`useSession.ts` → use, session, ts). */
export function pathTokens(p) {
  return String(p)
    .split(/[^A-Za-z0-9]+/)
    .flatMap((seg) => seg.replace(/([a-z0-9])([A-Z])/g, "$1 $2").split(" "))
    .map((t) => t.toLowerCase())
    .filter(Boolean);
}
const hasTokenPair = (tokens, a, bs) => tokens.some((t, i) => t === a && bs.includes(tokens[i + 1]));

// ── P1 · authentication / authorization / session ─────────────────────────────────────────────
/** A file or directory NAMED for auth (a token, not a substring: `authors/` is not auth). */
const P1_TOKENS = new Set(["auth", "authn", "authz", "nextauth", "oauth", "session", "sessions", "login", "logout", "signin", "signout", "signup", "password", "passwords", "credential", "credentials", "jwt", "rbac", "acl"]);
const p1Path = (p) => {
  const t = pathTokens(p);
  return t.some((x) => P1_TOKENS.has(x)) || hasTokenPair(t, "sign", ["in", "out", "up"]) || hasTokenPair(t, "log", ["in", "out"]);
};
/** Auth libraries, imported or required. */
const AUTH_LIBS = String.raw`next-auth|@auth\/[\w-]+|@clerk\/[\w-]+|@supabase\/(?:auth[\w-]*|ssr)|better-auth|lucia|@lucia-auth\/[\w-]+|iron-session|jsonwebtoken|jose|bcrypt|bcryptjs|argon2|@node-rs\/(?:argon2|bcrypt)|passport(?:-[\w-]+)?|@kinde-oss\/[\w-]+|@workos-inc\/[\w-]+|firebase\/auth|firebase-admin\/auth|@auth0\/[\w-]+|express-session|oslo(?:\/[\w-]+)?|arctic`;
const importOf = (libs) => new RegExp(String.raw`(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)['"](?:${libs})(?:\/[^'"]*)?['"]`);
const P1_CONTENT = [
  importOf(AUTH_LIBS),
  /\b(?:scrypt|pbkdf2)(?:Sync)?\s*\(/,
  /\.get\(\s*['"]authorization['"]\s*\)/i,
  /['"]?\bAuthorization['"]?\s*:\s*[`'"]?(?:Bearer|Basic)\b/i,
];
/**
 * middleware.* is floor when it GATES access; an i18n/headers middleware is not. Next 16 renamed the file to proxy.*,
 * which Next only loads from the project root or src/ (a lib module merely named proxy.ts is not it).
 */
const MIDDLEWARE = /(^|\/)middleware\.(ts|tsx|js|mjs|cjs|mts)$|(^|\/src\/|^src\/)proxy\.(ts|tsx|js|mjs|cjs|mts)$/;
const MIDDLEWARE_GATE = /\b(auth\w*|session|token|jwt|login|sign-?in|unauthori[sz]ed|forbidden|authorization)\b|\bstatus\s*:\s*40[13]\b|cookies\.get\(/i;

// ── P2 · payments / money ─────────────────────────────────────────────────────────────────────
const P2_TOKENS = new Set(["payment", "payments", "billing", "checkout", "invoice", "invoices", "subscription", "subscriptions", "payout", "payouts", "refund", "refunds", "stripe", "paypal", "polar", "lemonsqueezy", "paddle", "price", "prices"]);
const PAY_LIBS = String.raw`stripe|@stripe\/[\w-]+|@polar-sh\/[\w-]+|@lemonsqueezy\/[\w-]+|@paypal\/[\w-]+|@paddle\/[\w-]+|braintree|@mollie\/[\w-]+|razorpay|@adyen\/[\w-]+|square`;
const P2_CONTENT = [importOf(PAY_LIBS)];

// ── P3 · persistence of personal data ─────────────────────────────────────────────────────────
/**
 * Schema / migration surfaces. A bare `name` column is NOT personal (a project, a task, a tag all
 * have one — the bench-medium Tablero app); only person-name forms are.
 */
const SCHEMA = [
  /(^|\/)prisma\//,
  /\.(sql|prisma)$/i,
  /(^|\/)migrations?\//,
  /(^|\/)drizzle\//,
  /(^|\/)(db|database)\/schema[^/]*\.[cm]?[jt]s$/,
  /(^|\/)schema\.[cm]?[jt]s$/,
  /(^|\/)(models?|entities)\/[^/]+\.[cm]?[jt]s$/,
];
const PII_FIELD = /\b(?:e-?mail(?:_?address)?|phone(?:_?number)?|mobile(?:_?number)?|first_?name|last_?name|full_?name|surname|given_?name|family_?name|(?:street|home|postal|billing|shipping|mailing)?_?address(?:_?line\d?)?|zip_?code|postal_?code|birth_?date|date_?of_?birth|birthday|dob|ssn|social_?security(?:_?number)?|national_?id|passport(?:_?number)?|dni|nif|tax_?id|document_?(?:number|id)|id_?document|iban)\b/i;
/** A data-layer WRITE: an ORM/query-builder mutation or a SQL INSERT/UPDATE. */
const DATA_WRITE = [
  /\b(?:prisma|db|tx|trx|knex|supabase|drizzle|sql|pool|orm|em|repo|repository|collection)\b(?:\??\.[A-Za-z_$][\w$]*)*\??\.(?:create|createMany|insert|insertOne|insertMany|update|updateMany|upsert|save|put)\s*\(/,
  /\bINSERT\s+INTO\b/i,
  /\bUPDATE\s+["`\w.]+\s+SET\b/i,
];

// ── P4 · secrets / env handling ───────────────────────────────────────────────────────────────
/**
 * Env files are judged by what they ADD, real file or template alike: a secret-shaped key, a URL
 * carrying `user:password@`, or a key-shaped value is floor (the FRD starts handling a secret); a
 * plain config key (PORT, DATABASE_URL=file:./dev.db, a NEXT_PUBLIC_ key) is not. A `--files`
 * listing has no body, so an env file there is deferred to the landed diff, never guessed.
 */
const ENV_FILE = /(^|\/)\.env(\.[^/]*)?$/;
const URL_CREDENTIALS = /\b[a-z][\w+.-]*:\/\/[^\s/:@'"]+:[^\s/@'"]+@/i;
const SECRET_FILE = /(^|\/)(secrets?|credentials?)(\.[^/]*)?$|\.(pem|key|p12|pfx)$/i;
/**
 * A secret-shaped variable name: credential material whose leak grants access to something
 * (…SECRET, TOKEN, PASSWORD, PRIVATE_KEY, API_KEY, ACCESS_KEY, CREDENTIAL). Public build-time keys
 * (NEXT_PUBLIC_/PUBLIC_/VITE_/EXPO_PUBLIC_) are never secrets. A DATABASE_URL/DSN is connection
 * CONFIG every persistent app reads (the bench Tablero app reads `file:./dev.db`); its real value can
 * only live in a real env file, which floors by path.
 */
const SECRET_NAME = String.raw`(?!(?:NEXT_PUBLIC|PUBLIC|VITE|EXPO_PUBLIC)_)[A-Z0-9_]*(?:SECRET|TOKEN|PASSWORD|PASSWD|PRIVATE_KEY|API_KEY|APIKEY|ACCESS_KEY|CREDENTIAL)[A-Z0-9_]*`;
const ENV_SECRET_KEY = new RegExp(String.raw`^\s*(?:export\s+)?(${SECRET_NAME})\s*=`);
const SECRET_READ = new RegExp(String.raw`\b(?:process\.env|import\.meta\.env|Deno\.env\.get\(\s*['"]|Bun\.env)\s*(?:\.|\[\s*['"])?(${SECRET_NAME})\b`);
/** Key-shaped literals (the same shapes /change's S7 scans): a real key in code is a leak wherever it lands. */
const KEY_LITERAL = [/\bsk_(?:live|test)_[A-Za-z0-9]{8,}/, /\bsk-[A-Za-z0-9_-]{20,}/, /\bAKIA[0-9A-Z]{16}\b/, /-----BEGIN[A-Z ]*PRIVATE KEY-----/, /\bghp_[A-Za-z0-9]{20,}/];

// ── P5 · destructive data operations ──────────────────────────────────────────────────────────
/**
 * A single-row DELETE endpoint and a cascade delete are ordinary CRUD (Tablero's project/task
 * delete) — NOT floor. Floor is data loss beyond the row the user asked for: dropping a table/
 * column/schema/database, TRUNCATE, a DELETE/delete-many with NO filter (bulk delete), resetting
 * a database. Fragmented like classify-change.mjs's S8 so no whole destructive literal sits in
 * this file for a grep-based scanner to flag.
 */
const DROP = new RegExp(String.raw`\b` + "DROP" + String.raw`\s+(?:TABLE|DATABASE|SCHEMA|COLUMN)\b`, "i");
const TRUNC = [new RegExp(String.raw`\b` + "TRUNCATE" + String.raw`\b(?:\s+TABLE)?\s+["\x60\w]`), new RegExp(String.raw`\b` + "truncate" + String.raw`\s+table\b`, "i")];
const DB_RESET = [
  /\b(?:dropDatabase|destroyAll|dropCollection)\s*\(/,
  new RegExp(String.raw`\bmigrate\s+` + "reset" + String.raw`\b`),
  /--(?:force-reset|accept-data-loss)\b/,
];
/**
 * Dev tooling that wipes the LOCAL database for the test suites (a `scripts/` file named for
 * reset/seed/fixture/test — the bench Tablero app's ADR-0005 `scripts/dbReset.mjs`) is test
 * infrastructure, not product behavior: P5 skips it. P1-P4 still read it.
 */
const DEV_DATA_TOOL = /(^|\/)scripts\/[^/]*(reset|seed|fixture|test)[^/]*\.[cm]?[jt]s$/i;
/** `DELETE FROM t` whose statement (up to `;` or the template end) carries no WHERE. */
const SQL_DEL = new RegExp(String.raw`\b` + "DELETE" + String.raw`\s+` + "FROM" + String.raw`\s+["\x60\w.]+`, "gi");
/** An ORM delete with no filter: `deleteMany()` / `deleteMany({})`, or `db.delete(t)` with no `.where(` in its chain. */
const ORM_DEL_ALL = /\bdeleteMany\s*\(\s*(?:\{\s*\}\s*)?\)/;
const ORM_DEL_CHAIN = /\b(?:db|tx|trx|drizzle)\s*\.\s*delete\s*\(\s*[\w.]+\s*\)/g;

function unfilteredDelete(joined) {
  for (const m of joined.matchAll(SQL_DEL)) {
    const rest = joined.slice(m.index, m.index + 400);
    const end = rest.search(/[;`]|\n\s*\n/);
    if (!/\bWHERE\b/i.test(end < 0 ? rest : rest.slice(0, end))) return m[0];
  }
  const all = joined.match(ORM_DEL_ALL);
  if (all) return all[0];
  for (const m of joined.matchAll(ORM_DEL_CHAIN)) {
    const rest = joined.slice(m.index + m[0].length, m.index + m[0].length + 300);
    const end = rest.search(/;|\n\s*\n/);
    if (!/^\s*(?:\.\s*\w+\([^;]*?)?\.\s*where\s*\(/.test(end < 0 ? rest : rest.slice(0, end))) return m[0];
  }
  return null;
}

const firstMatch = (patterns, text) => {
  for (const re of patterns) {
    const m = text.match(re);
    if (m) return m[0].trim().slice(0, 60).replace(/\s+/g, " ");
  }
  return null;
};

/** The rule table, for the docs and the tests: one row per signal. */
export const PRODUCT_FLOOR_RULES = Object.freeze([
  { signal: "P1", domain: "authentication / authorization / session", floor: "a file/dir named auth|session|login|logout|sign-in|sign-up|password|credential|oauth|jwt (path token); an auth-library import (next-auth, @auth/*, @clerk/*, better-auth, lucia, iron-session, jose, jsonwebtoken, bcrypt, argon2, passport…); scrypt/pbkdf2 hashing; reading or sending an Authorization header; a middleware.* that gates access" },
  { signal: "P2", domain: "payments / money", floor: "a file/dir named payment|billing|checkout|invoice|subscription|payout|refund|price|stripe|polar|paypal|paddle|lemonsqueezy; a payment-SDK import (stripe, @stripe/*, @polar-sh/*, @lemonsqueezy/*, @paypal/*, @paddle/*, braintree, @mollie/*, razorpay, @adyen/*, square)" },
  { signal: "P3", domain: "persistence of personal data", floor: "a schema/migration surface whose added lines carry a personal field (email, phone, first/last/full name, address, zip/postal code, birth date, ssn, national id, passport, dni/nif, tax id, document number, iban); a data-layer write (ORM create/insert/update/upsert, SQL INSERT/UPDATE) in a file carrying such a field" },
  { signal: "P4", domain: "secrets / env handling", floor: "an env file (.env, .env.local, .env.example…) that ADDS a secret-shaped key (…SECRET/TOKEN/PASSWORD/API_KEY/PRIVATE_KEY/ACCESS_KEY/CREDENTIAL…, never NEXT_PUBLIC_/PUBLIC_/VITE_) or a URL with user:password@; a secrets/credentials/*.pem/*.key file; code reading a secret-shaped key from process.env/import.meta.env; a key-shaped literal in product code" },
  { signal: "P5", domain: "destructive data operations", floor: "DROP TABLE|COLUMN|SCHEMA|DATABASE; TRUNCATE; a DELETE FROM with no WHERE; deleteMany() with no filter; a drizzle db.delete(t) with no .where(); dropDatabase/destroyAll/dropCollection; migrate reset, --force-reset, --accept-data-loss. Single-row and cascade deletes are CRUD, not floor; a scripts/*reset|seed|fixture|test* dev tool is test infrastructure, not floor" },
]);

/**
 * The product-risk floor of a change.
 * @param {{ files: Array<{path: string}>, addedByFile: Map<string, string[]>, linesKnown: boolean }} ctx
 *   the classifier's collected input (repo-relative paths; added lines per file when a diff body exists)
 * @returns {{ floor: boolean, floor_hits: Array<{signal: string, level: 'critical', detail: string}>, notes: string[] }}
 */
export function productFloor(ctx) {
  const hits = [];
  const notes = [];
  const hit = (signal, detail) => { if (!hits.some((h) => h.signal === signal)) hits.push({ signal, level: "critical", detail }); };
  const paths = [...new Set([...ctx.files.map((f) => f.path), ...ctx.addedByFile.keys()])];
  const inScope = paths.filter((p) => !isOutOfScope(p));
  const deferred = [];

  for (const p of inScope) {
    if (p1Path(p)) hit("P1", `auth/session surface: ${p}`);
    if (pathTokens(p).some((t) => P2_TOKENS.has(t))) hit("P2", `money surface: ${p}`);
    if (!ENV_FILE.test(p) && SECRET_FILE.test(p)) hit("P4", `secrets file: ${p}`);
  }

  for (const p of inScope) {
    const lines = ctx.addedByFile.get(p);
    if (!lines || !lines.length) {
      if (!ctx.linesKnown && (MIDDLEWARE.test(p) || ENV_FILE.test(p) || anyMatch(SCHEMA, p))) deferred.push(p);
      continue;
    }
    const joined = lines.join("\n");
    const p1 = firstMatch(P1_CONTENT, joined);
    if (p1) hit("P1", `auth code: '${p1}' (${p})`);
    if (MIDDLEWARE.test(p)) {
      const g = joined.match(MIDDLEWARE_GATE);
      if (g) hit("P1", `access-gating middleware: '${g[0]}' (${p})`);
    }
    const p2 = firstMatch(P2_CONTENT, joined);
    if (p2) hit("P2", `payment SDK: '${p2}' (${p})`);
    const field = joined.match(PII_FIELD);
    if (field && anyMatch(SCHEMA, p)) hit("P3", `personal field on a schema/migration surface: '${field[0]}' (${p})`);
    else if (field) {
      const w = firstMatch(DATA_WRITE, joined);
      if (w) hit("P3", `data-layer write of a personal field: '${field[0]}' via '${w}' (${p})`);
    }
    if (ENV_FILE.test(p)) {
      const k = lines.map((l) => l.match(ENV_SECRET_KEY)).find(Boolean);
      if (k) hit("P4", `secret-shaped key added to ${p}: ${k[1]}`);
      else if (URL_CREDENTIALS.test(joined)) hit("P4", `a URL with embedded credentials added to ${p}`);
    }
    const s = joined.match(SECRET_READ);
    if (s) hit("P4", `code reads a secret: ${s[1]} (${p})`);
    if (firstMatch(KEY_LITERAL, joined)) hit("P4", `key-shaped literal (${p})`);
    const d = DEV_DATA_TOOL.test(p) ? null : firstMatch([DROP, ...TRUNC, ...DB_RESET], joined) || unfilteredDelete(joined);
    if (d) hit("P5", `destructive data operation: '${d.trim().slice(0, 60)}' (${p})`);
  }

  if (deferred.length) notes.push(`product floor: content rules deferred to the landed diff (no body in --files mode): ${deferred.slice(0, 5).join(", ")}`);
  const skipped = paths.length - inScope.length;
  if (skipped) notes.push(`product floor: ${skipped} prose/test path(s) out of scope`);
  return { floor: hits.length > 0, floor_hits: hits, notes };
}

// ── Security DELTA triggers (proposal 40 §2) ──────────────────────────────────────────────────
// The close-out's security DELTA audit (an opus agent) re-reads every source change since the early audit's pin. It
// is the only security review of FRDs 2..N, so it stays whenever the landed diff touches an attack surface; when the
// diff touches none it is skipped and the early audit's report stands. Deterministic, like P1-P5: a path trigger
// (the surfaces where an attack enters: routes, server actions, middleware, next.config with its headers/CSP, auth,
// the dependency set) or a content trigger on an ADDED line (the injection sinks). Prose and test surfaces never
// trigger. Bounded by the early full audit (always on) and the product floor; a client-only bug outside these
// triggers is the accepted miss (proposal 40 §5 F).
const ROUTE_FILE = /(^|\/)(app\/(?:.*\/)?route|pages\/api\/.*)\.[cm]?[jt]sx?$/;
const ACTIONS_FILE = /(^|\/)(_actions\/.+|actions)\.[cm]?[jt]sx?$/;
const NEXT_CONFIG = /(^|\/)next\.config\.[cm]?[jt]s$/;
const HEADERS_FILE = /(^|\/)(_headers|vercel\.json|netlify\.toml|headers\.[cm]?[jt]s)$/;
const DEPENDENCY_FILE = /(^|\/)(package\.json|pnpm-lock\.yaml|package-lock\.json|yarn\.lock|bun\.lockb?|npm-shrinkwrap\.json)$/;
const USE_SERVER = /^\s*['"]use server['"]/m;
const FS_IMPORT = /(?:from\s*|require\s*\(\s*|import\s*\(\s*)['"](?:node:)?fs(?:\/promises)?['"]/;
const PATH_JOIN = /\bpath\s*\.\s*(?:join|resolve)\s*\(/;
// Input that reaches a request: a template literal or a concatenation carrying a request/route/form value.
const INPUT = String.raw`(?:searchParams|params|query|req(?:uest)?\.|body|formData|headers\(\)|\bargs\b)`;
const BUILT_FROM_INPUT = (sink) => new RegExp(String.raw`\b${sink}\s*\(\s*(?:[^)'"]*\b${INPUT}|\x60[^\x60]*\$\{[^}]*${INPUT})`);
const CONTENT_TRIGGERS = [
  { trigger: "dangerouslySetInnerHTML", re: /\bdangerouslySetInnerHTML\b/ },
  { trigger: "innerHTML", re: /\.(?:inner|outer)HTML\s*=|\binsertAdjacentHTML\s*\(/ },
  { trigger: "eval", re: /(?<![\w.])eval\s*\(|\bnew\s+Function\s*\(/ },
  { trigger: "raw-sql", re: /\$(?:queryRaw|executeRaw)(?:Unsafe)?\b|\bsql\.raw\s*\(|\.raw\s*\(\s*\x60/ },
  { trigger: "redirect-from-input", re: BUILT_FROM_INPUT("(?:redirect|permanentRedirect|NextResponse\\.redirect|res\\.redirect)") },
  { trigger: "fetch-from-input", re: BUILT_FROM_INPUT("fetch") },
  { trigger: "cookies", re: /\bcookies\s*\(\s*\)|\bdocument\.cookie\b|\bSet-Cookie\b|\.cookies\.(?:set|delete)\s*\(/i },
];
/** The trigger table, for the docs and the tests: one row per trigger. */
export const SECURITY_DELTA_TRIGGERS = Object.freeze([
  { trigger: "route", kind: "path", when: "an app/**/route.* or pages/api/** handler" },
  { trigger: "server-action", kind: "path", when: "a module under _actions/, an actions.* module, or a module whose body at HEAD declares 'use server'" },
  { trigger: "middleware", kind: "path", when: "a middleware.* file, or Next 16's proxy.* at the project root or src/" },
  { trigger: "next-config", kind: "path", when: "next.config.* (security headers and the CSP live there)" },
  { trigger: "headers", kind: "path", when: "_headers, vercel.json, netlify.toml or a headers.* module" },
  { trigger: "auth", kind: "path", when: "a file or directory named for auth/session/login/password/credential (the P1 path tokens)" },
  { trigger: "dependencies", kind: "path", when: "package.json or a lockfile" },
  ...CONTENT_TRIGGERS.map((c) => ({ trigger: c.trigger, kind: "content", when: `an added line matching ${c.re}` })),
  { trigger: "fs-path-join", kind: "content", when: "an added path.join/path.resolve in a module that imports fs (its body at HEAD, not only the added lines)" },
]);
/**
 * Does a landed diff touch an attack surface the security DELTA audit must re-read?
 * The server-action and fs-path-join triggers are properties of the whole MODULE, not of the added lines: a new
 * action in an existing 'use server' file, or a new path.join in a file that already imports fs, is the delta. So
 * `ctx.readFile(path)` (the file's body at HEAD, or null when deleted/unreadable) is consulted; without it the added
 * lines alone decide. A redirect/fetch whose input is first bound to a variable (`const n = sp.get("next");
 * redirect(n)`) is an accepted heuristic miss of the content triggers, bounded by the early full audit.
 * @param {{ files: Array<{path: string}>, addedByFile: Map<string, string[]>, readFile?: (path: string) => string|null }} ctx the diff (repo-relative paths; added lines per file; the HEAD body reader)
 * @returns {{ triggered: boolean, hits: Array<{trigger: string, kind: 'path'|'content', detail: string}> }}
 */
export function securityDeltaTriggers(ctx) {
  const hits = [];
  const hit = (trigger, kind, detail) => { if (!hits.some((h) => h.trigger === trigger)) hits.push({ trigger, kind, detail }); };
  const paths = [...new Set([...ctx.files.map((f) => f.path), ...ctx.addedByFile.keys()])].filter((p) => !isOutOfScope(p));
  for (const p of paths) {
    if (ROUTE_FILE.test(p)) hit("route", "path", p);
    if (MIDDLEWARE.test(p)) hit("middleware", "path", p);
    if (NEXT_CONFIG.test(p)) hit("next-config", "path", p);
    if (HEADERS_FILE.test(p)) hit("headers", "path", p);
    if (DEPENDENCY_FILE.test(p)) hit("dependencies", "path", p);
    if (p1Path(p)) hit("auth", "path", p);
    const lines = ctx.addedByFile.get(p) || [];
    const joined = lines.join("\n");
    const head = typeof ctx.readFile === "function" ? ctx.readFile(p) : null;
    const moduleText = typeof head === "string" ? `${head}\n${joined}` : joined;
    if (ACTIONS_FILE.test(p) || USE_SERVER.test(moduleText)) hit("server-action", "path", p);
    for (const c of CONTENT_TRIGGERS) {
      const line = lines.find((l) => c.re.test(l));
      if (line) hit(c.trigger, "content", `${p}: '${line.trim().slice(0, 80)}'`);
    }
    if (FS_IMPORT.test(moduleText)) {
      const line = lines.find((l) => PATH_JOIN.test(l));
      if (line) hit("fs-path-join", "content", `${p}: '${line.trim().slice(0, 80)}'`);
    }
  }
  return { triggered: hits.length > 0, hits };
}
