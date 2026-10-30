/** Stable failure classes shared by real and fixture git. */
export type GitErrorKind = "disallowed" | "failed" | "timeout" | "no-fixture-answer";
/** Safe git boundary error: contains no subprocess output or fixture contents. */
export class GitError extends Error {
  constructor(
    public readonly kind: GitErrorKind,
    message: string,
  ) {
    super(message);
    this.name = "GitError";
  }
}
