"use client";
/** Navigation bridge retained for diagrams awaiting removal and authored page actions. */

import { createContext, useContext } from "react";

export interface ManualNav {
  /** Open the skill in Configuration. */
  goToSkill: (slug: string) => void;
  /** Open the agent in Configuration. */
  goToAgent: (id: string) => void;
  /** Open an authored Manual page (e.g. a Workflows sub-page) by group + slug. */
  goToManual: (group: string, slug: string) => void;
}

const NOOP_NAV: ManualNav = {
  goToSkill: () => {},
  goToAgent: () => {},
  goToManual: () => {},
};

const ManualNavContext = createContext<ManualNav>(NOOP_NAV);

export const ManualNavProvider = ManualNavContext.Provider;

/** Read the in-Manual navigation handlers (no-op outside a provider). */
export function useManualNav(): ManualNav {
  return useContext(ManualNavContext);
}
