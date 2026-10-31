"use client";

import { useEffect, useRef } from "react";
import type { Tone } from "@/components/core/Chip/vocabulary";
import { Icon } from "@/components/core/Icon/Icon";
import type { IconName } from "@/components/core/Icon/iconData";
import { t } from "@/lib/copy/copy";
import styles from "./Tabs.module.css";
import { useTabOverflow } from "./useTabOverflow";

/** A single tab definition. */
interface TabDef {
  /** Unique identifier for this tab. */
  id: string;
  /** Displayed label (Spanish). */
  label: string;
  /** Optional Órbita icon (e.g. "bolt"). */
  icon?: IconName;
  /** Optional count badge displayed inline after the label. */
  count?: number;
  /** Hue of the selected underline and icon. */
  tone?: Tone;
  /** Explicit associated panel id. */
  panelId?: string;
  /** Disabled tabs are excluded from keyboard navigation. */
  disabled?: boolean;
}

export interface TabsProps {
  /** "top" renders the .tab style; "sub" renders the .stab style. */
  level?: "top" | "sub";
  /** Ordered list of tab definitions. */
  tabs: readonly TabDef[];
  /** The id of the currently active tab. */
  active: string;
  /** Called with the id of the newly selected tab. */
  onChange: (id: string) => void;
  /** Optional accessible label for the tablist (Spanish). */
  ariaLabel?: string;
  /**
   * Optional prefix for each tab button's `data-testid` (default `"tab-"`).
   * Lets a consuming screen keep stable, screen-specific test ids while still
   * using the ONE shared tab primitive (DR-062) — e.g. `"card-detail-tab-"`.
   */
  testIdPrefix?: string;
  /**
   * Optional prefix for each tab button's HTML `id` attribute (default: none).
   * When set, each button gets `id="${tabIdPrefix}${tab.id}"` so paired
   * `role="tabpanel"` elements can reference them with `aria-labelledby`.
   * Example: `tabIdPrefix="config-tab-id-"` → `id="config-tab-id-skills"`.
   */
  tabIdPrefix?: string;
  /** Optional panel id prefix; omitted associations do not emit aria-controls. */
  panelIdPrefix?: string;
}

function panelControls(tab: TabDef, prefix?: string): string | undefined {
  return tab.panelId ?? (prefix != null ? `${prefix}${tab.id}` : undefined);
}

const OVERFLOW_CONTROL_WIDTH = 28;
/** Keeps a revealed tab's edge off the control: scrollBy rounds, so an exact fit can land under it. */
const OVERFLOW_CONTROL_CLEARANCE = OVERFLOW_CONTROL_WIDTH + 2;

function revealTab(list: HTMLDivElement, button: HTMLButtonElement): void {
  const strip = list.getBoundingClientRect();
  const tab = button.getBoundingClientRect();
  const visibleLeft = strip.left + (list.scrollLeft > 1 ? OVERFLOW_CONTROL_CLEARANCE : 0);
  const visibleRight =
    strip.right -
    (list.scrollLeft + list.clientWidth < list.scrollWidth - 1 ? OVERFLOW_CONTROL_CLEARANCE : 0);
  const offset =
    tab.left < visibleLeft ? tab.left - visibleLeft : Math.max(0, tab.right - visibleRight);
  if (offset) list.scrollBy?.({ left: offset, behavior: "auto" });
}

/** Controlled, hue-marked tabs with manual keyboard activation and horizontal overflow. */
export function Tabs({
  level = "top",
  tabs,
  active,
  onChange,
  ariaLabel,
  testIdPrefix = "tab-",
  tabIdPrefix,
  panelIdPrefix,
}: TabsProps): React.JSX.Element {
  const listRef = useRef<HTMLDivElement>(null);
  const { left, right, measure, scroll } = useTabOverflow(listRef);
  const buttonRefs = useRef(new Map<string, HTMLButtonElement>());
  useEffect(() => {
    const list = listRef.current;
    const button = buttonRefs.current.get(active);
    if (list && button && window.matchMedia?.("(max-width: 759px)").matches) {
      revealTab(list, button);
    }
    measure();
  }, [active, measure]);

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>): void {
    const enabled = tabs.filter((tab) => !tab.disabled);
    const index = enabled.findIndex(
      (tab) => buttonRefs.current.get(tab.id) === document.activeElement,
    );
    if (index < 0) return;
    let next = index;
    switch (event.key) {
      case "ArrowRight":
        next = (index + 1) % enabled.length;
        break;
      case "ArrowLeft":
        next = (index - 1 + enabled.length) % enabled.length;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = enabled.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    const tab = enabled[next];
    const button = tab && buttonRefs.current.get(tab.id);
    if (button) {
      button.focus({ preventScroll: true });
      if (listRef.current) revealTab(listRef.current, button);
    }
  }
  const fallbackId = tabs.find((tab) => !tab.disabled)?.id;
  const focusId = tabs.some((tab) => tab.id === active && !tab.disabled) ? active : fallbackId;
  return (
    <div
      className={`tabs-wrap ${styles.wrap}`}
      style={{ "--tabs-control-width": `${OVERFLOW_CONTROL_WIDTH}px` } as React.CSSProperties}
      data-more-left={left}
      data-more-right={right}
    >
      {left ? (
        <button
          type="button"
          className={styles.previous}
          aria-label={t("common.tabs.previous")}
          onClick={() => scroll(-1)}
        >
          <Icon name="back" size="sm" />
        </button>
      ) : null}
      <div
        ref={listRef}
        className={`tabs ${styles.tabs}`}
        data-testid="tabs-root"
        data-scroll-x="intentional"
        data-level={level}
        role="tablist"
        aria-label={ariaLabel}
        onKeyDown={handleKeyDown}
        onScroll={measure}
      >
        {tabs.map((tab) => {
          const isActive = tab.id === active;
          return (
            <button
              key={tab.id}
              ref={(element) => {
                if (element) buttonRefs.current.set(tab.id, element);
                else buttonRefs.current.delete(tab.id);
              }}
              id={tabIdPrefix != null ? `${tabIdPrefix}${tab.id}` : undefined}
              type="button"
              role="tab"
              data-testid={`${testIdPrefix}${tab.id}`}
              data-active={isActive ? "true" : "false"}
              data-tone={tab.tone ?? "slate"}
              aria-selected={isActive}
              aria-controls={panelControls(tab, panelIdPrefix)}
              disabled={tab.disabled}
              tabIndex={tab.id === focusId ? 0 : -1}
              onClick={() => onChange(tab.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onChange(tab.id);
                }
              }}
            >
              {tab.icon ? <Icon name={tab.icon} size="sm" /> : null}
              {tab.label}
              {tab.count != null ? (
                <span className={`num ${styles.badge}`}>{tab.count}</span>
              ) : null}
            </button>
          );
        })}
      </div>
      {right ? (
        <button
          type="button"
          className={styles.next}
          aria-label={t("common.tabs.next")}
          onClick={() => scroll(1)}
        >
          <Icon name="arrow" size="sm" />
        </button>
      ) : null}
    </div>
  );
}

/** Compatibility shorthand for secondary tab strips. */
export function SubTabs(props: Omit<TabsProps, "level">): React.JSX.Element {
  return <Tabs level="sub" {...props} />;
}
