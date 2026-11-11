#!/usr/bin/env node
// test-build-v2-risk.mjs — T-B05: pins the contract of plugin/runtime/build/risk.mjs (D8 + AR2 A6, CLI doc 3.7,
// build-engine.md "Risk zone"). Real git fixtures, the REAL product-floor.mjs and classify-change.mjs (the module's
// documented collaborators), no network, nothing outside a throwaway temp dir.
//
// ASSUMED INTERFACE (the docs give no export name or signature for risk.mjs; reconcile test and module):
//   - The module exports an async-or-sync function, resolved by the first name present in
//     ["assessRisk", "riskZone", "computeRisk", "risk"], called as
//         fn({ root: <abs project dir>, files: [<repo-relative paths>] }, deps?)      // static zone (--files)
//         fn({ root: <abs project dir>, range: "<base>..<head>" }, deps?)             // diff zone (--range)
//     and returning (or resolving to) the D8 object
//         { zone: "none"|"floor"|"r1", rules: ["R1"|"R2"|"R3"|"R11"...],
//           signals: { product_floor: [], classify: [], security: [], risk_paths: [] },
//           irreversible: boolean, audit: boolean, failclosed: boolean, unclassified: [paths] }.
//   - `deps` is optional; the test passes `{ env }` (testEnv hooks) and relies on defaults for exec/fs.
//   - A classifier failure (exit 3) is returned as the object with zone "r1" + failclosed true, NOT thrown
//     (the CLI turns failclosed into exit 9).
//   - `.pandacorp/risk-paths`: one glob per line, `#` comments and blank lines ignored, a bare glob means "risk"
//     (also written here with the optional `risk ` prefix). `**` crosses directories, `*` does not.
//   - Each signals.* entry is an object or string; the test only inspects them through JSON.stringify and length.
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createFixture } from "./fixtures/build-v2/make-fixture.mjs";

const SCRATCH = process.env.PANDACORP_TEST_TMP || os.tmpdir();
const MODULE_URL = new URL("../runtime/build/risk.mjs", import.meta.url).href;
const FN_NAMES = ["assessRisk", "riskZone", "computeRisk", "risk"];

