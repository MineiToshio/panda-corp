import type { RouteQuery } from "@/lib/navigation/routeState";
import { PortfolioContent } from "./PortfolioContent";

/** Next page boundary exposes only framework-supported props. */
export default function PortfolioPage({
  searchParams,
}: {
  searchParams: Promise<RouteQuery>;
}): Promise<React.JSX.Element> {
  return PortfolioContent({ searchParams });
}
