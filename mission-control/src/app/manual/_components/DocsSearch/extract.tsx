import { createElement } from "react";
import type { ManualPage } from "@/lib/manual/manual";
import { getManualPageComponent } from "../../manualPages";
import { buildSearchIndex, type SearchEntry } from "./search";

/** Extract rendered prose instead of indexing the bespoke page's metadata stub. */
export function extractPageText(
  page: ManualPage,
  render: (node: React.ReactNode) => string,
): string {
  const Renderer = getManualPageComponent(page.slug);
  if (!Renderer) return page.body.replace(/[#*`>_[\]()]/g, " ");
  const document = new DOMParser().parseFromString(render(createElement(Renderer)), "text/html");
  for (const block of document.body.querySelectorAll(
    "address, article, aside, blockquote, br, dd, div, dl, dt, figcaption, figure, footer, h1, h2, h3, h4, h5, h6, header, hr, li, main, nav, ol, p, pre, section, table, td, th, tr, ul",
  )) {
    block.before(document.createTextNode(" "));
    block.after(document.createTextNode(" "));
  }
  return document.body.textContent ?? "";
}

const indexes = new WeakMap<readonly ManualPage[], Promise<SearchEntry[]>>();
/** Lazily load the static renderer once per supplied page registry. */
export function loadSearchIndex(pages: readonly ManualPage[]): Promise<SearchEntry[]> {
  const existing = indexes.get(pages);
  if (existing) return existing;
  const pending = import("react-dom/server").then(({ renderToStaticMarkup }) =>
    buildSearchIndex(pages, (page) => extractPageText(page, renderToStaticMarkup)),
  );
  indexes.set(pages, pending);
  return pending;
}
