import { useEffect, useState, useSyncExternalStore } from "react";
import { SIDEBAR_STORAGE_KEY } from "@/lib/theme/theme";

function subscribe(callback: () => void): () => void {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-sidebar-pref"],
  });
  window.addEventListener("orbita-sidebar-change", callback);
  return () => {
    observer.disconnect();
    window.removeEventListener("orbita-sidebar-change", callback);
  };
}
function snapshot(): boolean {
  return document.documentElement.dataset.sidebarPref === "collapsed";
}
/** The boot attribute is also the in-memory preference when storage is blocked. */
export function useSidebarPreference() {
  const collapsed = useSyncExternalStore(subscribe, snapshot, () => false);
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(min-width: 1180px)");
    setDesktop(query.matches);
    function handleChange(event: MediaQueryListEvent): void {
      setDesktop(event.matches);
    }
    query.addEventListener("change", handleChange);
    return () => query.removeEventListener("change", handleChange);
  }, []);
  function toggle(): void {
    const next = snapshot() ? "expanded" : "collapsed";
    document.documentElement.dataset.sidebarPref = next;
    window.dispatchEvent(new Event("orbita-sidebar-change"));
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, next);
    } catch {
      /* Browser-local preference remains in the boot attribute for this view. */
    }
  }
  return { collapsed, desktop, toggle };
}
