/**
 * WO-06-001 — Iconic event vocabulary + event view-model mapper (IF-06-icon-map, IF-06-event-vm)
 *
 * Pure module — no I/O, no DOM, no side-effects.
 * Consumed by: CMP-06-feed (EventFeed), CMP-06-party-tab (PartyTab)
 *
 * Traceability:
 *   IF-06-icon-map → REQ-06-012 (bounded iconic vocabulary ~12 types)
 *   IF-06-event-vm → REQ-06-012, REQ-06-013, REQ-06-011
 *   Depends on: IF-01-readEvents (lib/events.ts) — the DashboardEvent type
 *               IF-13-agent-colors (app/_design/tokens.ts) — AGENT_COLOR
 */

import { AGENT_COLOR, type AgentRole } from "@/app/_design/tokens/tokens";
import type { Event as DashboardEvent } from "@/lib/events";

// ---------------------------------------------------------------------------
// IF-06-icon-map — bounded vocabulary (~12 types)
// Icon values are Lucide component identifier strings (resolved at render time).
// ---------------------------------------------------------------------------

/** The canonical bounded event types (architecture §5). */
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
  | "blocked"
  | "review"
  | "achievement";

/**
 * Fixed bounded vocabulary: event type → Lucide icon identifier (AC-06-012.1).
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
  handoff: "Entrega",
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
 * agentColorKey:   CSS custom property key (e.g. "--color-agent-frontend-dev") or undefined.
 * projectColorKey: project-scoped CSS variable key when event.project is present.
 * isFailure:       true when status==='fail' OR event==='test_fail' (AC-06-013.1).
 */
export type EventVM = {
  icon: string;
  toolIcon?: string;
  agentColorKey?: string;
  projectColorKey?: string;
  isFailure: boolean;
  label: string;
  at: string;
  workOrder?: string;
  project?: string;
};

// ---------------------------------------------------------------------------
// Helper: derive project color key from project slug
// Each project gets a CSS variable keyed by its slug.
// The value is set in globals.css via @theme per WO-13-002.
// For now, all projects share a single project-accent token.
// ---------------------------------------------------------------------------
function projectColorKey(project: string): string {
  // Normalize slug to valid CSS identifier chars (replace non-alphanumeric with hyphens).
  const slug = project.replace(/[^a-zA-Z0-9-]/g, "-").toLowerCase();
  return `--color-project-${slug}`;
}

// ---------------------------------------------------------------------------
// IF-06-event-vm — toEventVM (pure mapper)
// ---------------------------------------------------------------------------

/**
 * Map a raw DashboardEvent (from lib/events) to an EventVM for the feed.
 *
 * Rules (AC-06-011.1, AC-06-012.1, AC-06-013.1):
 * - icon: from EVENT_ICON[event.event] or FALLBACK_ICON — never undefined.
 * - toolIcon: from TOOL_ICON[event.tool] or FALLBACK_TOOL_ICON when tool is present.
 * - agentColorKey: AGENT_COLOR[event.agent] if event.agent is a canonical role;
 *     for unknown roles, uses a generic CSS variable; undefined if no agent.
 * - projectColorKey: derived from event.project when present; undefined otherwise.
 * - isFailure: true when event.status === 'fail' OR event.event === 'test_fail'.
 * - label: Spanish label from EVENT_LABEL or FALLBACK_LABEL.
 * - at: pass-through from event.at.
 * - workOrder, project: pass-through when present.
 */
export function toEventVM(event: DashboardEvent): EventVM {
  const eventType = event.event as EventType;

  const icon = Object.hasOwn(EVENT_ICON, eventType)
    ? (EVENT_ICON[eventType] as string)
    : FALLBACK_ICON;

  const label = Object.hasOwn(EVENT_LABEL, eventType)
    ? (EVENT_LABEL[eventType] as string)
    : FALLBACK_LABEL;

  const toolIcon =
    event.tool !== undefined
      ? Object.hasOwn(TOOL_ICON, event.tool)
        ? TOOL_ICON[event.tool]
        : FALLBACK_TOOL_ICON
      : undefined;

  // Derive agentColorKey: canonical roles use AGENT_COLOR; unknown roles get a generic fallback.
  const agentColorKey: string | undefined =
    event.agent !== undefined
      ? Object.hasOwn(AGENT_COLOR, event.agent)
        ? AGENT_COLOR[event.agent as AgentRole]
        : "--color-agent-unknown"
      : undefined;

  const projColorKey: string | undefined =
    event.project !== undefined ? projectColorKey(event.project) : undefined;

  const isFailure = event.status === "fail" || event.event === "test_fail";

  const vm: EventVM = {
    icon,
    isFailure,
    label,
    at: event.at,
  };

  if (toolIcon !== undefined) vm.toolIcon = toolIcon;
  if (agentColorKey !== undefined) vm.agentColorKey = agentColorKey;
  if (projColorKey !== undefined) vm.projectColorKey = projColorKey;
  if (event.workOrder !== undefined) vm.workOrder = event.workOrder;
  if (event.project !== undefined) vm.project = event.project;

  return vm;
}
