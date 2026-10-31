import { navigationHref } from "@/lib/navigation/urls";
import { NavigationSeedProvider } from "@/lib/navigation/useUrlState";
import { DependencyCanvas } from "./DependencyCanvas";
import { loadDependencyMap } from "./data";
/** Self-loading dependency view. Its route selections use only the FRD-25 codec. */
export function DependencyMap({
  project,
  route,
}: {
  project: { slug: string; path: string };
  route: { dag?: string; focus?: string; frd?: string };
}): React.JSX.Element {
  const href = navigationHref(`/portfolio/${encodeURIComponent(project.slug)}/observability`, {
    view: "deps",
    dag: route.dag ?? null,
    focus: route.focus ?? null,
    frd: route.frd ?? null,
  });
  return (
    <NavigationSeedProvider href={href}>
      <DependencyCanvas data={loadDependencyMap(project.path)} route={route} />
    </NavigationSeedProvider>
  );
}
