// Pure admission decision: adaptive ceilings, heavy-job estimates, safe mode and read-only admit.
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


/** One pure admission decision. RAM reservations estimate heavy jobs, never veto builders. */
export function decide({ signals, reservations = [], live, heavyQueued = 0, readyWidth = 1, caps = {},
  step = ADMISSION.K_START_DEFAULT, want = null, candidate = 'builder', nowMs = Date.now(), ncpu = cpuCount(),
}) {
  if (!signals) return safeModeDecision({ live, heavyQueued, readyWidth, want, caps })
  const currentStep = signals.L === 4 ? 1 : step
  const sumPending = reservations.reduce((s, r) => s + pendingGib(r, nowMs), 0)
  const A_ef = round3(signals.A_gib - sumPending)
  const P = round3(A_ef - Math.max(ADMISSION.COLCHON_MIN_GIB, caps.colchonGib ?? ADMISSION.COLCHON_GIB))
  const hCap = currentStep <= 2 ? 1 : hMax(ncpu)
  const reactiveMotivo = REACTIVE_MOTIVOS.includes(caps.kReactiveReason) ? caps.kReactiveReason : 'reactivo_contencion'
  const terms = [['ancho', readyWidth + live.B], ['techo', currentStep], ['owner_k', caps.kOwner ?? Infinity], [reactiveMotivo, caps.kReactive ?? Infinity]]
  const techo = Math.min(...terms.map(([, n]) => n))
  const bound = terms.find(([, n]) => n === techo)[0]
  const out = (grant, motivo_limite) => ({ grant, motivo_limite, step: currentStep, techo, suelo: 1, A_ef, P, veto: null, h_max: hCap, safe_mode: false })
  if (want !== 'B' && heavyQueued > 0 && live.H < hCap && (live.H === 0 || P >= ADMISSION.C_H_GIB)) return out('H', 'cpu_H')
  if (want === 'H') return out(null, live.H >= hCap ? 'cpu_H' : heavyQueued > 0 ? 'ram' : 'ancho')
  if (candidate === 'reviewer' && (live.R ?? 0) >= ADMISSION.REVIEWER_SUBCAP) return out(null, 'techo')
  if (live.B >= techo) return out(null, bound)
  return out('B', bound)
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
