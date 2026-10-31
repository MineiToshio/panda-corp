import { type MouseEventHandler, type RefObject, useEffect, useRef, useState } from "react";

interface DrawerState {
  readonly open: boolean;
  readonly hydrated: boolean;
  readonly isPhone: boolean;
  readonly sidebar: RefObject<HTMLElement | null>;
  readonly handleOpen: MouseEventHandler<HTMLButtonElement>;
  readonly handleNavigate: MouseEventHandler<HTMLElement>;
}

/** Phone drawer lifecycle, route dismissal, focus entry and keyboard containment. */
export function useDrawer(pathname: string): DrawerState {
  const [hydrated, setHydrated] = useState(false);
  const [isPhone, setIsPhone] = useState(false);
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  const sidebar = useRef<HTMLElement>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const open = isPhone && openedOn === pathname;

  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      setHydrated(true);
      return;
    }
    const media = window.matchMedia("(max-width: 759px)");
    setIsPhone(media.matches);
    setHydrated(true);
    function handleResize(event: MediaQueryListEvent) {
      setIsPhone(event.matches);
      setOpenedOn(null);
    }
    media.addEventListener("change", handleResize);
    return () => media.removeEventListener("change", handleResize);
  }, []);

  useEffect(() => {
    if (openedOn !== null && openedOn !== pathname) setOpenedOn(null);
  }, [openedOn, pathname]);

  function close() {
    setOpenedOn(null);
  }
  function handleOpen(event: React.MouseEvent<HTMLButtonElement>) {
    opener.current = event.currentTarget;
    setOpenedOn(open ? null : pathname);
  }
  function handleNavigate(event: React.MouseEvent<HTMLElement>) {
    if (event.target instanceof Element && event.target.closest("a[href]")) close();
  }

  useEffect(() => {
    if (!open) return;
    sidebar.current?.querySelector<HTMLElement>("a[href]")?.focus();
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpenedOn(null);
        opener.current?.focus();
      }
      if (event.key !== "Tab") return;
      const links = sidebar.current?.querySelectorAll<HTMLElement>(
        "a[href], button:not(:disabled), [tabindex='0']",
      );
      const first = links?.[0];
      const last = links?.[links.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
    function handleOutside(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !sidebar.current?.contains(event.target) &&
        !opener.current?.contains(event.target)
      )
        setOpenedOn(null);
    }
    document.addEventListener("keydown", handleKey);
    document.addEventListener("pointerdown", handleOutside);
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.removeEventListener("pointerdown", handleOutside);
    };
  }, [open]);

  return { open, hydrated, isPhone, sidebar, handleOpen, handleNavigate };
}
