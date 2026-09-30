import { renderToStaticMarkup } from "react-dom/server";
import { getManualPageComponent } from "@/app/manual/manualPages";
import type { ManualPage } from "@/lib/manual/manual";

/**
 * The text a reader actually sees for a Manual page: the bespoke component's
 * rendered text when the slug has one (it always wins in the reader), else the
 * markdown body. Content tests assert against THIS, never against a `.md` body
 * that a bespoke component would shadow.
 */
export function renderedManualText(page: Pick<ManualPage, "slug" | "body">): string {
  const Bespoke = getManualPageComponent(page.slug);
  if (Bespoke === null) return page.body;
  return renderToStaticMarkup(<Bespoke />)
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/\s+/g, " ");
}
