// Pure admission decision: reservations, swap-trend veto, ceilings, safe mode and the read-only `admit` (split from admission.mjs).
import { ADMISSION, REACTIVE_MOTIVOS, SignalError, cpuCount, hMax, round3 } from './constants.mjs'
import { readSignals } from './signals.mjs'

/**
 * Memory a live unit may still claim but has not reached yet (D31, A22).
 * - agent-dispatched B unit (no process of its own): c_b for its first 60 s, then c_tool while alive.
 * - CLI-launched process: max(0, class peak - rss of its tree); peak = c_b + 0.35 (Codex worker) or c_h (heavy job).
 * @param {{class: 'B'|'H', origin: 'agent'|'cli', runtime?: 'codex'|'claude'|null, started_ms: number, rss_gib?: number|null}|{pending_gib: number}} res
 * @param {number} nowMs
 */
export function pendingGib(res, nowMs) {
  if (Number.isFinite(res.pending_gib)) return res.pending_gib // a caller that already computed it
  if (res.class === 'B' && res.origin === 'agent') {
    const ageS = Math.max(0, (nowMs - res.started_ms) / 1000)
    return ageS < ADMISSION.AGENT_FRESH_S ? ADMISSION.C_B_GIB : ADMISSION.C_TOOL_GIB
  }
  const peak = res.class === 'H' ? ADMISSION.C_H_GIB : ADMISSION.C_B_GIB + (res.runtime === 'codex' ? ADMISSION.CODEX_EXTRA_GIB : 0)
  return round3(Math.max(0, peak - (res.rss_gib ?? 0)))
}


function swapDeltas(history, signals) {
  const seq = [...history.map((h) => h.swapouts), signals.swapouts].slice(-(ADMISSION.HISTORY_LEN + 1))
  const out = []
  for (let i = 1; i < seq.length; i++) out.push(Math.max(0, seq[i] - seq[i - 1])) // a counter that went down was reset
  return out
}

/**
 * DEC-1 veto: L == 4 is handled before this (pausa_L4). Otherwise only the swap TREND vetoes: swapouts rose in >= 2 of the
 * last 3 deltas. L 2 with flat swap, or too few readings to tell, is no veto. `veto` is 'swap' at L == 1 and 'presion'
 * when the trend is corroborated by L >= 2.
 */
function readVeto(history, signals) {
  const deltas = swapDeltas(history, signals)
  const rising = deltas.filter((d) => d > 0).length >= 2
  return { veto: rising ? (signals.L >= 2 ? 'presion' : 'swap') : null, deltas }
}

/** Calm = L == 1 and zero swapouts across the last 3 readings (needed to rise above the floor). */
function isCalm(history, signals, deltas) {
  const lastThree = [...history, signals].slice(-ADMISSION.HISTORY_LEN)
  return deltas.length === ADMISSION.HISTORY_LEN && deltas.every((d) => d === 0) && lastThree.every((r) => r.L === 1)
}

const vetoMotivo = (veto) => (veto === 'swap' ? 'veto_swap' : 'veto_presion')

function ceilingTerms({ readyWidth, liveB, caps, runtimeShape }) {
  const reactive = caps.kReactive ?? (runtimeShape === 'R-C' || runtimeShape === 'drive' ? ADMISSION.K_REACTIVE_CODEX_START : Infinity)
  const reactiveMotivo = REACTIVE_MOTIVOS.includes(caps.kReactiveReason) ? caps.kReactiveReason : 'reactivo_contencion'
  const kTecho = runtimeShape === 'R-B' ? 1 : (caps.K_TECHO ?? ADMISSION.K_TECHO)
  return [
    ['ancho', readyWidth + liveB],
    ['techo', kTecho],
    ['owner_k', caps.kOwner ?? Infinity],
    [reactiveMotivo, reactive],
  ]
}

