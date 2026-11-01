import { type NextRequest, NextResponse } from "next/server";
import { readIdeas } from "@/lib/ideas/ideas";
import { resolveIdeaNavigation } from "@/lib/navigation/identities";
import { problem } from "@/lib/problem";

/** Bound navigation input before rendering any root or descendant page. */
export function proxy(request: NextRequest): Response {
  const host = request.headers.get("host");
  if (!isAllowedHost(host))
    return problem(421, "Misdirected request", {
      detail: "The request Host is outside the approved local network allowlist.",
      instance: request.nextUrl.pathname,
    });
  const url = request.nextUrl;
  if (url.pathname.startsWith("/api/")) return NextResponse.next();
  if (url.href.length > 8192)
    return new NextResponse("La URL de navegación es demasiado larga", { status: 414 });
  const keys = new Set<string>();
  for (const [key, value] of url.searchParams) {
    if (keys.has(key) || key.length > 80 || value.length > 2048) {
      return new NextResponse("Los parámetros de navegación no son válidos", { status: 400 });
    }
    keys.add(key);
  }
  const idea = /^\/board\/([^/]+)/.exec(url.pathname)?.[1];
  if (idea) {
    let token: string;
    try {
      token = decodeURIComponent(idea);
    } catch {
      return new NextResponse(null, { status: 400 });
    }
    if (!resolveIdeaNavigation(token, readIdeas())) return NextResponse.next({ status: 404 });
  }
  return NextResponse.next();
}

/** Check the actual Host header, never a forwarded hostname or a suffix match. */
function isAllowedHost(host: string | null): boolean {
  if (!host || !/^[a-z0-9.-]+(?::[0-9]{1,5})?$/i.test(host)) return false;
  const [hostname, port] = host.toLowerCase().split(":");
  if (port && (Number(port) < 1 || Number(port) > 65535)) return false;
  if (["127.0.0.1", "localhost", "macbook-pro-de-sergio.local"].includes(hostname ?? ""))
    return true;
  const parts = hostname?.split(".") ?? [];
  if (
    parts.length !== 4 ||
    parts.some((part) => !/^(0|[1-9][0-9]{0,2})$/.test(part) || Number(part) > 255)
  )
    return false;
  return parts[0] === "10" || (parts[0] === "192" && parts[1] === "168");
}

/** Host protection covers pages and API transports; query bounds apply only to navigation. */
export const config = {
  matcher: [
    "/",
    "/api/:path*",
    "/board/:path*",
    "/portfolio/:path*",
    "/projects/:path*",
    "/proposals/:path*",
    "/achievements/:path*",
    "/manual/:path*",
    "/configuration/:path*",
  ],
};
