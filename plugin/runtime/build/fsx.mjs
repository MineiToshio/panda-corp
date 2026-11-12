// File-system primitives of the v2 build engine: atomic writes (mode 0600), hash-chained JSONL,
// the schema validator (D25 keyword subset) and the tracked-path guard (D1).
import { createHash, randomBytes } from "node:crypto";
import { execFile } from "node:child_process";
import * as fsp from "node:fs/promises";
import path from "node:path";
import { SCHEMAS_DIR, assertSafeId, resolveInside } from "./paths.mjs";

const err = (code, message, extra = {}) => Object.assign(new Error(message), { code }, extra);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Lowercase hex sha256 of a string or Buffer. */
export const sha256Hex = (data) => createHash("sha256").update(data).digest("hex");

/**
 * Current instant as ISO-8601. `PANDACORP_NOW` (test hook) replaces the wall clock everywhere.
 * @param {{env?: object, clock?: () => Date}} [deps]
 */
export function nowIso({ env = process.env, clock = () => new Date() } = {}) {
  const forced = env.PANDACORP_NOW;
  if (forced) {
    if (!Number.isFinite(Date.parse(forced))) throw err("USAGE", `PANDACORP_NOW is not an ISO instant: ${forced}`);
    return forced;
  }
  return clock().toISOString();
}

// ---------------------------------------------------------------------------------------------
// Atomic writes
// ---------------------------------------------------------------------------------------------

/**
 * Write a file atomically (temp file in the same directory, fsync, rename), mode 0600 by default.
 * Parent directories are created. A reader sees the old or the new content, never a partial one.
 * @param {string} file absolute target
 * @param {string|Buffer} data content
 * @param {{mode?: number, fs?: object}} [opts]
 */
