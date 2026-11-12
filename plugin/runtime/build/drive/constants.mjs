// Shared constants and error helpers of the drive relay (split from drive.mjs; no behaviour of its own).

/** States of `build/drive/standby.json`. */
export const STANDBY_STATES = Object.freeze(["standby", "active", "stopped"]);
/** Why a takeover happened: (a) handoff file, (b) Claude limit text, (c) silent lease, `test` (`--handoff-after`), `direct` (`drive --run`). */
export const TRIGGERS = Object.freeze(["a", "b", "c", "test", "direct"]);
/** Terminal `next` actions already applied by the scheduler. */
export const TERMINAL_ACTIONS = new Set(["paused-quota", "paused-infra", "waiting-owner", "deadlock", "stop"]);
/** Unit states that count as in flight. */
export const IN_FLIGHT = new Set(["admitted", "running"]);
export const LOG_ROTATE_BYTES = 5 * 1024 * 1024;
export const STATE_ERRORS_BEFORE_EXIT = 10;
// The Codex hook adapter denies any shell command containing this word: nothing drive passes as an argument may carry it.
export const FORBIDDEN_WORD = /claude/i;

export const err = (code, message, extra = {}) => Object.assign(new Error(message), { code }, extra);
export const isFenceError = (error) => error?.code === "FENCE" || error?.code === "QUIESCED";
