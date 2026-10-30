import type { LinkResolver } from "@/components/core/Markdown/Markdown";
import { classifyDocLink } from "@/lib/docs/links";
import type { DocNode } from "@/lib/docs/tree";
import { navigationHref } from "@/lib/navigation/urls";

/**
 * Build the in-app reader href for a document, PRESERVING the embedding context.
 *
 * A bare `?doc=<id>` replaces the entire query string — dropping `project` (which the
 * Portfolio uses to pick the project) and `tab=documents` (so the page falls back to the
 * Summary tab). Carrying both keeps the user on this doc reader in every context; the
 * standalone `/projects/<slug>` route reads its slug from the path and ignores the extra
 * `project` param, so the SAME href is correct there too (AC-04-006.4).
 */
export function docHref(project: string, docId: string, navigationBaseHref?: string): string {
  if (navigationBaseHref)
    return navigationHref(navigationBaseHref, {
      tab: "documents",
      doc: docId,
      wo: null,
      wotab: null,
      woview: null,
    });
  const q = new URLSearchParams({ project, tab: "documents", doc: docId });
  return `?${q.toString()}`;
}

/**
 * Build the <Markdown> link resolver for a document (owner choice "cablear al lector"):
 *   - a relative link to a doc the reader KNOWS → rewritten to open that doc in the SAME
 *     reader (URL-driven: `?project&tab=documents&doc=<id>`);
 *   - an off-app URL (http/https/mailto) → opens in a new tab;
 *   - an in-page anchor → kept (same tab);
 *   - any other relative path (a doc the reader doesn't surface) → null, so <Markdown>
 *     renders it as plain text instead of a link that would 404.
 * Link classification is shared with the board card-detail via `lib/docs/links`.
 */
export function makeLinkResolver(
  currentRelPath: string,
  nodes: DocNode[],
  project: string,
  navigationBaseHref?: string,
): LinkResolver {
  const idByRelPath = new Map(nodes.map((n) => [n.relPath, n.id]));
  const known = new Set(idByRelPath.keys());
  return (href) => {
    const target = classifyDocLink(href, currentRelPath, known);
    switch (target.kind) {
      case "doc": {
        const id = idByRelPath.get(target.relPath);
        return id !== undefined
          ? {
              href: `${docHref(project, id, navigationBaseHref)}${target.anchor ?? ""}`,
              external: false,
            }
          : null;
      }
      case "external":
        return { href: target.href, external: true };
      case "anchor":
        return { href: target.href, external: false };
      default:
        return null;
    }
  };
}
