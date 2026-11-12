// Fixed constants, the motivo enum, SignalError and the host CPU capacity of the admission module (split from admission.mjs).
import os from 'node:os'

export const GIB = 1024 ** 3

/** Fixed constants (BUILD-9 Constants table, A22). GiB unless the name says otherwise. */
export const ADMISSION = Object.freeze({
  K_TECHO: 2,
  SUELO: 2,
  COLCHON_GIB: 3,
  COLCHON_MIN_GIB: 1,
  C_B_GIB: 1.5,
  C_TOOL_GIB: 1.2,
  C_H_GIB: 3.5,
  CODEX_EXTRA_GIB: 0.35,
  HYSTERESIS_GIB: 0.5,
  REVIEWER_SUBCAP: 2,
  H_MAX_CAP: 2,
  AGENT_FRESH_S: 60,
  L4_PAUSE_S: 600,
  HISTORY_LEN: 3,
  K_REACTIVE_CODEX_START: 2,
  SLOT_POLL_MS: 5000,
  SLOT_OWNERLESS_GRACE_MS: 60000,
  EXEC_TIMEOUT_MS: 5000,
})

/** The closed motivo_limite enum (BUILD-9). */
export const MOTIVOS = Object.freeze([
  'ancho', 'ram', 'ram_reservada_H', 'veto_presion', 'veto_swap', 'cpu_H', 'techo', 'owner_k',
  'reactivo_contencion', 'reactivo_codex', 'cupo_limite', 'senal_fallida', 'pausa_L4', 'sin_token',
])

export const REACTIVE_MOTIVOS = ['reactivo_contencion', 'reactivo_codex', 'cupo_limite']
export const round3 = (n) => Math.round(n * 1000) / 1000

/** Raised when a RAM signal cannot be read or parsed. Callers switch to safe mode (never a silent default, DR-078). */
export class SignalError extends Error {
  /** @param {string} message @param {{source?: string}} [opts] */
  constructor(message, { source = 'unknown' } = {}) {
    super(message)
    this.name = 'SignalError'
    this.source = source
  }
}

/** `ncpu` as Node sees it (A1). */
export const cpuCount = () => (typeof os.availableParallelism === 'function' ? os.availableParallelism() : os.cpus().length)

/** H_max = max(1, min(2, floor(ncpu / 4))) (A1). */
export const hMax = (ncpu = cpuCount()) => Math.max(1, Math.min(ADMISSION.H_MAX_CAP, Math.floor(ncpu / 4)))
