/** Typed-at-the-boundary URL codec shared by links, route adapters and client views. */
export type NavigationState = Record<string, string>;
/** Null removes a selection; other values preserve their exact spelling. */
export type NavigationPatch = Record<string, string | null>;

const BOARD_TABS: Record<string, string> = {
  propuesta: "proposal",
  spec: "spec",
  arquitectura: "architecture",
  docs: "documents",
  campana: "campaign",
};
const HALL_TABS: Record<string, string> = {
  resumen: "summary",
  misiones: "missions",
  trofeos: "trophies",
  estadisticas: "statistics",
  rangos: "ranks",
};
export const WORKSPACE_TABS: Record<string, string> = {
  summary: "summary",
  spec: "spec",
  "work-orders": "work-orders",
  architecture: "architecture",
  changes: "changes",
  party: "party",
  observabilidad: "observability",
  documents: "documents",
  commands: "commands",
  accounts: "accounts",
};
const decode = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};
const reverse = (map: Record<string, string>, value: string): string =>
  Object.entries(map).find(([, path]) => path === value)?.[0] ?? value;

type PathParts = readonly (string | undefined)[];
function assign(state: NavigationState, key: string, value: string | undefined): void {
  if (value) state[key] = value;
}
function parseBoard(parts: PathParts, state: NavigationState): void {
  const [, identity, tab, detail] = parts;
  assign(state, "idea", identity);
  assign(state, "boardTab", tab ? reverse(BOARD_TABS, tab) : undefined);
  if (tab === "documents") assign(state, "doc", detail);
}
function parseWorkspace(parts: PathParts, state: NavigationState): void {
  const [, identity, tab, detail, detailTab] = parts;
  assign(state, "project", identity);
  assign(state, "tab", tab ? reverse(WORKSPACE_TABS, tab) : undefined);
  if (tab === "documents") assign(state, "doc", detail);
  if (tab === "work-orders" && detail) {
    state.wo = detail;
    state.wotab = detailTab ?? "summary";
  }
}
function parseProposals(parts: PathParts, state: NavigationState): void {
  const [, tab, collection, detail] = parts;
  assign(state, "proposalsTab", tab === "memory" ? "memoria" : tab);
  if (tab === "backlog") assign(state, "backlogItem", collection);
  if (tab === "memory") {
    assign(state, "stream", collection);
    assign(state, "lesson", detail);
  }
}
function parseManual(parts: PathParts, state: NavigationState): void {
  const [, group, page, detail] = parts;
  if (group === "reference") {
    assign(state, "reference", page);
    assign(state, "referenceItem", detail);
    return;
  }
  assign(state, "manualGroup", group);
  assign(state, "manualPage", page);
}

/** Decode modern paths and legacy query links into one selection record. Paths win. */
export function parseNavigationUrl(href: string): NavigationState {
  const url = new URL(href, "http://mission-control.local");
  const state: NavigationState = Object.fromEntries(url.searchParams);
  const parts = url.pathname.split("/").filter(Boolean).map(decode);
  const [family, identity, tab] = parts;
  if (family === "board") parseBoard(parts, state);
  if (family === "portfolio" || family === "projects") parseWorkspace(parts, state);
  if (family === "proposals") parseProposals(parts, state);
  if (family === "manual") parseManual(parts, state);
  if (family === "achievements" && identity) state.hallTab = reverse(HALL_TABS, identity);
  if (family === "configuration") {
    assign(state, "configSection", identity);
    assign(state, "configItem", tab);
  }
  return state;
}

function take(state: NavigationState, key: string): string | undefined {
  const value = state[key];
  delete state[key];
  return value || undefined;
}

function boardPath(state: NavigationState): string[] {
  const idea = take(state, "idea");
  const tab = take(state, "boardTab");
  if (!idea) return [];
  const path = [idea];
  if (tab) path.push(BOARD_TABS[tab] ?? tab);
  const doc = tab === "docs" || tab === "documents" ? take(state, "doc") : undefined;
  if (doc) path.push(doc);
  return path;
}

function workspacePath(state: NavigationState): string[] {
  const project = take(state, "project");
  const tab = take(state, "tab") ?? "summary";
  if (!project) return [];
  const path = [project, WORKSPACE_TABS[tab] ?? tab];
  if (tab === "work-orders") {
    const wo = take(state, "wo");
    const representation = take(state, "wotab");
    if (wo) path.push(wo, representation ?? "summary");
  }
  const doc = tab === "documents" ? take(state, "doc") : undefined;
  if (doc) path.push(doc);
  return path;
}

function proposalsPath(state: NavigationState): string[] {
  const tab = take(state, "proposalsTab");
  if (!tab) return [];
  if (tab === "backlog") {
    const item = take(state, "backlogItem");
    return item ? [tab, item] : [tab];
  }
  const stream = take(state, "stream");
  const lesson = take(state, "lesson");
  const path = [tab === "memoria" ? "memory" : tab];
  if (stream && lesson) path.push(stream, lesson);
  else {
    if (stream) state.stream = stream;
    if (lesson) state.lesson = lesson;
  }
  return path;
}

function manualPath(state: NavigationState): string[] {
  const reference = take(state, "reference");
  const item = take(state, "referenceItem");
  const group = take(state, "manualGroup");
  const page = take(state, "manualPage");
  if (reference) return item ? ["reference", reference, item] : ["reference", reference];
  return group ? (page ? [group, page] : [group]) : [];
}

function configurationPath(state: NavigationState): string[] {
  const section = take(state, "configSection");
  const item = take(state, "configItem");
  return section ? (item ? [section, item] : [section]) : [];
}

function serializePath(family: string, state: NavigationState): string[] {
  let tail: string[] = [];
  if (family === "board") tail = boardPath(state);
  if (family === "portfolio" || family === "projects") tail = workspacePath(state);
  if (family === "proposals") tail = proposalsPath(state);
  if (family === "manual") tail = manualPath(state);
  if (family === "configuration") tail = configurationPath(state);
  if (family === "achievements") {
    const tab = take(state, "hallTab");
    if (tab) tail = [HALL_TABS[tab] ?? tab];
  }
  return [family, ...tail];
}

/** Build a canonical application href, preserving unrelated query parameters and anchors. */
export function navigationHref(href: string, patch: NavigationPatch): string {
  const url = new URL(href, "http://mission-control.local");
  const family = url.pathname.split("/").filter(Boolean)[0] ?? "";
  const supported = [
    "board",
    "portfolio",
    "projects",
    "proposals",
    "achievements",
    "manual",
    "configuration",
  ];
  const state = parseNavigationUrl(href);
  for (const [key, value] of Object.entries(patch)) {
    if (value === null || value === "") delete state[key];
    else state[key] = value;
  }
  const pathname = supported.includes(family)
    ? `/${serializePath(family, state).map(encodeURIComponent).join("/")}`
    : url.pathname;
  const query = new URLSearchParams(state).toString();
  return `${pathname}${query ? `?${query}` : ""}${url.hash}`;
}
