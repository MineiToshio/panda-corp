// admission.mjs — RAM/CPU-adaptive admission for the v2 build engine (BUILD-9, D31, D4, D7; PLAN 3.12 and 3.16 A1/A22).
//
// Deterministic and LLM-free. Three concerns, all over injected deps so tests never touch the real host:
//   1. Signals: macOS pressure level, swapouts, available memory (readSignals); fail loud (SignalError) so the
//      caller falls back to safe mode (B = 1, H = 1, motivo "senal_fallida").
//   2. Decision: decide() grants at most one B (LLM unit) or H (heavy tool) slot per call, with a motivo_limite.
//      Never kills anything: live work finishes while the adaptive ceiling changes (DEC-15).
//   3. Host H slots (A1, shared byte-for-byte with merge-queue.sh) and unit tokens (D4: the unit token IS the
//      admission token; only `next` issues, report/review-record/doubt answer verify and release).
// Machine-local calibration is recorded by perf.mjs. `admit` is read-only: admit() never writes, reclaims or issues.
// This file is the public entry; the module is split by responsibility under `./admission/` (constants, signals,
// decision, hostSlots, tokens).

export { ADMISSION, STEPS, K_START_DEFAULT, SWAP_GROWTH_MB, UP_COOLDOWN_S, WT_NEED_GIB, DISK_FLOOR_GIB, MOTIVOS, SignalError, cpuCount, hMax } from './admission/constants.mjs'
export { admit, decide, pendingGib, safeModeDecision } from './admission/decision.mjs'
export { acquireHostSlot, countHostSlots, hSlotsDir, hostDir, waitHostSlot } from './admission/hostSlots.mjs'
export { defaultExec, readSignals, rssTreeGib } from './admission/signals.mjs'
export { hashToken, initializeAdmission, readAdaptive, recordDiskWait, issueToken, readHistory, recordReading, releaseToken, verifyToken } from './admission/tokens.mjs'
export { diskDecision, readDiskFreeGib } from './admission/disk.mjs'
