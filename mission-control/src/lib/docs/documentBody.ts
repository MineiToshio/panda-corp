import matter from "gray-matter";

/** Parsed reader body or an explicit metadata failure; the caller retains the original source. */
export type DocumentBodyResult =
  | { readonly ok: true; readonly body: string }
  | { readonly ok: false; readonly reason: string };

/** Parse metadata without removing the document reader on invalid YAML. */
export function documentBody(source: string): DocumentBodyResult {
  try {
    // Disable gray-matter's content cache so a failed parse cannot become a later success.
    return { ok: true, body: matter(source, { excerpt: false }).content };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }
}
