/** State-free structure accepted by the deterministic layout engine. */
export interface DependencyOrder {
  readonly id: string;
  readonly frd: string;
  readonly dependsOn?: readonly string[];
}
/** Canonical FRD identity and display title, supplied in index order. */
export interface DependencyFrd {
  readonly slug: string;
  readonly code: string;
  readonly title: string;
}
/** A real prerequisite-to-dependent curve in canvas coordinates. */
interface DependencyEdge {
  readonly from: string;
  readonly to: string;
  readonly path: string;
}
/** A work-order position at natural size, with its scope and build step. */
export interface DependencyPosition {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly depth: number;
  readonly outOfScope: boolean;
}
/** Natural work-order canvas and narrow-list steps. */
export interface WorkOrderGeometry {
  readonly width: number;
  readonly height: number;
  readonly nodes: DependencyPosition[];
  readonly edges: DependencyEdge[];
  readonly steps: string[][];
}
/** Compound FRD box, in dependency order. */
export interface FrdBox {
  readonly slug: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly depth: number;
  readonly ids: string[];
}
/** Aggregated dominant-direction FRD curve with its minority direction retained. */
export interface FrdLink extends DependencyEdge {
  readonly count: number;
  readonly backCount: number;
  readonly labelX: number;
  readonly labelY: number;
}
/** Serializable FRD canvas, mini nodes, real intra-FRD edges and aggregated cross-FRD links. */
export interface FrdGeometry {
  readonly width: number;
  readonly height: number;
  readonly boxes: FrdBox[];
  readonly items: DependencyPosition[];
  readonly links: FrdLink[];
  readonly edges: DependencyEdge[];
}
