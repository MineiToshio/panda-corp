// drift-seal.mjs — BL-0206: the integrity seal on drift-proof.mjs's single-line JSON result.
//
// The build engine reads that line through a model: a MECH agent runs the command and hands the stdout
// back as a text field. A model is not a lossless copy channel — canary F1 lost a whole `"base":[…]` key
// (still valid JSON, so it parsed and read as "unloadable at last_green_sha") and canary F2 dropped one `]`
// (invalid JSON). The engine therefore never trusts a relayed line: the script seals it, the engine
// recomputes the seal over the exact text it received, and a mismatch is a transport fault — never a verdict.
//
// Seal = a 53-bit cyrb53 checksum (not a security primitive: it detects accidental alteration, which is the
// only adversary here) of the body text, appended as the LAST key: `…,"sum":"<14 hex>"}`. The body is ASCII
// only (non-ASCII escaped as \uXXXX, still plain JSON) so a model has fewer characters to mis-copy.
//
// The engine ships no imports (a Dynamic Workflow script has no module access), so it carries its own copy
// of `cyrb53` + the verifier; test-pandacorp-build.mjs seals fixtures with THIS module, so any drift between
// the two implementations fails every sealed scenario.

const SEAL_RE = /,"sum":"([0-9a-f]{14})"\}$/

/** cyrb53 (public domain, bryc): a fast 53-bit string hash, stable across Node versions. */
export function cyrb53(str) {
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return 4294967296 * (2097151 & h2) + (h1 >>> 0)
}

const sumOf = (body) => cyrb53(body).toString(16).padStart(14, '0')

/**
 * The one sealed stdout line for a result object.
 * @param {object} obj the result (must not carry its own `sum` key)
 * @returns {string} single-line ASCII JSON whose last key is `sum`
 */
export function sealLine(obj) {
  const body = JSON.stringify(obj).replace(/[\u007f-￿]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`)
  return `${body.slice(0, -1)},"sum":"${sumOf(body)}"}`
}

/**
 * Verify a received line against its own seal.
 * @param {string} text the line as received (a model may have altered it)
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
export function verifySealedLine(text) {
  const t = String(text || '').trim()
  const m = SEAL_RE.exec(t)
  if (!m) return { ok: false, reason: 'no integrity seal at the end of the line' }
  const body = `${t.slice(0, m.index)}}`
  return sumOf(body) === m[1] ? { ok: true } : { ok: false, reason: 'the integrity seal does not match the content' }
}
