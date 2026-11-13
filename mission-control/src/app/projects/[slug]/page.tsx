import type { RouteQuery } from "@/lib/navigation/routeState";
import ProjectWorkspacePage from "./ProjectWorkspacePage";

/** Next supplies only route params and search params; persistent routes seed the shared component. */
export default function ProjectPage(props: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<RouteQuery>;
}): Promise<React.JSX.Element> {
  return ProjectWorkspacePage(props);
}
