"use client";

import { useEffect, useRef, useState } from "react";
import { Nav } from "@/components/modules/Nav/Nav";
import { SHELL_COPY } from "./copy.es";
import styles from "./shell.module.css";

/** A route-keyed disclosure keeps phone/tablet navigation in the header and resets on navigation. */
export function ShellNavigation({
  proposalsBadge,
  pendingMergeBadge,
}: {
  proposalsBadge: React.ReactNode;
  pendingMergeBadge?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const region = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    function dismissOutside(event: PointerEvent) {
      if (
        !(event.target instanceof Node) ||
        region.current?.contains(event.target) ||
        toggle.current?.contains(event.target)
      )
        return;
      setOpen(false);
    }
    function dismissEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
      toggle.current?.focus();
    }
    document.addEventListener("pointerdown", dismissOutside);
    document.addEventListener("keydown", dismissEscape);
    return () => {
      document.removeEventListener("pointerdown", dismissOutside);
      document.removeEventListener("keydown", dismissEscape);
    };
  }, [open]);
  return (
    <>
      <div className={styles.actions}>
        {pendingMergeBadge}
        <button
          ref={toggle}
          type="button"
          className={styles.toggle}
          data-nav-toggle
          data-testid="app-nav-toggle"
          aria-expanded={open}
          aria-controls="app-nav-region"
          aria-label={open ? SHELL_COPY.close : SHELL_COPY.open}
          onClick={() => setOpen((value) => !value)}
        >
          <i className={`ti ${open ? "ti-x" : "ti-menu-2"}`} aria-hidden="true" />
        </button>
      </div>
      <div
        id="app-nav-region"
        ref={region}
        className={styles.navRegion}
        data-nav-region
        data-open={open ? "true" : "false"}
        onClickCapture={(event) => {
          if (event.target instanceof Element && event.target.closest("a[href]")) setOpen(false);
        }}
      >
        <Nav proposalsBadge={proposalsBadge} />
      </div>
    </>
  );
}
