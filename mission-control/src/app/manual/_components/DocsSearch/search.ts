import type { ManualPage } from "@/lib/manual/manual";
import { DOC_GROUPS } from "../DocsHome/model";

/** Extracted text beside the single authoritative page record. */
export interface SearchEntry {
  readonly page: ManualPage;
  readonly text: string;
}
/** A matching page with a bounded preview. */
export interface SearchHit extends SearchEntry {
  readonly group: string;
  readonly snippet: string;
}

/** Fold case and accents while preserving character offsets for snippets. */
function normalizeSearch(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("es");
}

/** Pure injected index builder; failed renderers stay searchable by title and report the error. */
export function buildSearchIndex(
  pages: readonly ManualPage[],
  extractText: (page: ManualPage) => string,
): SearchEntry[] {
  return pages.map((page) => {
    try {
      return { page, text: extractText(page).replace(/\s+/g, " ").trim() };
    } catch (error) {
      console.error(`Documentation search could not extract ${page.group}/${page.slug}`, error);
      return { page, text: "" };
    }
  });
}

/** Search all groups, ranking title matches first and retaining authored order. */
export function searchPages(index: readonly SearchEntry[], query: string): SearchHit[] {
  const term = normalizeSearch(query.trim());
  if (!term) return [];
  const rank = (group: string): number => DOC_GROUPS.findIndex((entry) => entry.id === group);
  return index
    .filter(({ page, text }) => normalizeSearch(`${page.title} ${text}`).includes(term))
    .sort((a, b) => {
      const titleMatch = (entry: SearchEntry): number =>
        Number(normalizeSearch(entry.page.title).includes(term));
      return (
        titleMatch(b) - titleMatch(a) ||
        rank(a.page.group) - rank(b.page.group) ||
        a.page.order - b.page.order
      );
    })
    .map((entry) => {
      const position = Math.max(0, normalizeSearch(entry.text).indexOf(term));
      const start = Math.max(0, position - 45);
      const end = Math.min(entry.text.length, Math.max(position + term.length, start + 120));
      return {
        ...entry,
        group: entry.page.group,
        snippet: `${start ? "…" : ""}${entry.text.slice(start, end)}${end < entry.text.length ? "…" : ""}`,
      };
    });
}
