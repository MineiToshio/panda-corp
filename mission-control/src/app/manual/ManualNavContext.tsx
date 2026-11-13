"use client";
/** Navigation bridge retained for diagrams awaiting removal and authored page actions. */

import { createContext } from "react";

export interface ManualNav {
  /** Open an authored Manual page (e.g. a Workflows sub-page) by group + slug. */
  goToManual: (group: string, slug: string) => void;
}

const NOOP_NAV: ManualNav = {
  goToManual: () => {},
};

const ManualNavContext = createContext<ManualNav>(NOOP_NAV);

export const ManualNavProvider = ManualNavContext.Provider;
