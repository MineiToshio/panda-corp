import { notFound } from "next/navigation";
import { type NavigationState, parseNavigationUrl } from "./urls";

/** Next route query shape; repeated values are rejected rather than resolved by order. */
export type RouteQuery = Record<string, string | string[] | undefined>;
function decodeRouteSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/** Validate a bounded application URL and reconstruct its exact SSR hydration seed. */
export function routeHref(base: string, segments: readonly string[], query: RouteQuery): string {
  const decoded = segments.map(decodeRouteSegment);
  if (
    decoded.length > 5 ||
    decoded.some(
      (part) =>
        !part ||
        part.length > 512 ||
        part === "." ||
        part === ".." ||
        part.includes("\\") ||
        part.includes("\0"),
    )
  )
    notFound();
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value) || key.length > 80 || (value?.length ?? 0) > 2048) notFound();
    if (value !== undefined) params.set(key, value);
  }
  const href = `${base}/${decoded.map(encodeURIComponent).join("/")}${params.size ? `?${params}` : ""}`;
  if (href.length > 8192) notFound();
  return href;
}

/** Reject unknown tabs and malformed path tails before any workspace reader executes. */
export function workspaceRouteState(href: string, segments: readonly string[]): NavigationState {
  const [, tab, detail, representation] = segments;
  const tabs = [
    "summary",
    "spec",
    "work-orders",
    "architecture",
    "changes",
    "party",
    "observability",
    "documents",
    "commands",
    "accounts",
  ];
  if (tab && !tabs.includes(tab)) notFound();
  if (detail && tab !== "work-orders" && tab !== "documents") notFound();
  if (representation && (tab !== "work-orders" || !["summary", "full"].includes(representation)))
    notFound();
  if (segments.length > 4) notFound();
  return parseNavigationUrl(href);
}
