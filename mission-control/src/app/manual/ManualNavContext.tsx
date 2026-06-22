"use client";
/**
 * ManualNavContext — in-Manual cross-navigation for the interactive flow graphs.
 *
 * A skill's flow node that references ANOTHER skill (e.g. implement → upgrade) or an agent is
 * clickable: clicking it jumps to that skill/agent's own Reference detail (a navigable graph of docs).
 * ManualShell provides the implementation (it owns the active page + the reference selection); the
 * FlowGraph deep in the tree consumes it. Defaults are no-ops so the graph still renders if mounted
 * outside a provider (e.g. a unit test).
 *
 * Traceability: FRD-08 (the Manual is the navigable face of the factory know-how).
 */

import { createContext, useContext } from "react";

export interface ManualNav {
  /** Open the Reference detail of the skill with this slug (Comandos catalog). */
  goToSkill: (slug: string) => void;
  /** Open the Reference detail of the agent with this id (Agentes catalog). */
  goToAgent: (id: string) => void;
}

const NOOP_NAV: ManualNav = {
  goToSkill: () => {},
  goToAgent: () => {},
};

const ManualNavContext = createContext<ManualNav>(NOOP_NAV);

export const ManualNavProvider = ManualNavContext.Provider;

/** Read the in-Manual navigation handlers (no-op outside a provider). */
export function useManualNav(): ManualNav {
  return useContext(ManualNavContext);
}
