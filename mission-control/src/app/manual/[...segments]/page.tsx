import { notFound } from "next/navigation";
import { type RouteQuery, routeHref } from "@/lib/navigation/routeState";
import { NavigationSeedProvider } from "@/lib/navigation/useUrlState";
import ManualPage from "../page";

/** Resolve persistent manual paths using the existing shared page. */
export default async function PersistentPage({
  params,
  searchParams,
}: {
  params: Promise<{ segments: string[] }>;
  searchParams: Promise<RouteQuery>;
}): Promise<React.JSX.Element> {
  const { segments } = await params;
  if (
    !["tutorial", "guides", "concepts", "workflows", "reference"].includes(segments[0] ?? "") ||
    segments.length > (segments[0] === "reference" ? 3 : 2)
  )
    notFound();
  if (
    segments[0] === "reference" &&
    !["commands", "agents", "rules", "standards"].includes(segments[1] ?? "")
  )
    notFound();
  const href = routeHref("/manual", segments, await searchParams);
  return (
    <NavigationSeedProvider href={href}>
      <ManualPage />
    </NavigationSeedProvider>
  );
}
