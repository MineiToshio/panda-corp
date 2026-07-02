/**
 * WO-06-001 — Iconic event vocabulary + event view-model mapper (IF-06-icon-map, IF-06-event-vm)
 *
 * Wave 3 (bitácora rework, 2026-07-01):
 *   - Icons are EMOJI GLYPHS rendered as text (the previous values were Lucide
 *     identifier strings that no consumer ever resolved — the feed printed
 *     "circle-dashed" literally; lucide is not a dependency of this project).
 *   - The vocabulary now covers the REAL engine/hook event names (AgentWorking,
 *     BuildLaunch/Relaunch, ReviewVerdict/GateVerdict, wo_commit, …) mapped into
 *     the bounded EventType set — previously every real event fell through to
 *     the "Evento" fallback and the feed carried no information.
 *   - `isFeedEvent` filters session noise (SupervisorTick, hook SubagentStop)
 *     out of the bitácora; failures always pass (first-class, AC-06-015.1).
 *
 * Wave 2 (La Fragua redesign, 2026-06-18):
 *   - Added `contract` and `gate` to EventType and EVENT_ICON.
 *   - Renamed `agentColorKey → roleColorKey` (now derived from `event.role`, not `event.agent`).
 *   - Added `wo` and `frd` fields to EventVM (surfacing the enriched lib/events fields).
 *
 * Pure module — no I/O, no DOM, no side-effects.
 * Consumed by: CMP-06-feed (EventFeed), CMP-06-party-tab (PartyTab)
 *
 * Traceability:
 *   IF-06-icon-map → REQ-06-011, REQ-06-010 (bounded iconic vocabulary)
 *   IF-06-event-vm → REQ-06-011, REQ-06-010, REQ-06-015 (bitácora view-model)
 *   Depends on: IF-01-readEvents (lib/events.ts) — the DashboardEvent type
 *               IF-13-agent-colors (app/_design/tokens.ts) — AGENT_COLOR
 */

import { AGENT_COLOR, type AgentRole } from "@/app/_design/tokens/tokens";
import type { Event as DashboardEvent } from "@/lib/events/events";

// ---------------------------------------------------------------------------
// IF-06-icon-map — bounded vocabulary (13 types: 12 original + contract + gate)
// Icon values are Lucide component identifier strings (resolved at render time).
// ---------------------------------------------------------------------------

/**
 * The canonical bounded event types (architecture §5, WO-06-001 Wave 2/3).
 * `launch` and `commit` cover the real engine lines (BuildLaunch/Relaunch and
 * the per-WO green commit). The old `review` type is retained for backward-compat.
 */
export type EventType =
  | "read"
  | "write"
  | "edit"
  | "test_ok"
  | "test_fail"
  | "message"
  | "start"
  | "end"
  | "handoff"
  | "contract"
  | "gate"
  | "blocked"
  | "review"
  | "achievement"
  | "launch"
  | "commit";

/**
 * Fixed bounded vocabulary: event type → emoji glyph rendered as text
 * (AC-06-011.1). Single source of truth — no consumer may define its own
 * event→icon mapping. Emoji (not an icon library): zero dependencies, renders
 * identically in the RSC HTML and the client, and matches the RPG prototype.
 */
export const EVENT_ICON: Record<EventType, string> = {
  read: "📖",
  write: "✍️",
  edit: "✏️",
  test_ok: "✅",
  test_fail: "❌",
  message: "💬",
  start: "⚒️",
  end: "🏁",
  handoff: "📜",
  contract: "📄",
  gate: "⚖️",
  blocked: "⛔",
  review: "👁️",
  achievement: "🏆",
  launch: "🚀",
  commit: "🔨",
};

/** Fallback icon for event types outside the canonical vocabulary. */
const FALLBACK_ICON = "·";

/**
 * Raw event names (as the engine/plugin emitters write them) → bounded
 * EventType. Names not listed here fall back to FALLBACK_ICON/FALLBACK_LABEL.
 */
const RAW_EVENT_TYPE: Record<string, EventType> = {
  AgentWorking: "start",
  AgentDone: "test_ok",
  HandoffWritten: "handoff",
  ContractPublished: "contract",
  BuildLaunch: "launch",
  BuildRelaunch: "launch",
  BuildComplete: "end",
  ReviewVerdict: "review",
  GateVerdict: "review",
  ReviewDone: "review",
  wo_commit: "commit",
};

