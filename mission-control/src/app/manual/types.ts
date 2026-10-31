import type { ManualPage } from "@/lib/manual/manual";

/** Authored page registry supplied by the server. */
export interface ManualShellProps {
  readonly pages: ManualPage[];
}
/** Resolved authored page and its registry for navigation. */
export interface DocReaderProps {
  readonly page: ManualPage;
  readonly pages: readonly ManualPage[];
}
