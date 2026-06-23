/**
 * Doc-link resolution shared by the document readers — the workspace Documents tab
 * (URL-driven) and the board card-detail (client-state-driven). Both render project
 * docs through <Markdown> and need in-document links (e.g. the PRD's `[FRD-01](../frds/…)`)
 * to open the linked doc IN the reader instead of 404-ing against the app's routes.
 *
 * Pure string logic (no node:path) so it runs on the client or the server.
 */

/**
 * Resolve a relative link (e.g. "../frds/frd-01-x/frd.md") against the directory of the
 * document it appears in, into a project-root-relative path. Collapses "." and ".." and
 * drops empty segments.
 */
export function resolveRelativePath(fromDir: string, link: string): string {
  const out: string[] = fromDir ? fromDir.split("/") : [];
  for (const seg of link.split("/")) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") {
      out.pop();
      continue;
    }
    out.push(seg);
  }
  return out.join("/");
}

/** What a markdown link inside a document points at, once classified. */
export type DocLinkTarget =
  /** Off-app URL (http/https/mailto/protocol-relative) — open in a new tab. */
  | { kind: "external"; href: string }
  /** In-page anchor (#section). */
  | { kind: "anchor"; href: string }
  /** A relative path that resolves to a doc the reader surfaces (by relPath). */
  | { kind: "doc"; relPath: string }
  /** A relative path that does NOT resolve to a surfaced doc (render as plain text). */
  | { kind: "unknown" };

/**
 * Classify a markdown link relative to the document it appears in.
 *
 * @param href           the raw link href from the markdown
 * @param currentRelPath the relPath of the document being rendered (to resolve `../`)
 * @param knownRelPaths  the set of doc relPaths the reader can surface
 */
export function classifyDocLink(
  href: string,
  currentRelPath: string,
  knownRelPaths: ReadonlySet<string>,
): DocLinkTarget {
  if (!href) return { kind: "unknown" };
  if (href.startsWith("#")) return { kind: "anchor", href };
  if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith("//")) {
    return { kind: "external", href };
  }
  const lastSlash = currentRelPath.lastIndexOf("/");
  const currentDir = lastSlash >= 0 ? currentRelPath.slice(0, lastSlash) : "";
  const noAnchor = href.split("#")[0] ?? href;
  const cleanPath = noAnchor.split("?")[0] ?? noAnchor;
  const resolved = resolveRelativePath(currentDir, cleanPath);
  return knownRelPaths.has(resolved) ? { kind: "doc", relPath: resolved } : { kind: "unknown" };
}