/** Resolve a raw event name to its bounded EventType key (or itself if already one). */
function resolveEventType(rawEvent: string): string {
  return RAW_EVENT_TYPE[rawEvent] ?? rawEvent;
}

// ---------------------------------------------------------------------------
// Event label map — Spanish labels for the feed (AGENTS.md: UI in Spanish)
// ---------------------------------------------------------------------------

const EVENT_LABEL: Record<EventType, string> = {
  read: "Lectura",
  write: "Escritura",
  edit: "Edición",
  test_ok: "WO en verde",
  test_fail: "Tests fallidos",
  message: "Mensaje",
  start: "Agente en marcha",
  end: "Build completo",
  /** WO-06-001: "📜 nota de estado entregada" */
  handoff: "nota de estado entregada",
  /** WO-06-001: "📄 contrato docs/api.md publicado" */
  contract: "contrato docs/api.md publicado",
  /** WO-06-001: "tribunal del juez abierto" */
  gate: "tribunal del juez abierto",
  blocked: "Bloqueado",
  review: "Revisión",
  achievement: "¡Logro desbloqueado!",
  launch: "Build lanzado",
  commit: "Forjado en verde · committeado",
};

const FALLBACK_LABEL = "Evento";

/**
 * Label refinements for real AgentWorking lines: the engine enriches them with
 * `phase`/`activity`, which carry more meaning than the generic type label.
 */
const AGENT_WORKING_LABEL: Record<string, string> = {
  "review/gate": "Tribunal en sesión — 4 lentes",
  "review/patch": "Parche en el tribunal",
  "review/visual-qa": "QA visual del cierre",
  "build/implement": "Forjando",
  "build/test": "Relevo: tests (RED)",
  "build/backend": "Relevo: backend",
  "build/frontend": "Relevo: frontend",
  "build/selftest": "Auto-test del WO",
};

/** Derive the Spanish label for a raw event, refining AgentWorking by phase/activity. */
function deriveLabel(event: DashboardEvent, typeKey: string): string {
  if (event.event === "AgentWorking") {
    const phase = event.phase ?? "build";
    const refined = AGENT_WORKING_LABEL[`${phase}/${event.activity ?? "implement"}`];
    if (refined !== undefined) return refined;
    return phase === "review" ? "Revisión en curso" : "Forjando";
  }
  if ((event.event === "ReviewVerdict" || event.event === "GateVerdict") && event.verdict) {
    return `Veredicto: ${event.verdict}`;
  }
  if (event.event === "BuildRelaunch") return "Build relanzado";
  return resolveLabel(typeKey);
}

/**
 * Feed relevance filter (REQ-06-015). The global stream mixes the build's own
 * lines with every Claude session's hook noise (SupervisorTick heartbeats,
 * SubagentStop from arbitrary conversations) — those drown the bitácora in
 * "Evento" rows. Only the bounded build vocabulary passes; a FAILURE always
 * passes regardless of type (first-class state, never hidden — AC-06-015.1).
 */
export function isFeedEvent(event: DashboardEvent): boolean {
  if (event.status === "fail" || event.event === "test_fail") return true;
  const typeKey = resolveEventType(event.event);
  return Object.hasOwn(EVENT_ICON, typeKey);
}

// ---------------------------------------------------------------------------
// Tool icon map — extra icon per tool name (AC-06-012.1: tool = extra icon)
// ---------------------------------------------------------------------------

const TOOL_ICON: Record<string, string> = {
  Read: "📖",
  Write: "✍️",
  Edit: "✏️",
  Bash: "💻",
  ToolSearch: "🔎",
  WebSearch: "🌐",
  Task: "🗒️",
};

const FALLBACK_TOOL_ICON = "🔧";

// ---------------------------------------------------------------------------
// IF-06-event-vm — the view-model type
// ---------------------------------------------------------------------------

/**
 * View model for a single dashboard event — the shape consumed by EventFeed.
 *
 * Wave 2 changes (WO-06-001):
 *   `roleColorKey` (was `agentColorKey`): CSS custom property key derived from `event.role`.
 *   `wo`:  work order id — pass-through of `event.workOrder`.
 *   `frd`: FRD id — pass-through of `event.frd`.
 *
 * projectColorKey: project-scoped CSS variable key when event.project is present (AC-06-010.3).
 * isFailure:       true when status==='fail' OR event==='test_fail' (first-class state, AC-06-011.1).
 */
