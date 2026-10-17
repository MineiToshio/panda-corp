"use client";

import { createContext, type ReactNode, useContext } from "react";
import { NavigationSeedProvider } from "@/lib/navigation/useUrlState";

const WorkspaceNavigation = createContext<string | undefined>(undefined);

/** Share the server-resolved origin and hydrate client URL selections from the same location. */
export function WorkspaceNavigationProvider({
  href,
  children,
}: {
  href?: string;
  children: ReactNode;
}): React.JSX.Element {
  return (
    <WorkspaceNavigation.Provider value={href}>
      <NavigationSeedProvider href={href ?? "/"}>{children}</NavigationSeedProvider>
    </WorkspaceNavigation.Provider>
  );
}

export function useWorkspaceNavigation(): string | undefined {
  return useContext(WorkspaceNavigation);
}
