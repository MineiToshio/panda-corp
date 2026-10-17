import { GraphControls } from "@/components/modules/GraphControls/GraphControls";

/** The dependency map and logical model share the same corner controls. */
export function ZoomControls(props: Omit<React.ComponentProps<typeof GraphControls>, "prefix">) {
  return <GraphControls {...props} prefix="dag" />;
}