function decideHeavy(ctx) {
  const { live, veto, P, hMaxBase, runtimeShape } = ctx
  const hCap = veto || runtimeShape === 'R-B' ? 1 : hMaxBase
  const base = { A_ef: ctx.A_ef, P, veto, h_max: hCap }
  if (live.H >= hCap) {
    return { ...base, grant: null, motivo_limite: veto ? vetoMotivo(veto) : 'cpu_H', waitsForRam: false }
  }
  if (P >= ADMISSION.C_H_GIB || live.H === 0) {
    const limiter = veto ? vetoMotivo(veto) : 'cpu_H'
    return { ...base, grant: 'H', motivo_limite: limiter, waitsForRam: false }
  }
  return { ...base, grant: null, motivo_limite: 'ram', waitsForRam: true }
}

/**
 * One admission decision (pure). Grants at most one slot; the caller increments `live`/reservations and calls again.
 *
 * Veto (DEC-1): L == 4 launches nothing (pausa_L4); otherwise only a rising swap trend (>= 2 of the last 3 swapout deltas)
 * vetoes, which means series (1 builder + 1 heavy). L 2 with flat swap is no veto.
 *
 * `motivo_limite` on a grant names the binding ceiling (B: the ceiling term that equals `techo`; H: `cpu_H`, or the
 * veto that lowered H_max); on a wait it names why nothing was granted.
 *
 * @param {object} input
 * @param {{L:1|2|4, swapouts:number, A_gib:number}|null} input.signals current reading; null/missing = safe mode (SignalError upstream)
 * @param {{L:number, swapouts:number}[]} [input.history] previous readings, oldest first (last 3 are used)
 * @param {object[]} [input.reservations] live units, see {@link pendingGib}
 * @param {{B:number, H:number, R?:number}} input.live live builder-class units (R = live reviewers among them) and host-wide heavy slots in use
 * @param {number} [input.heavyQueued] heavy jobs waiting
 * @param {number} [input.readyWidth] ready, non-overlapping units not yet live (from the planner)
 * @param {{K_TECHO?:number, kOwner?:number, kReactive?:number, kReactiveReason?:string, colchonGib?:number}} [input.caps]
 * @param {'R-A'|'R-B'|'R-C'|'drive'} [input.runtimeShape] R-B is B = 1, H = 1 always
 * @param {'B'|'H'|null} [input.want] restrict the grant to one class (admit --class); null = either, heavy first
 * @param {'builder'|'reviewer'} [input.candidate] a reviewer is also bounded by the reviewer sub-cap
 * @param {number} [input.nowMs] @param {number} [input.ncpu]
 * @returns {{grant:'B'|'H'|null, motivo_limite:string, techo:number|null, suelo:number|null, A_ef:number, P:number, veto:null|'presion'|'swap', h_max:number|null, safe_mode:false}}
 */
export function decide({
  signals, history = [], reservations = [], live, heavyQueued = 0, readyWidth = 1, caps = {},
  runtimeShape = 'R-A', want = null, candidate = 'builder', nowMs = Date.now(), ncpu = cpuCount(),
}) {
  if (!signals) return safeModeDecision({ live, heavyQueued, readyWidth, want, caps })
  const sumPending = reservations.reduce((s, r) => s + pendingGib(r, nowMs), 0)
  const A_ef = round3(signals.A_gib - sumPending)
  if (signals.L === 4) {
    return { grant: null, motivo_limite: 'pausa_L4', techo: null, suelo: null, A_ef, P: round3(A_ef - ADMISSION.COLCHON_GIB), veto: 'presion', h_max: null, safe_mode: false }
  }
  const colchon = Math.max(ADMISSION.COLCHON_MIN_GIB, caps.colchonGib ?? ADMISSION.COLCHON_GIB)
  const { veto, deltas } = readVeto(history, signals)
  const calm = isCalm(history, signals, deltas)
  const P0 = round3(A_ef - colchon)

  const heavy = heavyQueued > 0 ? decideHeavy({ live, veto, P: P0, A_ef, hMaxBase: hMax(ncpu), runtimeShape }) : null
  if (want !== 'B' && heavy?.grant === 'H') {
    return { grant: 'H', motivo_limite: heavy.motivo_limite, techo: null, suelo: null, A_ef, P: P0, veto, h_max: heavy.h_max, safe_mode: false }
  }
  // A heavy job waiting for RAM sets its c_h aside (it does not freeze builders); waiting for CPU sets nothing aside.
  const asideH = Boolean(heavy?.waitsForRam)
  const P = round3(asideH ? P0 - ADMISSION.C_H_GIB : P0)

  if (want === 'H') {
    const motivo = heavy ? heavy.motivo_limite : 'ancho'
    return { grant: null, motivo_limite: motivo, techo: null, suelo: null, A_ef, P, veto, h_max: heavy?.h_max ?? null, safe_mode: false }
  }

  const terms = ceilingTerms({ readyWidth, liveB: live.B, caps, runtimeShape })
  const techo = Math.min(...terms.map(([, v]) => v))
  const bound = terms.find(([, v]) => v === techo)[0]
  const suelo = !veto && P >= 0 ? ADMISSION.SUELO : 1
  const out = (grant, motivo_limite) => ({ grant, motivo_limite, techo, suelo, A_ef, P, veto, h_max: heavy?.h_max ?? null, safe_mode: false })

  if (candidate === 'reviewer' && (live.R ?? 0) >= ADMISSION.REVIEWER_SUBCAP) return out(null, 'techo')
  if (live.B >= techo) return out(null, bound)
  if (live.B < suelo) return out('B', bound)
  if (veto) return out(null, vetoMotivo(veto))
  if (P >= ADMISSION.C_B_GIB + ADMISSION.HYSTERESIS_GIB && calm) return out('B', bound)
  // Held at the floor: not calm (L != 1, any swapout in the window, or fewer than 3 readings). Not a veto.
  if (P >= ADMISSION.C_B_GIB + ADMISSION.HYSTERESIS_GIB) return out(null, 'ram')
  const wouldFitWithoutAside = asideH && P0 >= ADMISSION.C_B_GIB + ADMISSION.HYSTERESIS_GIB
  return out(null, wouldFitWithoutAside ? 'ram_reservada_H' : 'ram')
}

