import type { Tone } from "@/components/core/Chip/vocabulary";
import type { ChangeQueueStatus } from "@/lib/changes/changes";
import { t } from "@/lib/copy/copy";

/** Queue groups in the order that work reaches the build. */
export const ACTIVE_STATUSES = ["ready", "building", "closing", "draft"] as const;
/** One hue per queue status, shared by cards and dialogs. */
export const STATUS_TONES: Record<ChangeQueueStatus, Tone> = {
  ready: "pink",
  building: "blue",
  closing: "amber",
  draft: "slate",
  done: "green",
  discarded: "slate",
};
/** Visible state word from the frozen copy catalogue. */
export function statusLabel(status: ChangeQueueStatus): string {
  return t(`workspace.cambios.states.${status}`);
}

/** Singular state words for an individual change. */
export function itemStatusLabel(status: ChangeQueueStatus): string {
  return t(`workspace.cambios.itemStates.${status}`);
}
/** Domain failure copy for the confirmation; never exposes filesystem exceptions. */
export function discardErrorLabel(reason: "not-found" | "parse-error" | "not-discardable"): string {
  return t(`workspace.cambios.discardErrors.${reason}`);
}
