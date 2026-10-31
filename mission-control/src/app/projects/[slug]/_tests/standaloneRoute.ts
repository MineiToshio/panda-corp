import type { RouteQuery } from "@/lib/navigation/routeState";
import PersistentProject from "../[...segments]/page";
import ProjectWorkspacePage from "../page";

const MAX_REDIRECTS = 4;

function redirectTarget(error: unknown): string | undefined {
  const digest = (error as { digest?: unknown } | null)?.digest;
  if (typeof digest !== "string" || !digest.startsWith("NEXT_REDIRECT;")) return undefined;
  return digest.split(";")[2];
}

function routeArgs(href: string): { segments: string[]; query: RouteQuery } {
  const url = new URL(href, "http://localhost");
  return {
    segments: url.pathname.split("/").filter(Boolean).slice(1),
    query: Object.fromEntries(url.searchParams),
  };
}

async function enter(href: string): Promise<React.JSX.Element> {
  const { segments, query } = routeArgs(href);
  const [slug = "", ...tail] = segments;
  if (tail.length === 0)
    return ProjectWorkspacePage({
      params: Promise.resolve({ slug }),
      searchParams: Promise.resolve(query),
    });
  const seeded = await PersistentProject({
    params: Promise.resolve({ slug, segments: tail }),
    searchParams: Promise.resolve(query),
  });
  const page = seeded.props.children as React.JSX.Element;
  return ProjectWorkspacePage(page.props);
}

/** Enter the standalone route as a browser would, following server redirects to a fixed point. */
export async function openStandalone(href: string): Promise<React.JSX.Element> {
  let current = href;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    try {
      return await enter(current);
    } catch (error) {
      const target = redirectTarget(error);
      if (target === undefined) throw error;
      current = target;
    }
  }
  throw new Error(`Redirect loop from ${href}, last ${current}`);
}
