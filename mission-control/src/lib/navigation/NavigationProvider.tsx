"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useTransition,
} from "react";

import { NAVIGATION_EVENT } from "./history";

type Router = ReturnType<typeof useRouter>;
type RefreshCheck = () => boolean;
type NavigationContextValue = {
  router: Router;
  request: (owner: symbol, check: RefreshCheck) => void;
  cancel: (owner: symbol) => void;
};
const NavigationContext = createContext<NavigationContextValue | null>(null);

/** Share pending navigation across workspace islands; background refresh must not replace a push. */
export function NavigationProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const pending = useRef(false);
  const queued = useRef(new Map<symbol, RefreshCheck>());
  const value = useMemo<NavigationContextValue>(
    () => ({
      router: {
        ...router,
        push: (...args) => {
          pending.current = true;
          startTransition(() => router.push(...args));
        },
        replace: (...args) => {
          pending.current = true;
          startTransition(() => router.replace(...args));
        },
      },
      request(owner, check) {
        if (pending.current) queued.current.set(owner, check);
        else if (check()) router.refresh();
      },
      cancel(owner) {
        queued.current.delete(owner);
      },
    }),
    [router],
  );
  useEffect(() => {
    if (isPending) return;
    pending.current = false;
    // Next commits the browser URL without popstate; synchronize native-history subscribers.
    window.dispatchEvent(new Event(NAVIGATION_EVENT));
    const checks = [...queued.current.values()];
    queued.current.clear();
    if (checks.some((check) => check())) router.refresh();
  }, [isPending, router]);
  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
}

/** All imperative workspace navigations enter the same transition before dispatching to Next. */
export function useNavigationRouter(): Router {
  const router = useRouter();
  return useContext(NavigationContext)?.router ?? router;
}

/** Cancel an obsolete subscriber on unmount and recheck its current condition after navigation. */
export function useBackgroundRefresh(check: RefreshCheck = () => true): () => void {
  const { refresh } = useRouter();
  const context = useContext(NavigationContext);
  const owner = useRef(Symbol("background-refresh"));
  const currentCheck = useRef(check);
  useEffect(() => {
    currentCheck.current = check;
  });
  useEffect(() => () => context?.cancel(owner.current), [context]);
  return useCallback(() => {
    if (context) context.request(owner.current, () => currentCheck.current());
    else if (currentCheck.current()) refresh();
  }, [context, refresh]);
}
