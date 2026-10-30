import { type NavigationPatch, navigationHref, parseNavigationUrl, WORKSPACE_TABS } from "./urls";

const TAB_ALIASES: Record<string, string> = {
  party: "summary",
  resumen: "summary",
  summary: "summary",
  spec: "spec",
  arquitectura: "architecture",
  architecture: "architecture",
  cambios: "changes",
  changes: "changes",
  documentos: "documents",
  documents: "documents",
  comandos: "commands",
  commands: "commands",
  cuentas: "accounts",
  accounts: "accounts",
  observabilidad: "observability",
  observability: "observability",
  "work-orders": "observability",
  "work orders": "observability",
};

function manualAlias(url: URL, parts: string[], original: string): string {
  const [, , catalog, item] = parts;
  if (
    !catalog ||
    !["commands", "skills", "agents", "rules", "standards"].includes(catalog) ||
    parts.length > 4
  )
    return original;
  const target = [
    "configuration",
    catalog === "commands" ? "skills" : catalog,
    ...(item ? [item] : []),
  ];
  return `/${target.map(encodeURIComponent).join("/")}${url.search}${url.hash}`;
}

function hasWorkspaceTail(parts: string[]): boolean {
  const [, , rawTab, detail, representation] = parts;
  const tab = rawTab ? TAB_ALIASES[rawTab.toLowerCase()] : undefined;
  if (parts.length > 5 || (rawTab && !tab)) return false;
  if (detail && !["documents", "observability"].includes(tab ?? "")) return false;
  if (representation && (tab !== "observability" || !["summary", "full"].includes(representation)))
    return false;
  return true;
}

function workspacePatch(href: string): NavigationPatch | null {
  const state = parseNavigationUrl(href);
  const raw = state.tab;
  const tab = raw ? TAB_ALIASES[raw.toLowerCase()] : undefined;
  if (raw && !tab && !Object.values(WORKSPACE_TABS).includes(raw)) return null;
  const patch: NavigationPatch = tab ? { tab } : {};
  if (tab === "observability") {
    if (state.wotab || state.wo) patch.woview = state.woview ?? state.wotab ?? "summary";
    patch.wotab = null;
    if (state.view === "timeline") patch.view = "frd";
    if (state.view === "dag") patch.view = "deps";
  }
  if (state.portfolioView === "accounts") {
    patch.view = state.view ?? "cuentas";
    patch.portfolioView = null;
  }
  return patch;
}

/** Normalize recognized legacy locations only; unknown or malformed input remains unchanged. */
export function normalizeLegacyNavigation(href: string): string {
  try {
    const url = new URL(href, "http://mission-control.local");
    if (url.origin !== "http://mission-control.local") return href;
    const parts = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
    const [family, group] = parts;
    if ([...url.searchParams.keys()].some((key) => url.searchParams.getAll(key).length > 1))
      return href;
    if (family === "manual" && group === "reference") return manualAlias(url, parts, href);
    const patch: NavigationPatch = {};
    if (family === "portfolio" || family === "projects") {
      if (!hasWorkspaceTail(parts)) return href;
      const workspace = workspacePatch(href);
      if (!workspace) return href;
      Object.assign(patch, workspace);
    } else if (family !== "board") return href;
    if (url.searchParams.get("model") === "diagram") patch.model = "Diagrama";
    if (url.searchParams.get("model") === "schema") patch.model = "Esquema";
    return navigationHref(href, patch);
  } catch {
    return href;
  }
}
