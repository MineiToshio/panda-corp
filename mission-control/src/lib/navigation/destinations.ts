const DESTINATIONS = [
  "board",
  "portfolio",
  "projects",
  "proposals",
  "achievements",
  "manual",
  "configuration",
];

/** Resolve the global destination for a pathname, including nested workspaces. */
export function activeDestinationPath(pathname: string): string | null {
  if (pathname === "/") return "/";
  const family = pathname.split("/")[1];
  if (!family || !pathname.startsWith("/") || !DESTINATIONS.includes(family)) return null;
  return family === "projects" ? "/portfolio" : `/${family}`;
}
