// Pure adaptive concurrency controller (ADM, DEC-15/18). A step change resets its trend window.
import { ADMISSION, STEPS } from './constants.mjs'

export function initialLadder({ step = ADMISSION.K_START_DEFAULT, allow8 = false, at = new Date().toISOString() } = {}) {
  const chosen = STEPS.includes(step) ? Math.min(step, allow8 ? 8 : 5) : ADMISSION.K_START_DEFAULT
  return { step: chosen, start_step: chosen, allow8, changed_at: at, entry_swap_mb: null, entry_A_gib: null, history: [], motivo: 'techo' }
}

export function advanceLadder(previous, signals, at) {
  const old = previous ?? initialLadder({ at })
  if (!signals) {
    const scale_event = old.step !== 1 ? { from: old.step, to: 1, reason: 'senal_fallida', at } : null
    return { ...old, step: 1, changed_at: scale_event ? at : old.changed_at, entry_swap_mb: null, entry_A_gib: null, history: [], motivo: 'senal_fallida', scale_event }
  }
  const history = [...old.history, { ...signals, at }].slice(-4)
  const deltas = history.slice(1).map((r, i) => Math.max(0, r.swapouts - history[i].swapouts))
  const entrySwap = old.entry_swap_mb ?? signals.swap_used_mb
  const entryA = old.entry_A_gib ?? signals.A_gib
  const growth = Number.isFinite(entrySwap) && signals.swap_used_mb - entrySwap >= ADMISSION.SWAP_GROWTH_MB
  const rising = deltas.filter((n) => n > 0).length >= 2
  let step = old.step, reason = null
  if (signals.L === 4) { step = 1; reason = 'presion_critica' }
  else if (rising || growth) { step = STEPS[Math.max(0, STEPS.indexOf(old.step) - 1)]; reason = rising ? 'swapouts' : 'swap_growth' }
  else {
    const calm = history.length >= 3 && deltas.every((n) => n === 0)
      && history.every((r) => r.L !== 4)
      && entryA - Math.min(...history.map((r) => r.A_gib)) <= ADMISSION.C_B_GIB
      && history.every((r) => !Number.isFinite(r.swap_used_mb) || r.swap_used_mb <= history[0].swap_used_mb)
    if (calm && (Date.parse(at) - Date.parse(old.changed_at)) / 1000 >= ADMISSION.UP_COOLDOWN_S) {
      const next = STEPS[Math.min(STEPS.length - 1, STEPS.indexOf(old.step) + 1)]
      if (next <= 5 || old.allow8) { step = next; reason = 'estable' }
    }
  }
  const changed = step !== old.step
  // Even at step 1 a pressure trigger consumes the trend, so a stale window cannot immediately cause a second action.
  const reset = changed || rising || growth || signals.L === 4
  return {
    ...old, step, changed_at: changed ? at : old.changed_at, entry_swap_mb: reset ? signals.swap_used_mb : entrySwap, entry_A_gib: reset ? signals.A_gib : entryA,
    history: reset ? [] : history, motivo: reason ?? (old.motivo === 'senal_fallida' ? 'techo' : old.motivo),
    scale_event: changed ? { from: old.step, to: step, reason, at } : null,
  }
}
