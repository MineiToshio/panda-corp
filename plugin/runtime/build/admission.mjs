// admission.mjs — RAM/CPU-adaptive admission for the v2 build engine (BUILD-9, D31, D4, D7; PLAN 3.12 and 3.16 A1/A22).
//
// Deterministic and LLM-free. Three concerns, all over injected deps so tests never touch the real host:
//   1. Signals: macOS pressure level, swapouts, available memory (readSignals); fail loud (SignalError) so the
//      caller falls back to safe mode (B = 1, H = 1, motivo "senal_fallida").
//   2. Decision: decide() grants at most one B (LLM unit) or H (heavy tool) slot per call, with a motivo_limite.
//      Never kills anything: live work finishes, launches pause (BL-0223).
//   3. Host H slots (A1, shared byte-for-byte with merge-queue.sh) and unit tokens (D4: the unit token IS the
//      admission token; only `next` issues, report/review-record/doubt answer verify and release).
// There is no calibration file (F3). `admit` is read-only: admit() never writes, reclaims or issues.
// This file is the public entry; the module is split by responsibility under `./admission/` (constants, signals,
// decision, hostSlots, tokens).

export { ADMISSION, MOTIVOS, SignalError, cpuCount, hMax } from './admission/constants.mjs'
export { admit, decide, pendingGib, safeModeDecision } from './admission/decision.mjs'
export { acquireHostSlot, countHostSlots, hSlotsDir, hostDir, waitHostSlot } from './admission/hostSlots.mjs'
export { defaultExec, readSignals, rssTreeGib } from './admission/signals.mjs'
export { hashToken, issueToken, readHistory, recordReading, releaseToken, verifyToken } from './admission/tokens.mjs'
