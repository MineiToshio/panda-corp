/**
 * proposalsDismissStore.ts — client-local dismissal store for proposals (WO-17-007).
 *
 * Persists dismissed proposal IDs in localStorage.
 * Architecture §4.8: client-local UI state — NOT a factory write.
 * White-Hat (FRD-09, AC-17-007.3): a dismissed proposal stays dismissed across refreshes;
 * the factory (factory/memory/, factory/standards/) is never touched.
 *
 * Pure functions over localStorage — no side-effects besides reading/writing the key.
 *
 * Traceability:
 *   CMP-17-dismiss → REQ-17-007, REQ-17-008
 *   AC-17-007.3 (dismiss persists in localStorage, not a factory write)
 */

/** localStorage key that holds the JSON array of dismissed proposal IDs. */
export const PROPOSALS_DISMISSED_KEY = "mc:proposals:dismissed" as const;

/** A minimal proposal shape the filterUndismissed helper requires. */
export type DismissableProposal = {
  id: string;
  [key: string]: unknown;
};

// ---------------------------------------------------------------------------
// Read helpers
// ---------------------------------------------------------------------------

/**
 * Return the set of currently-dismissed proposal IDs.
 *
 * Fail-soft: corrupted or missing localStorage → returns [].
 * Never throws.
 */
export function getDismissedIds(): string[] {
  try {
    const raw = localStorage.getItem(PROPOSALS_DISMISSED_KEY);
    if (raw === null) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

/**
 * Return true when the given proposal id has been dismissed in this browser.
 * Never throws.
 */
export function isProposalDismissed(id: string): boolean {
  return getDismissedIds().includes(id);
}

// ---------------------------------------------------------------------------
// Write helper
// ---------------------------------------------------------------------------

/**
 * Persist a proposal dismissal to localStorage.
 *
 * Idempotent: dismissing an already-dismissed id is a no-op.
 * NOT a factory write — only localStorage is touched (architecture §4.8).
 * Never throws.
 *
 * @param id - The proposal's id (LESSON-NNNN, sg-NNN, etc.)
 */
export function dismissProposal(id: string): void {
  try {
    const existing = getDismissedIds();
    if (existing.includes(id)) return; // idempotent
    const updated = [...existing, id];
    localStorage.setItem(PROPOSALS_DISMISSED_KEY, JSON.stringify(updated));
  } catch {
    // localStorage unavailable (private browsing with storage disabled etc.) — silently no-op.
  }
}

// ---------------------------------------------------------------------------
// Filter helper
// ---------------------------------------------------------------------------

/**
 * Filter a list of proposals, removing any that have been dismissed.
 *
 * Pure convenience wrapper: reads getDismissedIds() internally.
 * Never throws.
 *
 * @param proposals - Array of proposals with at least an `id: string` field.
 * @returns The subset of proposals that have NOT been dismissed.
 */
export function filterUndismissed<T extends DismissableProposal>(proposals: T[]): T[] {
  const dismissed = new Set(getDismissedIds());
  return proposals.filter((p) => !dismissed.has(p.id));
}
