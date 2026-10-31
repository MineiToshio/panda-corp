import type { NavigationState } from "@/lib/navigation/urls";
import type { TabId } from "../_components/tabbar";
import type { WoDetailTab } from "../_components/wo-detail/wo-detail";
import type { WorkspaceProject } from "./workspaceProject";

/** Shared URL selection for workspace routes and panels. */
export interface WorkspaceSelection {
  activeTab: TabId | "unknown";
  docParam: string | undefined;
  woParam: string | undefined;
  woTabParam: WoDetailTab;
  rawTab?: string;
}

export interface WorkspaceRoute extends WorkspaceSelection {
  readonly navigationBaseHref: string;
  readonly state: NavigationState;
}
export interface PanelProps {
  readonly project: WorkspaceProject;
  readonly route: WorkspaceRoute;
}
