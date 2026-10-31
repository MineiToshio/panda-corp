import { NAV_DESTINATIONS, type NavDestinationId } from "@/lib/constants";
import { activeDestinationPath } from "@/lib/navigation/destinations";

/** Map the canonical route family to a shell id; unmatched paths have no selection. */
export function navActive(pathname: string): NavDestinationId | null {
  const path = activeDestinationPath(pathname);
  return NAV_DESTINATIONS.find((destination) => destination.path === path)?.id ?? null;
}
