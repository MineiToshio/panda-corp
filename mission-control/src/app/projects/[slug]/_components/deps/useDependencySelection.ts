"use client";
import { useEffect, useState } from "react";
import { updateNavigation, useUrlState } from "@/lib/navigation/useUrlState";
import { selectedFrd } from "../wo-views/selection";
import type { DependencyMapData } from "./data";
/** Selection and chain state only; every geometry is supplied by the server. */
export function useDependencySelection(
  data: DependencyMapData,
  route: { dag?: string; focus?: string; frd?: string },
) {
  const [dag, setDag] = useUrlState("dag", route.dag ?? "frd"),
    [frdValue, setFrd] = useUrlState("frd", route.frd ?? ""),
    [selected, setFocus] = useUrlState("focus", route.focus ?? "");
  const [hover, setHover] = useState("");
  const level = dag === "wo" ? "wo" : "frd";
  const frd = selectedFrd(data.frds, frdValue);
  const geometry = Object.hasOwn(data.workLayouts, frd)
    ? data.workLayouts[frd]
    : data.workLayouts[""];
  const nodes = level === "wo" ? (geometry?.nodes ?? []) : data.frdGeometry.items;
  const valid = new Set(nodes.map((node) => node.id));
  const focus = valid.has(selected) ? selected : "";
  const active = focus || (valid.has(hover) ? hover : "");
  const chain = data.chains[active];
  const lit = new Set(
    active ? [active, ...(chain?.upstream ?? []), ...(chain?.downstream ?? [])] : [],
  );
  const byId = new Map(data.orders.map((order) => [order.id, order]));
  const focused = byId.get(focus);
  function handleFocus(id: string): void {
    setFocus(id === focus ? "" : id);
    setHover("");
  }
  function handleClear(): void {
    setFocus("");
    setHover("");
  }
  function handleOpen(id: string): void {
    updateNavigation({ wo: id });
  }
  function handleFrd(slug: string): void {
    updateNavigation({ dag: "wo", frd: slug, focus: null });
    setHover("");
  }
  function handleBackground(event: React.MouseEvent<HTMLElement>): void {
    if (event.target instanceof Element && !event.target.closest("button")) handleClear();
  }
  useEffect(() => {
    function handleKey(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        setFocus("");
        setHover("");
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [setFocus]);
  return {
    level,
    setDag,
    frd,
    setFrd,
    geometry,
    nodes,
    focus,
    active,
    lit,
    byId,
    focused,
    handleFocus,
    handleClear,
    handleOpen,
    handleFrd,
    handleBackground,
    setHover,
  };
}
/** Client selection contract shared by the graph presentation. */
export type DependencySelection = ReturnType<typeof useDependencySelection>;
