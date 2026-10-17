import { type NextRequest, NextResponse } from "next/server";

/** Bound navigation input before rendering any root or descendant page. */
export function proxy(request: NextRequest): NextResponse {
  const url = request.nextUrl;
  if (url.href.length > 8192)
    return new NextResponse("La URL de navegación es demasiado larga", { status: 414 });
  const keys = new Set<string>();
  for (const [key, value] of url.searchParams) {
    if (keys.has(key) || key.length > 80 || value.length > 2048) {
      return new NextResponse("Los parámetros de navegación no son válidos", { status: 400 });
    }
    keys.add(key);
  }
  return NextResponse.next();
}

/** Only page navigation is constrained; API transports keep their existing contract. */
export const config = {
  matcher: [
    "/",
    "/board/:path*",
    "/portfolio/:path*",
    "/projects/:path*",
    "/proposals/:path*",
    "/achievements/:path*",
    "/manual/:path*",
    "/configuration/:path*",
  ],
};
