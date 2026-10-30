import { createElement } from "react";
import { ICON_NODES, type IconName } from "./iconData";

export type IconSize = "sm" | "md" | "lg";

export interface IconProps {
  readonly name: IconName;
  readonly size?: IconSize;
  /** Spanish accessible name; without it the icon is decorative (aria-hidden). */
  readonly label?: string;
}

const PIXELS = { sm: 15, md: 18, lg: 22 } as const satisfies Record<IconSize, number>;

/**
 * Inline Órbita SVG icon (CMP-13-icon): 24x24 box, `currentColor` stroke 1.8, round caps and joins.
 * @param props name of the exported icon, size step, optional accessible label.
 * @returns the svg element; `role="img"` with the label, otherwise `aria-hidden`.
 */
export function Icon({ name, size = "md", label }: IconProps) {
  const px = PIXELS[size];
  const children = ICON_NODES[name].map(([tag, attrs], index) =>
    createElement(tag, { ...attrs, key: `${tag}-${index}` }),
  );
  const shared = {
    xmlns: "http://www.w3.org/2000/svg",
    viewBox: "0 0 24 24",
    width: px,
    height: px,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className: size === "md" ? "i" : `i ${size}`,
    "data-icon": name,
  } as const;
  if (label) {
    return (
      <svg {...shared} role="img" aria-label={label}>
        {children}
      </svg>
    );
  }
  return (
    <svg {...shared} aria-hidden="true">
      {children}
    </svg>
  );
}
