"use client";
import { useSyncExternalStore } from "react";
import { Icon } from "@/components/core/Icon/Icon";
import { t } from "@/lib/copy/copy";
import { applyTheme, persistTheme } from "@/lib/theme/theme";

function subscribe(callback: () => void): () => void {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  window.addEventListener("orbita-theme-change", callback);
  return () => {
    observer.disconnect();
    window.removeEventListener("orbita-theme-change", callback);
  };
}
function snapshot(): "light" | "dark" {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}
export function ThemeToggle(): React.JSX.Element {
  const theme = useSyncExternalStore(subscribe, snapshot, () => "dark");
  const label = t(theme === "dark" ? "shell.theme.labelLight" : "shell.theme.labelDark");
  function handleToggle(): void {
    const next = snapshot() === "dark" ? "light" : "dark";
    applyTheme(next);
    window.dispatchEvent(new Event("orbita-theme-change"));
    try {
      persistTheme(next);
    } catch {
      /* Storage access itself can be blocked. The painted choice lasts for this view. */
    }
  }
  return (
    <button
      type="button"
      className="theme-btn"
      data-action="toggle-theme"
      aria-label={label}
      title={t(theme === "dark" ? "shell.theme.toLight" : "shell.theme.toDark")}
      onClick={handleToggle}
    >
      <Icon name={theme === "dark" ? "sun" : "moon"} />
      <span className="lbl">{label}</span>
    </button>
  );
}