/**
 * Safe-mode decision after a SignalError: B = 1 and H = 1 (the series), motivo `senal_fallida`. Owner `--k` is a
 * ceiling, never a floor, so it cannot lift safe mode.
 * @param {{live:{B:number,H:number}, heavyQueued?:number, readyWidth?:number, want?:'B'|'H'|null, caps?:{kOwner?:number}}} input
 */
export function safeModeDecision({ live, heavyQueued = 0, readyWidth = 1, want = null, caps = {} }) {
  const heavyOk = want !== 'B' && heavyQueued > 0 && live.H < 1
  const builderOk = want !== 'H' && readyWidth > 0 && (caps.kOwner ?? Infinity) >= 1 && live.B < 1
  const grant = heavyOk ? 'H' : builderOk ? 'B' : null
  return { grant, motivo_limite: 'senal_fallida', techo: 1, suelo: 1, A_ef: null, P: null, veto: null, h_max: 1, safe_mode: true }
}

/**
 * Read-only dry run behind `admit`: reads the signals and returns the decision a `next` would take, in the CLI's
 * output shape. Never writes, never reclaims a slot, never issues a token.
 * @param {object} input same as {@link decide} minus `signals`, plus `class` and the readSignals deps
 * @returns {Promise<{decision:'grant'|'wait', class:'B'|'H', motivo_limite:string, techo:number|null, suelo:number|null, A_ef:number|null, P:number|null, signals:object|null, safe_mode:boolean}>}
 */
export async function admit({ class: cls = 'B', signalsFile = null, exec, readFile, ...rest }) {
  const want = cls === 'H' ? 'H' : 'B'
  const input = { ...rest, want, heavyQueued: cls === 'H' ? Math.max(1, rest.heavyQueued ?? 0) : (rest.heavyQueued ?? 0) }
  let signals
  try {
    signals = await readSignals({ exec, signalsFile, readFile })
  } catch (e) {
    if (!(e instanceof SignalError)) throw e
    const d = safeModeDecision(input)
    return { decision: d.grant ? 'grant' : 'wait', class: cls, motivo_limite: d.motivo_limite, techo: d.techo, suelo: d.suelo, A_ef: null, P: null, signals: null, safe_mode: true, error: e.message }
  }
  const d = decide({ ...input, signals })
  return { decision: d.grant ? 'grant' : 'wait', class: cls, motivo_limite: d.motivo_limite, techo: d.techo, suelo: d.suelo, A_ef: d.A_ef, P: d.P, signals, safe_mode: false }
}