let passed = 0; let failed = 0;
const test = async (name, fn) => { try { await fn(); console.log(`PASS  ${name}`); passed++; } catch (e) { console.error(`FAIL  ${name}: ${e.message || e}`); failed++; } };
const ok = (value, message) => { if (!value) throw new Error(message); };
const eq = (actual, expected, message) => { if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`); };
const has = (arr, v, message) => ok(Array.isArray(arr) && arr.includes(v), `${message}: ${JSON.stringify(arr)} lacks ${v}`);
const hasnt = (arr, v, message) => ok(Array.isArray(arr) && !arr.includes(v), `${message}: ${JSON.stringify(arr)} must not contain ${v}`);

let riskFn = null; let loadError = null;
try {
  const mod = await import(MODULE_URL);
  const name = FN_NAMES.find((n) => typeof mod[n] === "function");
  if (name) riskFn = mod[name]; else loadError = `risk.mjs exports none of ${FN_NAMES.join(", ")} (exports: ${Object.keys(mod).join(", ") || "none"})`;
} catch (e) { loadError = `cannot import plugin/runtime/build/risk.mjs: ${e.message}`; }

const assess = async (input, env) => {
  if (!riskFn) throw new Error(loadError);
  return await riskFn(input, { env });
};

/** One fixture per test: a fresh repo under a fresh temp dir, always removed. */
const withFixture = async (fn) => {
  const dir = await mkdtemp(path.join(SCRATCH, "pc-risk-"));
  try {
    const fx = await createFixture("basic", { dir });
    await fn(fx, fx.env());
  } finally { await rm(dir, { recursive: true, force: true }); }
};
const write = async (fx, rel, text) => { const f = path.join(fx.root, rel); await mkdir(path.dirname(f), { recursive: true }); await writeFile(f, text); };
/** Commits `files` ({path: text}) on top of the fixture's initial commit and returns the `base..HEAD` range. */
const commitRange = async (fx, files) => {
  const base = fx.sha;
  for (const [p, t] of Object.entries(files)) await write(fx, p, t);
  fx.git("add", "-A");
  fx.git("commit", "-q", "-m", "change under test");
  return `${base}..HEAD`;
};
const rangeOf = async (fx, env, files) => assess({ root: fx.root, range: await commitRange(fx, files) }, env);
const shape = (r) => {
  ok(r && typeof r === "object", "result is not an object");
  ok(["none", "floor", "r1"].includes(r.zone), `zone out of enum: ${r.zone}`);
  ok(Array.isArray(r.rules), "rules is not an array");
  ok(r.signals && ["product_floor", "classify", "security", "risk_paths"].every((k) => Array.isArray(r.signals[k])), "signals lacks the four arrays");
  ok(typeof r.irreversible === "boolean" && typeof r.audit === "boolean" && typeof r.failclosed === "boolean", "irreversible/audit/failclosed must be booleans");
  ok(Array.isArray(r.unclassified), "unclassified is not an array");
  return r;
};
const sig = (r, key) => JSON.stringify(r.signals[key]);

await test("module loads and exports the risk function", async () => { ok(riskFn, loadError); });

await test("result shape: zone, rules, the four signal arrays, booleans, unclassified", async () => {
  await withFixture(async (fx, env) => { shape(await rangeOf(fx, env, { "docs/notes.md": "# notes\n" })); });
});

// ── r1: the product floor (R1) ──────────────────────────────────────────────────────────────────
await test("login diff (range) -> r1 via R1, product_floor signal, irreversible, audit", async () => {
  await withFixture(async (fx, env) => {
    const r = shape(await rangeOf(fx, env, {
      "src/app/login/actions.ts": "import { signIn } from \"next-auth\";\nexport async function login(form: FormData) { return signIn(\"credentials\", form); }\n",
    }));
    eq(r.zone, "r1", "login diff zone"); has(r.rules, "R1", "rules"); eq(r.failclosed, false, "failclosed");
    ok(r.signals.product_floor.length > 0, "product_floor signal missing");
    eq(r.irreversible, true, "irreversible (r1)"); eq(r.audit, true, "audit (r1)");
  });
});

await test("login surface by path only (--files, no body) -> r1", async () => {
  await withFixture(async (fx, env) => {
    const r = shape(await assess({ root: fx.root, files: ["src/lib/auth/session.ts"] }, env));
    eq(r.zone, "r1", "auth path zone"); has(r.rules, "R1", "rules");
  });
});

await test("payments diff (payment SDK import) -> r1, irreversible, audit", async () => {
  await withFixture(async (fx, env) => {
    const r = shape(await rangeOf(fx, env, {
      "src/lib/billing/charge.ts": "import Stripe from \"stripe\";\nexport const stripe = new Stripe(\"x\");\nexport async function charge(amount: number) { return stripe.paymentIntents.create({ amount }); }\n",
    }));
    eq(r.zone, "r1", "payments zone"); has(r.rules, "R1", "rules");
    eq(r.irreversible, true, "irreversible"); eq(r.audit, true, "audit");
  });
});

await test("secrets diff (code reads a secret env var) -> r1", async () => {
  await withFixture(async (fx, env) => {
    const r = shape(await rangeOf(fx, env, {
      "src/lib/mailer.ts": "export const apiKey = process.env.RESEND_API_KEY;\nexport const hasKey = Boolean(apiKey);\n",
    }));
    eq(r.zone, "r1", "secrets zone"); has(r.rules, "R1", "rules"); eq(r.irreversible, true, "irreversible");
  });
});

await test("secrets diff (secret-shaped key added to an env file) -> r1", async () => {
  await withFixture(async (fx, env) => {
    const r = shape(await rangeOf(fx, env, { ".env.example": "# service token\nSTRIPE_SECRET_KEY=\n" }));
    eq(r.zone, "r1", "env secret key zone");
  });
});

await test("destructive data deletion (DROP TABLE in a migration script) -> r1, irreversible", async () => {
  await withFixture(async (fx, env) => {
    const r = shape(await rangeOf(fx, env, { "src/lib/cleanup.ts": "export const wipe = \"DROP TABLE items\";\nexport async function run(db: { query(q: string): Promise<void> }) { await db.query(wipe); }\n" }));
    eq(r.zone, "r1", "destructive zone"); has(r.rules, "R1", "rules"); eq(r.irreversible, true, "irreversible");
  });
});

await test("destructive data deletion (unfiltered DELETE) -> r1", async () => {
  await withFixture(async (fx, env) => {
    const r = shape(await rangeOf(fx, env, { "src/lib/purge.ts": "export async function purge(db: { query(q: string): Promise<void> }) { await db.query(\"DELETE FROM items\"); }\n" }));
    eq(r.zone, "r1", "unfiltered delete zone"); eq(r.irreversible, true, "irreversible");
  });
});

await test("migration WITH a personal field -> r1", async () => {
  await withFixture(async (fx, env) => {
    const r = shape(await rangeOf(fx, env, { "migrations/0002_add_email.sql": "ALTER TABLE profiles ADD COLUMN email text;\n" }));
    eq(r.zone, "r1", "personal-field migration zone"); has(r.rules, "R1", "rules");
    ok(r.signals.product_floor.length > 0, "product_floor signal missing"); eq(r.irreversible, true, "irreversible");
  });
});

await test("r1 wins over every other signal in the same diff (max wins)", async () => {
  await withFixture(async (fx, env) => {
    const r = shape(await rangeOf(fx, env, {
      "src/app/login/page.tsx": "export default function Page() { return null; }\n",
      ".github/workflows/ci.yml": "name: ci\non: push\n",
      "docs/notes.md": "# notes\n",
    }));
    eq(r.zone, "r1", "mixed diff zone"); has(r.rules, "R1", "rules");
  });
});

// ── floor: classifier critical signals only (R2), never r1 ─────────────────────────────────────
await test("CI-only diff -> floor via R2, not r1, not irreversible", async () => {
  await withFixture(async (fx, env) => {
    const r = shape(await rangeOf(fx, env, { ".github/workflows/ci.yml": "name: ci\non: push\njobs:\n  test:\n    runs-on: ubuntu-latest\n" }));
    eq(r.zone, "floor", "CI-only zone"); has(r.rules, "R2", "rules"); hasnt(r.rules, "R1", "rules");
    eq(r.signals.product_floor.length, 0, "product_floor must be empty"); ok(/S7/.test(sig(r, "classify")), "classify signal S7 missing");
    eq(r.irreversible, false, "irreversible"); eq(r.failclosed, false, "failclosed");
  });
});

await test("package.json-only diff -> floor, audit true (R3 never changes the zone)", async () => {
  await withFixture(async (fx, env) => {
    const r = shape(await rangeOf(fx, env, { "package.json": `${JSON.stringify({ name: "fixture", version: "0.0.1", private: true, type: "module", scripts: { test: "node --test" }, devDependencies: { tinydep: "1.0.0" } }, null, 2)}\n` }));
    eq(r.zone, "floor", "package.json-only zone"); has(r.rules, "R2", "rules"); hasnt(r.rules, "R1", "rules");
    eq(r.audit, true, "dependency change triggers the security audit"); ok(r.signals.security.length > 0, "security signal missing");
    eq(r.irreversible, false, "irreversible");
  });
});

await test("plugin/**-only diff -> floor (machinery), not r1", async () => {
  await withFixture(async (fx, env) => {
    const r = shape(await rangeOf(fx, env, { "plugin/runtime/build/helper.mjs": "export const helper = () => 1;\n" }));
    eq(r.zone, "floor", "plugin-only zone"); has(r.rules, "R2", "rules"); hasnt(r.rules, "R1", "rules");
    eq(r.signals.product_floor.length, 0, "product_floor must be empty"); eq(r.irreversible, false, "irreversible");
  });
});

await test("query-only diff (data layer, no personal field) -> floor, irreversible via S5", async () => {
  await withFixture(async (fx, env) => {
    const r = shape(await rangeOf(fx, env, { "src/lib/queries/listItems.ts": "export const listItems = \"select id, name from items order by name\";\n" }));
    eq(r.zone, "floor", "query-only zone"); has(r.rules, "R2", "rules"); hasnt(r.rules, "R1", "rules");
    eq(r.signals.product_floor.length, 0, "product_floor must be empty");
    ok(/S5/.test(sig(r, "classify")), "classify signal S5 missing"); eq(r.irreversible, true, "S5 makes the change irreversible");
  });
});

await test("migration WITHOUT personal fields -> floor, not r1", async () => {
  await withFixture(async (fx, env) => {
    const r = shape(await rangeOf(fx, env, { "migrations/0002_add_color.sql": "ALTER TABLE items ADD COLUMN color text;\n" }));
    eq(r.zone, "floor", "plain migration zone"); has(r.rules, "R2", "rules"); hasnt(r.rules, "R1", "rules");
    eq(r.signals.product_floor.length, 0, "product_floor must be empty"); eq(r.failclosed, false, "failclosed");
  });
});

await test("the same floor cases through --files give the same zone", async () => {
  await withFixture(async (fx, env) => {
    for (const p of [".github/workflows/ci.yml", "package.json", "plugin/runtime/build/helper.mjs", "src/lib/queries/listItems.ts"]) {
      const r = shape(await assess({ root: fx.root, files: [p] }, env));
      eq(r.zone, "floor", `--files ${p}`);
    }
  });
});

// ── none ────────────────────────────────────────────────────────────────────────────────────────
await test("docs-only diff -> none, no rules, not irreversible, no audit", async () => {
  await withFixture(async (fx, env) => {
    const r = shape(await rangeOf(fx, env, { "docs/notes.md": "# notes\n\nJust some plain prose about the release plan.\n" }));
    eq(r.zone, "none", "docs-only zone"); eq(r.rules.length, 0, "rules"); eq(r.irreversible, false, "irreversible");
    eq(r.audit, false, "audit"); eq(r.failclosed, false, "failclosed");
  });
});

await test("ordinary feature file -> none", async () => {
  await withFixture(async (fx, env) => {
    const r = shape(await rangeOf(fx, env, { "src/alpha/list.ts": "export const items = [1, 2, 3];\nexport const count = items.length;\n" }));
    eq(r.zone, "none", "feature zone"); eq(r.irreversible, false, "irreversible");
  });
});

await test("A6: a normal-level S17 (madge not installed) goes to classify/unclassified and does not raise the zone", async () => {
  await withFixture(async (fx, env) => {
    // The fixture has no node_modules/.bin/madge, so the classifier reports S17 at level "normal".
    const r = shape(await assess({ root: fx.root, files: ["src/alpha/list.ts"] }, env));
    eq(r.zone, "none", "zone with only a normal S17"); hasnt(r.rules, "R2", "rules");
    ok(/S17/.test(sig(r, "classify")), `normal S17 must be copied to signals.classify: ${sig(r, "classify")}`);
    has(r.unclassified, "src/alpha/list.ts", "unclassified"); eq(r.irreversible, false, "irreversible"); eq(r.failclosed, false, "failclosed");
  });
});

// ── fail-closed ─────────────────────────────────────────────────────────────────────────────────
await test("classifier exit 3 (not a git repository) -> r1 + failclosed, never an exception", async () => {
  const dir = await mkdtemp(path.join(SCRATCH, "pc-risk-nogit-"));
  try {
    await writeFile(path.join(dir, "x.ts"), "export const x = 1;\n");
    const r = shape(await assess({ root: dir, files: ["x.ts"] }, createFixtureEnv(dir)));
    eq(r.zone, "r1", "failclosed zone"); eq(r.failclosed, true, "failclosed flag");
    eq(r.irreversible, true, "r1 is irreversible");
  } finally { await rm(dir, { recursive: true, force: true }); }
});

await test("classifier exit 3 (empty --files list) -> r1 + failclosed", async () => {
  await withFixture(async (fx, env) => {
    const r = shape(await assess({ root: fx.root, files: [] }, env));
    eq(r.zone, "r1", "empty list zone"); eq(r.failclosed, true, "failclosed flag");
  });
});

// ── risk-paths (R11) ────────────────────────────────────────────────────────────────────────────
await test("R11: a risk-paths glob raises none to floor; without the file the zone is unchanged and the file is unclassified", async () => {
  await withFixture(async (fx, env) => {
    const before = shape(await assess({ root: fx.root, files: ["src/alpha/list.ts"] }, env));
    eq(before.zone, "none", "zone without risk-paths"); has(before.unclassified, "src/alpha/list.ts", "unclassified without risk-paths");
    await write(fx, ".pandacorp/risk-paths", "# owner-confirmed risk surfaces\n\nsrc/alpha/**\n");
    const r = shape(await assess({ root: fx.root, files: ["src/alpha/list.ts"] }, env));
    eq(r.zone, "floor", "zone with matching glob"); has(r.rules, "R11", "rules"); hasnt(r.rules, "R1", "rules");
    ok(r.signals.risk_paths.length > 0, "risk_paths signal missing"); eq(r.irreversible, false, "risk-paths alone is not irreversible");
  });
});

await test("R11: a non-matching path stays none; a `risk ` prefixed glob matches; `*` does not cross directories", async () => {
  await withFixture(async (fx, env) => {
    await write(fx, ".pandacorp/risk-paths", "risk src/beta/*.ts\n");
    const hit = shape(await assess({ root: fx.root, files: ["src/beta/view.ts"] }, env));
    eq(hit.zone, "floor", "prefixed glob match"); has(hit.rules, "R11", "rules");
    const miss = shape(await assess({ root: fx.root, files: ["src/alpha/list.ts"] }, env));
    eq(miss.zone, "none", "non-matching zone"); eq(miss.signals.risk_paths.length, 0, "risk_paths must be empty");
    const deep = shape(await assess({ root: fx.root, files: ["src/beta/sub/deep.ts"] }, env));
    eq(deep.zone, "none", "`*` must not cross a directory boundary");
  });
});

await test("R11: risk-paths never lowers r1", async () => {
  await withFixture(async (fx, env) => {
    await write(fx, ".pandacorp/risk-paths", "src/**\n");
    const r = shape(await assess({ root: fx.root, files: ["src/lib/auth/session.ts"] }, env));
    eq(r.zone, "r1", "r1 with a matching glob"); has(r.rules, "R1", "rules");
  });
});

await test("R11 via range: a committed diff on a risk-paths glob is floor", async () => {
  await withFixture(async (fx, env) => {
    await write(fx, ".pandacorp/risk-paths", "src/alpha/**\n");
    fx.git("add", "-A"); fx.git("commit", "-q", "-m", "risk-paths");
    const base = fx.git("rev-parse", "HEAD");
    for (const [p, t] of Object.entries({ "src/alpha/list.ts": "export const items = [1, 2];\n" })) await write(fx, p, t);
    fx.git("add", "-A"); fx.git("commit", "-q", "-m", "alpha");
    const r = shape(await assess({ root: fx.root, range: `${base}..HEAD` }, env));
    eq(r.zone, "floor", "range zone"); has(r.rules, "R11", "rules");
  });
});

// ── irreversible / audit flag semantics (the autonomy veto, BUILD-12) ─────────────────────────────
await test("irreversible = r1 OR S5 OR S8 only: CI, package.json, plugin and risk-paths-only are reversible", async () => {
  await withFixture(async (fx, env) => {
    const cases = [
      [".github/workflows/ci.yml", false], ["package.json", false], ["plugin/runtime/build/helper.mjs", false],
      ["src/lib/queries/listItems.ts", true], ["migrations/0002_add_color.sql", true], ["src/lib/auth/session.ts", true], ["docs/notes.md", false],
    ];
    for (const [p, expected] of cases) {
      const r = shape(await assess({ root: fx.root, files: [p] }, env));
      eq(r.irreversible, expected, `irreversible for ${p} (zone ${r.zone})`);
    }
  });
});

await test("audit = security-delta trigger OR r1: route and middleware trigger it, a plain feature file does not", async () => {
  await withFixture(async (fx, env) => {
    const route = shape(await assess({ root: fx.root, files: ["src/app/api/items/route.ts"] }, env));
    eq(route.audit, true, "route handler audit"); ok(route.signals.security.length > 0, "security signal missing");
    const plain = shape(await assess({ root: fx.root, files: ["src/alpha/list.ts"] }, env));
    eq(plain.audit, false, "plain file audit");
    const r1 = shape(await assess({ root: fx.root, files: ["src/lib/auth/session.ts"] }, env));
    eq(r1.audit, true, "r1 audit");
  });
});

await test("a call is read-only: the fixture work tree is unchanged by assessing", async () => {
  await withFixture(async (fx, env) => {
    const range = await commitRange(fx, { "src/app/login/page.tsx": "export default function Page() { return null; }\n" });
    const before = fx.git("status", "--porcelain");
    await assess({ root: fx.root, range }, env); await assess({ root: fx.root, files: ["package.json"] }, env);
    eq(fx.git("status", "--porcelain"), before, "git status after assessing");
  });
});

function createFixtureEnv(dir) { return { PATH: process.env.PATH, HOME: path.join(dir, "home"), GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1", PANDACORP_NOW: "2026-11-11T12:00:00.000Z" }; }

console.log(`RESULT: ${passed} passed, ${failed} failed (${path.basename(fileURLToPath(import.meta.url))})`);
process.exit(failed ? 1 : 0);