export async function atomicWrite(file, data, { mode = 0o600, fs = fsp } = {}) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}-${randomBytes(4).toString("hex")}`;
  const handle = await fs.open(tmp, "w", mode);
  try {
    await handle.writeFile(data);
    await handle.sync();
  } catch (error) {
    await handle.close().catch(() => {});
    await fs.rm(tmp, { force: true }).catch(() => {});
    throw error;
  }
  await handle.close();
  try {
    await fs.rename(tmp, file);
  } catch (error) {
    await fs.rm(tmp, { force: true }).catch(() => {});
    throw error;
  }
}

/** Atomic text write (see atomicWrite). */
export const atomicWriteText = (file, text, opts) => atomicWrite(file, String(text), opts);

/** Atomic JSON write: 2-space indent, trailing newline. */
export const atomicWriteJson = (file, value, opts) => atomicWrite(file, `${JSON.stringify(value, null, 2)}\n`, opts);

/**
 * Read and parse a JSON file. A missing file returns `null` unless `required`.
 * Unparsable content throws LEDGER_CORRUPT (never a silent default).
 */
export async function readJson(file, { required = false, fs = fsp } = {}) {
  let text;
  try {
    text = await fs.readFile(file, "utf8");
  } catch (error) {
    if (error.code === "ENOENT" && !required) return null;
    throw error;
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw err("LEDGER_CORRUPT", `${file} is not valid JSON: ${error.message}`, { hint: "rebuild-state" });
  }
}

// ---------------------------------------------------------------------------------------------
// Hash-chained JSONL (D15)
// ---------------------------------------------------------------------------------------------

const TAIL_CHUNK = 64 * 1024;

// Last complete line of a file as {bytes, size}; null for an empty file. Torn last line = corrupt.
async function readLastLine(file, fs) {
  let handle;
  try {
    handle = await fs.open(file, "r");
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
  try {
    const { size } = await handle.stat();
    if (size === 0) return null;
    let want = TAIL_CHUNK;
    for (;;) {
      const len = Math.min(want, size);
      const buf = Buffer.alloc(len);
      await handle.read(buf, 0, len, size - len);
      if (buf[len - 1] !== 0x0a) throw err("JOURNAL_CHAIN", `${file} does not end with a newline (torn last line)`, { hint: "rebuild-state" });
      const cut = buf.lastIndexOf(0x0a, len - 2);
      if (cut >= 0) return buf.subarray(cut + 1, len - 1);
      if (len === size) return buf.subarray(0, len - 1);
      want *= 4;
    }
  } finally {
    await handle.close();
  }
}

// Short cross-process mutex around one append (mkdir lock, stale after 30 s).
async function withAppendLock(file, fs, fn) {
  const lock = `${file}.lock`;
  await fs.mkdir(path.dirname(file), { recursive: true });
  for (let attempt = 0; attempt < 600; attempt++) {
    try {
      await fs.mkdir(lock);
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      const st = await fs.stat(lock).catch(() => null);
      if (st && Date.now() - st.mtimeMs > 30_000) await fs.rm(lock, { recursive: true, force: true }).catch(() => {});
      await sleep(10);
      continue;
    }
    try {
      return await fn();
    } finally {
      await fs.rm(lock, { recursive: true, force: true }).catch(() => {});
    }
  }
  throw err("CONTENDED", `journal append lock busy: ${file}`);
}

/**
 * Append one record to a hash-chained JSONL file.
 * The chain rule (D15): `seq` is gap-free from 1; the first line has `prev: null`; `prev` is the lowercase
 * hex sha256 of the previous line's UTF-8 bytes without its trailing newline.
 * @param {string} file JSONL path
 * @param {(link: {seq: number, prev: string|null}) => object} build returns the record; it must put `seq` and `prev` in it
 * @returns {Promise<{record: object, hash: string}>} the written record and the hash the next line must carry as `prev`
 */
export async function appendChainedJsonl(file, build, { fs = fsp } = {}) {
  return withAppendLock(file, fs, async () => {
    const last = await readLastLine(file, fs);
    let seq = 1;
    let prev = null;
    if (last) {
      let parsed;
      try {
        parsed = JSON.parse(last.toString("utf8"));
      } catch (error) {
        throw err("JOURNAL_CHAIN", `${file}: last line is not JSON (${error.message})`, { hint: "rebuild-state" });
      }
      if (!Number.isInteger(parsed?.seq)) throw err("JOURNAL_CHAIN", `${file}: last line has no integer seq`, { hint: "rebuild-state" });
      seq = parsed.seq + 1;
      prev = sha256Hex(last);
    }
    const record = build({ seq, prev });
    if (record?.seq !== seq || record?.prev !== prev) throw err("INVALID_STATE", "chained record must carry the given seq and prev");
    const text = JSON.stringify(record);
    const handle = await fs.open(file, "a", 0o600);
    try {
      await handle.writeFile(`${text}\n`);
      await handle.sync();
    } finally {
      await handle.close();
    }
    return { record, hash: sha256Hex(Buffer.from(text, "utf8")) };
  });
}

/**
 * Read a hash-chained JSONL file and verify the whole chain.
 * @returns {Promise<{records: object[], head: {seq: number, hash: string}|null}>} a missing or empty file gives no records
 * @throws JOURNAL_CHAIN (exit 5) on a bad line, a gap, a wrong `prev` or a torn last line
 */
export async function readChainedJsonl(file, { fs = fsp } = {}) {
  let text;
  try {
    text = await fs.readFile(file, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return { records: [], head: null };
    throw error;
  }
  if (text === "") return { records: [], head: null };
  if (!text.endsWith("\n")) throw err("JOURNAL_CHAIN", `${file} does not end with a newline (torn last line)`, { hint: "rebuild-state" });
  const lines = text.slice(0, -1).split("\n");
  const records = [];
  let prevHash = null;
  for (let i = 0; i < lines.length; i++) {
    let record;
    try {
      record = JSON.parse(lines[i]);
    } catch (error) {
      throw err("JOURNAL_CHAIN", `${file}:${i + 1} is not JSON (${error.message})`, { hint: "rebuild-state", line: i + 1 });
    }
    if (record?.seq !== i + 1) throw err("JOURNAL_CHAIN", `${file}:${i + 1} seq ${record?.seq} breaks the gap-free sequence`, { hint: "rebuild-state", line: i + 1 });
    if ((record.prev ?? null) !== prevHash) throw err("JOURNAL_CHAIN", `${file}:${i + 1} prev does not match the previous line hash`, { hint: "rebuild-state", line: i + 1 });
    records.push(record);
    prevHash = sha256Hex(Buffer.from(lines[i], "utf8"));
  }
  return { records, head: { seq: records.length, hash: prevHash } };
}

// ---------------------------------------------------------------------------------------------
// Schema validator (D25 keyword subset)
// ---------------------------------------------------------------------------------------------

const IGNORED_KEYWORDS = new Set(["$schema", "$id", "title", "description", "default", "format"]);
const SUPPORTED_KEYWORDS = new Set([
  "type", "properties", "required", "additionalProperties", "items", "enum", "const",
  "oneOf", "anyOf", "allOf", "if", "then", "minimum", "maximum", "minLength", "pattern",
]);
const TYPE_NAMES = new Set(["string", "number", "integer", "boolean", "object", "array", "null"]);

/**
 * Throw when a schema (or any sub-schema) uses a keyword outside the D25 subset.
 * @param {object|boolean} schema
 * @param {string} [where] pointer used in the message
 */
export function assertSupportedSchema(schema, where = "#") {
  if (typeof schema === "boolean") return;
  if (schema === null || typeof schema !== "object" || Array.isArray(schema)) {
    throw err("UNSUPPORTED_SCHEMA", `schema at ${where} must be an object or boolean`);
  }
  for (const [key, value] of Object.entries(schema)) {
    if (IGNORED_KEYWORDS.has(key)) continue;
    if (!SUPPORTED_KEYWORDS.has(key)) throw err("UNSUPPORTED_SCHEMA", `unsupported schema keyword "${key}" at ${where}`);
    switch (key) {
      case "properties":
        for (const [name, sub] of Object.entries(value)) assertSupportedSchema(sub, `${where}/properties/${name}`);
        break;
      case "additionalProperties":
        assertSupportedSchema(value, `${where}/additionalProperties`);
        break;
      case "items":
        if (Array.isArray(value)) throw err("UNSUPPORTED_SCHEMA", `tuple "items" at ${where} is not supported`);
        assertSupportedSchema(value, `${where}/items`);
        break;
      case "oneOf": case "anyOf": case "allOf":
        if (!Array.isArray(value)) throw err("UNSUPPORTED_SCHEMA", `${key} at ${where} must be an array`);
        value.forEach((sub, i) => assertSupportedSchema(sub, `${where}/${key}/${i}`));
        break;
      case "if": case "then":
        assertSupportedSchema(value, `${where}/${key}`);
        break;
      case "type": {
        const names = Array.isArray(value) ? value : [value];
        for (const name of names) if (!TYPE_NAMES.has(name)) throw err("UNSUPPORTED_SCHEMA", `unknown type "${name}" at ${where}`);
        break;
      }
      case "required":
        if (!Array.isArray(value)) throw err("UNSUPPORTED_SCHEMA", `required at ${where} must be an array`);
        break;
      default:
    }
  }
}

const typeOf = (value) => (value === null ? "null" : Array.isArray(value) ? "array" : typeof value);
const matchesType = (name, value) => (name === "integer" ? Number.isInteger(value) : name === "number" ? typeof value === "number" && Number.isFinite(value) : typeOf(value) === name);
/** Structural equality of two JSON values (key order ignored). */
export const deepEqual = (a, b) => {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  return ka.length === kb.length && ka.every((k) => Object.hasOwn(b, k) && deepEqual(a[k], b[k]));
};
const MAX_ERRORS = 50;

function check(schema, value, at, errors) {
  if (errors.length >= MAX_ERRORS) return;
  if (schema === true) return;
  if (schema === false) { errors.push({ path: at, message: "no value is allowed here" }); return; }
  if ("type" in schema) {
    const names = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!names.some((n) => matchesType(n, value))) {
      errors.push({ path: at, message: `expected ${names.join("|")}, got ${typeOf(value)}` });
      return;
    }
  }
  if ("const" in schema && !deepEqual(schema.const, value)) errors.push({ path: at, message: `must equal ${JSON.stringify(schema.const)}` });
  if ("enum" in schema && !schema.enum.some((v) => deepEqual(v, value))) errors.push({ path: at, message: `must be one of ${JSON.stringify(schema.enum)}` });
  if (typeof value === "number") {
    if ("minimum" in schema && value < schema.minimum) errors.push({ path: at, message: `must be >= ${schema.minimum}` });
    if ("maximum" in schema && value > schema.maximum) errors.push({ path: at, message: `must be <= ${schema.maximum}` });
  }
  if (typeof value === "string") {
    if ("minLength" in schema && [...value].length < schema.minLength) errors.push({ path: at, message: `must have at least ${schema.minLength} characters` });
    if ("pattern" in schema && !new RegExp(schema.pattern, "u").test(value)) errors.push({ path: at, message: `must match /${schema.pattern}/` });
  }
  if (typeOf(value) === "object") {
    for (const key of schema.required ?? []) if (!Object.hasOwn(value, key)) errors.push({ path: `${at}/${key}`, message: "required property is missing" });
    const props = schema.properties ?? {};
    for (const [key, sub] of Object.entries(props)) if (Object.hasOwn(value, key)) check(sub, value[key], `${at}/${key}`, errors);
    if ("additionalProperties" in schema) {
      for (const key of Object.keys(value)) {
        if (Object.hasOwn(props, key)) continue;
        if (schema.additionalProperties === false) errors.push({ path: `${at}/${key}`, message: "additional property is not allowed" });
        else if (schema.additionalProperties !== true) check(schema.additionalProperties, value[key], `${at}/${key}`, errors);
      }
    }
  }
  if (Array.isArray(value) && "items" in schema) value.forEach((item, i) => check(schema.items, item, `${at}/${i}`, errors));
  if (schema.allOf) for (const sub of schema.allOf) check(sub, value, at, errors);
  if (schema.anyOf && !schema.anyOf.some((sub) => matches(sub, value))) errors.push({ path: at, message: `matches none of the ${schema.anyOf.length} anyOf alternatives` });
  if (schema.oneOf) {
    const hits = schema.oneOf.filter((sub) => matches(sub, value)).length;
    if (hits !== 1) errors.push({ path: at, message: `matches ${hits} of the ${schema.oneOf.length} oneOf alternatives (exactly 1 required)` });
  }
  if ("if" in schema && "then" in schema && matches(schema.if, value)) check(schema.then, value, at, errors);
}

function matches(schema, value) {
  const scratch = [];
  check(schema, value, "", scratch);
  return scratch.length === 0;
}

/**
 * Validate a value against a schema of the D25 subset.
 * @param {object|boolean} schema
 * @param {unknown} value
 * @returns {{ok: boolean, errors: {path: string, message: string}[]}} path is a JSON pointer ("" = root)
 * @throws UNSUPPORTED_SCHEMA when the schema uses a keyword outside the subset (checked up front)
 */
export function validate(schema, value) {
  assertSupportedSchema(schema);
  const errors = [];
  check(schema, value, "", errors);
  return { ok: errors.length === 0, errors };
}

/**
 * Validate and throw a typed error on failure.
 * @param {object|boolean} schema
 * @param {unknown} value
 * @param {{label?: string, code?: string, hint?: string}} [opts] code defaults to INVALID_INPUT
 */
export function assertValid(schema, value, { label = "value", code = "INVALID_INPUT", hint } = {}) {
  const { ok, errors } = validate(schema, value);
  if (ok) return;
  const shown = errors.slice(0, 5).map((e) => `${e.path || "/"}: ${e.message}`).join("; ");
  throw err(code, `${label} does not match its schema: ${shown}`, { errors, ...(hint ? { hint } : {}) });
}

const schemaCache = new Map();

/**
 * Load one of the engine schemas by name (`state`, `journal-event`, `report`, ...), cached, keywords checked.
 * @param {string} name schema file stem under plugin/runtime/build/schemas
 * @param {{schemasDir?: string, fs?: object}} [opts]
 */
export async function loadSchema(name, { schemasDir = SCHEMAS_DIR, fs = fsp } = {}) {
  assertSafeId(name, "schema name");
  const file = path.join(schemasDir, `${name}.schema.json`);
  if (schemaCache.has(file)) return schemaCache.get(file);
  const schema = JSON.parse(await fs.readFile(file, "utf8"));
  assertSupportedSchema(schema, name);
  schemaCache.set(file, schema);
  return schema;
}

// ---------------------------------------------------------------------------------------------
// Tracked-path guard (D1)
// ---------------------------------------------------------------------------------------------

/** Default process runner: never rejects on a non-zero exit. Messages are forced to English (`LC_ALL=C`) so stderr checks are locale-proof. */
export function defaultExec(cmd, args, { cwd } = {}) {
  return new Promise((resolve) => {
    execFile(cmd, args, { cwd, encoding: "utf8", maxBuffer: 16 * 1024 * 1024, env: { ...process.env, LC_ALL: "C" } }, (error, stdout, stderr) => {
      resolve({ code: error ? (typeof error.code === "number" ? error.code : 127) : 0, stdout: stdout ?? "", stderr: stderr ?? "" });
    });
  });
}

/**
 * Is a path git-tracked? Runs `git ls-files --error-unmatch -- <path>` in the project.
 * A project that is not a git repository tracks nothing. Any other git failure fails closed.
 * @param {string} project absolute repo root
 * @param {string} relPath repo-relative path (file or directory)
 * @param {{exec?: Function}} [deps] `exec(cmd, args, {cwd}) -> Promise<{code, stdout, stderr}>`
 * @returns {Promise<boolean>}
 */
export async function isTrackedPath(project, relPath, { exec = defaultExec } = {}) {
  resolveInside(project, relPath);
  const res = await exec("git", ["ls-files", "--error-unmatch", "--", relPath], { cwd: project });
  if (res.code === 0) return true;
  if (res.code === 1) return false;
  if (/not a git repository/i.test(res.stderr)) return false;
  if (/outside repository/i.test(res.stderr)) throw err("INVALID_PATH", `${relPath} is outside the repository`);
  throw err("FAILCLOSED", `git ls-files failed (exit ${res.code}) for ${relPath}: ${res.stderr.trim().slice(0, 200)}`);
}

/**
 * Where a write of `relPath` must go (D1): the main checkout when the path is untracked, the integration
 * worktree when it is tracked there. The caller commits tracked writes on `lane/<run_id>/integration`.
 * @param {string} project main checkout root
 * @param {string} relPath repo-relative path
 * @param {{integrationRoot: string, exec?: Function}} opts integrationRoot = the integration worktree
 * @returns {Promise<{tracked: boolean, root: string, abs: string}>}
 */
export async function writeTarget(project, relPath, { integrationRoot, exec } = {}) {
  const tracked = await isTrackedPath(project, relPath, { exec });
  if (tracked && !integrationRoot) throw err("INVALID_PATH", `${relPath} is tracked: it must be written in the integration worktree`);
  const root = tracked ? integrationRoot : project;
  return { tracked, root, abs: resolveInside(root, relPath) };
}

/**
 * Refuse a main-checkout write of a tracked path.
 * @throws INVALID_PATH when `relPath` is tracked
 */
export async function assertNotTracked(project, relPath, deps) {
  if (await isTrackedPath(project, relPath, deps)) {
    throw err("INVALID_PATH", `${relPath} is git-tracked: the engine never writes a tracked file in the main checkout (write it in the integration worktree)`);
  }
}
