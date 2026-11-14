// Retired entry point: audit completion always requires the normal review-record evidence gate.
// Kept fail-closed for older callers; this function never changes worker/token/checkpoint state.
export async function deferAuditUnit() {
  throw Object.assign(new Error("Audit deferral is retired by DR-162; retain the execution and record a real review report"), { code: "AUDIT_EVIDENCE_REQUIRED" });
}
