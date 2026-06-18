/**
 * WO-06-001 — Iconic event vocabulary + event view-model mapper (IF-06-icon-map, IF-06-event-vm)
 *
 * Wave 2 (La Fragua redesign, 2026-06-18):
 *   - Added `contract` and `gate` to EventType and EVENT_ICON.
 *   - Renamed `agentColorKey → roleColorKey` (now derived from `event.role`, not `event.agent`).
 *   - Added `wo` and `frd` fields to EventVM (surfacing the enriched lib/events fields).
 *   - Updated Spanish labels for `handoff` / `contract` / `gate` per WO-06-001 scope.
 *
 * Pure module — no I/O, no DOM, no side-effects.
 * Consumed by: CMP-06-feed (EventFeed), CMP-06-party-tab (PartyTab)
 *
 * Traceability:
 *   IF-06-icon-map → REQ-06-011, REQ-06-010 (bounded iconic vocabulary)
 *   IF-06-event-vm → REQ-06-011, REQ-06-010 (event view-model for the bitácora)
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
 * The canonical bounded event types (architecture §5, WO-06-001 Wave 2).
 * Includes the new engine lines: `contract` (docs/api.md hand-off) and `gate`
 * (review tribunal). The old `review` type is retained for backward-compat.
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
  | "achievement";

/**
 * Fixed bounded vocabulary: event type → Lucide icon identifier (AC-06-011.1).
 * Single source of truth — no consumer may define its own event→icon mapping.
 */
export const EVENT_ICON: Record<EventType, string> = {
  read: "file-search",
  write: "file-pen",
  edit: "pencil",
  test_ok: "circle-check",
  test_fail: "circle-x",
  message: "message-square",
  start: "play-circle",
  end: "flag",
  handoff: "arrow-right-circle",
  contract: "file-text",
  gate: "gavel",
  blocked: "ban",
  review: "eye",
  achievement: "trophy",
};

/** Fallback icon for event types outside the canonical vocabulary. */
const FALLBACK_ICON = "circle-dashed";

// ---------------------------------------------------------------------------
// Event label map — Spanish labels for the feed (AGENTS.md: UI in Spanish)
// ---------------------------------------------------------------------------

const EVENT_LABEL: Record<EventType, string> = {
  read: "Lectura",
  write: "Escritura",
  edit: "Edición",
  test_ok: "Tests pasados",
  test_fail: "Tests fallidos",
  message: "Mensaje",
  start: "Inicio",
  end: "Fin",
  /** WO-06-001: "📜 nota de estado entregada" */
  handoff: "📜 nota de estado entregada",
  /** WO-06-001: "📄 contrato docs/api.md publicado" */
  contract: "📄 contrato docs/api.md publicado",
  /** WO-06-001: "tribunal del juez abierto" */
  gate: "tribunal del juez abierto",
  blocked: "Bloqueado",
  review: "Revisión",
  achievement: "¡Logro desbloqueado!",
};

const FALLBACK_LABEL = "Evento";

// ---------------------------------------------------------------------------
// Tool icon map — extra icon per tool name (AC-06-012.1: tool = extra icon)
// ---------------------------------------------------------------------------

const TOOL_ICON: Record<string, string> = {
  Read: "book-open",
  Write: "file-pen",
  Edit: "pencil",
  Bash: "terminal",
  ToolSearch: "search",
  WebSearch: "globe",
  Task: "list-todo",
};

const FALLBACK_TOOL_ICON = "wrench";

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
  const icon = resolveIcon(event.event);
  const label = resolveLabel(event.event);
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