export type EventVM = {
  icon: string;
  toolIcon?: string;
  /** Role-keyed color CSS var (e.g. "--color-agent-implementer"). Derived from event.role. */
  roleColorKey?: string;
  /** Project-keyed color CSS var. Set only when event.project is present (AC-06-010.3). */
  projectColorKey?: string;
  isFailure: boolean;
  label: string;
  at: string;
  /** Work order id (event.workOrder), if present. */
  wo?: string;
  /** FRD id (event.frd), if present. */
  frd?: string;
  /** Legacy: also expose workOrder as `workOrder` for backward-compat consumers. */
  workOrder?: string;
  project?: string;
};

// ---------------------------------------------------------------------------
// Helper: derive project color key from project slug
// ---------------------------------------------------------------------------
function deriveProjectColorKey(project: string): string {
  const slug = project.replace(/[^a-zA-Z0-9-]/g, "-").toLowerCase();
  return `--color-project-${slug}`;
}

// ---------------------------------------------------------------------------
// IF-06-event-vm — toEventVM (pure mapper)
// ---------------------------------------------------------------------------

/** Resolve the icon for an event type; falls back to FALLBACK_ICON. */
function resolveIcon(eventType: string): string {
  return Object.hasOwn(EVENT_ICON, eventType)
    ? (EVENT_ICON[eventType as EventType] as string)
    : FALLBACK_ICON;
}

/** Resolve the Spanish label for an event type; falls back to FALLBACK_LABEL. */
function resolveLabel(eventType: string): string {
  return Object.hasOwn(EVENT_LABEL, eventType)
    ? (EVENT_LABEL[eventType as EventType] as string)
    : FALLBACK_LABEL;
}

/** Resolve the optional tool icon; undefined when no tool is present. */
function resolveToolIcon(tool: string | undefined): string | undefined {
  if (tool === undefined) return undefined;
  return Object.hasOwn(TOOL_ICON, tool) ? TOOL_ICON[tool] : FALLBACK_TOOL_ICON;
}

/** Resolve the role color key from event.role. Undefined when role is absent. */
function resolveRoleColorKey(role: string | undefined): string | undefined {
  if (role === undefined) return undefined;
  return Object.hasOwn(AGENT_COLOR, role)
    ? AGENT_COLOR[role as AgentRole]
    : "--color-agent-unknown";
}

/**
 * Map a raw DashboardEvent (from lib/events) to an EventVM for the feed.
 *
 * Rules (AC-06-011.1, AC-06-010.3):
 * - icon:         from EVENT_ICON[event.event] or FALLBACK_ICON — never undefined.
 * - toolIcon:     from TOOL_ICON[event.tool] or FALLBACK_TOOL_ICON when tool is present.
 * - roleColorKey: AGENT_COLOR[event.role] if event.role is a canonical role;
 *                 for unknown roles uses "--color-agent-unknown"; undefined if no role.
 * - projectColorKey: derived from event.project when present; undefined otherwise.
 * - isFailure:    true when event.status === 'fail' OR event.event === 'test_fail'.
 * - label:        Spanish label from EVENT_LABEL or FALLBACK_LABEL.
 * - at:           pass-through from event.at.
 * - wo:           pass-through of event.workOrder.
 * - frd:          pass-through of event.frd.
 * - workOrder:    same as wo (backward-compat alias).
 * - project:      pass-through when present.
 */
export function toEventVM(event: DashboardEvent): EventVM {
  const typeKey = resolveEventType(event.event);
  const icon = resolveIcon(typeKey);
  const label = deriveLabel(event, typeKey);
  const toolIcon = resolveToolIcon(event.tool);
  const roleColorKey = resolveRoleColorKey(event.role);
  const projColorKey =
    event.project !== undefined ? deriveProjectColorKey(event.project) : undefined;
  const isFailure = event.status === "fail" || event.event === "test_fail";

  const vm: EventVM = { icon, isFailure, label, at: event.at };

  if (toolIcon !== undefined) vm.toolIcon = toolIcon;
  if (roleColorKey !== undefined) vm.roleColorKey = roleColorKey;
  if (projColorKey !== undefined) vm.projectColorKey = projColorKey;
  // Wave 2: expose wo and frd; also keep workOrder as backward-compat alias.
  if (event.workOrder !== undefined) {
    vm.wo = event.workOrder;
    vm.workOrder = event.workOrder;
  }
  if (event.frd !== undefined) vm.frd = event.frd;
  if (event.project !== undefined) vm.project = event.project;

  return vm;
}
