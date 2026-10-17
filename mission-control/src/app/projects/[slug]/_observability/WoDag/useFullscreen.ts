import { useFullscreen as useBrowserFullscreen } from "@/hooks/useFullscreen";

/** Route adapter retains the dependency map's public hook while sharing browser behavior. */
export function useFullscreen(ref: React.RefObject<HTMLElement | null>) {
  return useBrowserFullscreen(ref);
}
